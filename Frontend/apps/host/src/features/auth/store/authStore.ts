import { create } from 'zustand'
import { ApiError, registerAuthHooks } from '../../../shared/api/httpClient'
import { authServiceClient, type CurrentUserDto, type RefreshResponse } from '../../../shared/api/authServiceClient'

export type AuthStatus = 'idle' | 'hydrating' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  user: CurrentUserDto | null
  /** Kept in memory only — never written to localStorage/sessionStorage. See the plan's auth-strategy decision. */
  accessToken: string | null
  accessTokenExpiresAt: number | null
  loginLoading: boolean
  loginError: string | null
  /** Set when a session ended on its own (expiry, idle timeout, absolute cap) so /login can explain why. */
  sessionExpiredReason: string | null

  login: (email: string, password: string) => Promise<void>
  /** Same session-establishing flow as login(), fed a verified Google ID token instead of a password. */
  loginWithGoogle: (idToken: string) => Promise<void>
  logout: (reason?: string) => Promise<void>
  /** Attempts to restore a session from the httpOnly refresh cookie on app boot, without a full login. */
  hydrate: () => Promise<void>
  /** Returns a valid access token, refreshing first if it's missing or close to expiry. Throws if refresh fails (caller should treat as logged out). */
  ensureFreshAccessToken: () => Promise<string>
  /**
   * Unconditionally re-fetches the current session (bypassing ensureFreshAccessToken's near-expiry
   * skip) and applies the result — the acting user's own permissions/JWT claims are recomputed
   * fresh server-side on every refresh, so this is what makes editing your own role/permissions
   * take effect immediately instead of waiting up to AccessTokenMinutes for the token to naturally
   * expire. Call after any save that could have changed the CURRENT user's own effective access.
   */
  refreshSession: () => Promise<void>
  hasCapability: (featureKey: string, capability: string) => boolean
  clearSessionExpiredReason: () => void
}

const REFRESH_SKEW_MS = 30_000

/**
 * Callbacks that wipe non-auth client state on logout.
 *
 * Registered by the modules that own that state, so authStore does not have to import them (which
 * would create cycles). This exists because logout previously cleared ONLY the auth store: the
 * module-registry store kept `status: 'loaded'` with the previous user's apps, and App.tsx guards
 * its fetch on `registryStatus !== 'idle'` — so signing out and signing in as a different user
 * showed the PREVIOUS user's sidebar. The federated-component cache and the query cache had the
 * same problem.
 */
const sessionCleanupHandlers = new Set<() => void>()

export function registerSessionCleanup(handler: () => void): () => void {
  sessionCleanupHandlers.add(handler)
  return () => sessionCleanupHandlers.delete(handler)
}

function runSessionCleanup() {
  for (const handler of sessionCleanupHandlers) {
    try {
      handler()
    } catch {
      // One failing cleanup must not prevent the others from running.
    }
  }
}

/**
 * Cross-tab coordination.
 *
 * Logout in one tab must sign out the others; without this, tab B kept rendering an authenticated
 * UI with a live in-memory token after tab A signed out.
 */
const AUTH_CHANNEL = 'omniremit-auth'
type AuthBroadcast = { type: 'logout'; reason?: string }

const authChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(AUTH_CHANNEL) : null

// Within a single tab: React 19 StrictMode double-invokes mount effects, and two components can
// race a refresh in production too — so every caller shares one in-flight request.
let inFlightRefresh: Promise<RefreshResponse> | null = null

/**
 * Performs the refresh, serialised ACROSS TABS via the Web Locks API.
 *
 * The refresh cookie is rotated server-side on every use (RefreshTokenService.RotateAsync), and
 * presenting an already-rotated token is — correctly — treated as theft, which revokes the entire
 * session. The previous in-tab dedupe was module-scoped and therefore per-tab, so two tabs waking
 * together (a laptop resuming, or simply two open tabs) both POSTed /api/auth/refresh with the same
 * cookie and the second one killed the user's session outright.
 *
 * Serialising is sufficient to fix it: cookies are shared across tabs, so once the first refresh
 * completes the second tab's request naturally carries the NEW cookie and is a legitimate rotation.
 * Web Locks is used rather than hand-rolled leader election because it is purpose-built for this
 * and releases automatically if a tab is closed mid-refresh.
 */
function refreshOnce(): Promise<RefreshResponse> {
  inFlightRefresh ??= (async () => {
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      return navigator.locks.request('omniremit-token-refresh', () => authServiceClient.refresh())
    }
    return authServiceClient.refresh()
  })().finally(() => {
    inFlightRefresh = null
  })

  return inFlightRefresh
}

function applySession(session: { accessToken: string; expiresAt: string; user: CurrentUserDto }) {
  return {
    user: session.user,
    accessToken: session.accessToken,
    accessTokenExpiresAt: new Date(session.expiresAt).getTime(),
    status: 'authenticated' as const,
    sessionExpiredReason: null,
    // Cleared here as well as at the start of login(). Any path that establishes a session — login,
    // Google sign-in, silent refresh on boot — must leave no stale failure message behind, or a
    // previous attempt's error can outlive the attempt and be shown over a working session.
    loginError: null,
  }
}

const signedOutState = {
  status: 'unauthenticated' as const,
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  loginLoading: false,
  loginError: null,
  sessionExpiredReason: null,

  async login(email, password) {
    set({ loginLoading: true, loginError: null })
    try {
      const session = await authServiceClient.login(email, password)
      set({ ...applySession(session), loginLoading: false })
    } catch (err) {
      set({
        loginLoading: false,
        loginError: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      })
    }
  },

  async loginWithGoogle(idToken) {
    set({ loginLoading: true, loginError: null })
    try {
      const session = await authServiceClient.loginWithGoogle(idToken)
      set({ ...applySession(session), loginLoading: false })
    } catch (err) {
      set({
        loginLoading: false,
        loginError: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      })
    }
  },

  async logout(reason) {
    try {
      await authServiceClient.logout()
    } catch {
      // best-effort — the client-side session is cleared either way
    }
    set({ ...signedOutState, sessionExpiredReason: reason ?? null })
    runSessionCleanup()
    authChannel?.postMessage({ type: 'logout', reason } satisfies AuthBroadcast)
  },

  async hydrate() {
    // Another caller's refresh may already be in flight (or land moments later) — if this status
    // update would clobber an already-established session, skip it rather than racing.
    if (get().status === 'authenticated') return
    set({ status: 'hydrating' })
    try {
      const session = await refreshOnce()
      set(applySession(session))
    } catch {
      if (get().status !== 'authenticated') {
        set(signedOutState)
      }
    }
  },

  async ensureFreshAccessToken() {
    const { accessToken, accessTokenExpiresAt } = get()
    if (accessToken && accessTokenExpiresAt && accessTokenExpiresAt - Date.now() > REFRESH_SKEW_MS) {
      return accessToken
    }

    try {
      const session = await refreshOnce()
      set(applySession(session))
      return session.accessToken
    } catch (err) {
      if (get().status !== 'authenticated') {
        set(signedOutState)
      }
      throw err
    }
  },

  async refreshSession() {
    try {
      const session = await refreshOnce()
      set(applySession(session))
    } catch (err) {
      // A transient network blip is not a dead session, so this stays best-effort — but a definitive
      // 401 IS the server telling us the session is over. Previously every failure was swallowed,
      // leaving status 'authenticated' with stale permissions: a zombie UI that looked signed in and
      // failed every subsequent request.
      if (err instanceof ApiError && err.status === 401) {
        set({ ...signedOutState, sessionExpiredReason: 'Your session expired. Please sign in again.' })
        runSessionCleanup()
      }
    }
  },

  hasCapability(featureKey, capability) {
    const user = get().user
    if (!user) return false
    if (user.isAdministrator) return true
    return user.permissions.includes(`${featureKey}:${capability}`)
  },

  clearSessionExpiredReason() {
    set({ sessionExpiredReason: null })
  },
}))

// Another tab signed out — drop this tab's in-memory session too.
authChannel?.addEventListener('message', (event: MessageEvent<AuthBroadcast>) => {
  if (event.data?.type !== 'logout') return
  if (useAuthStore.getState().status === 'unauthenticated') return

  useAuthStore.setState({ ...signedOutState, sessionExpiredReason: event.data.reason ?? null })
  runSessionCleanup()
})

/**
 * Lets httpClient refresh-and-retry a 401, and tear the session down when the refresh itself fails,
 * without importing this store (which would be a cycle — this store imports the API clients that
 * import httpClient).
 */
registerAuthHooks({
  refresh: async () => {
    const session = await refreshOnce()
    useAuthStore.setState(applySession(session))
    return session.accessToken
  },
  onSessionExpired: (reason) => {
    if (useAuthStore.getState().status === 'unauthenticated') return
    useAuthStore.setState({ ...signedOutState, sessionExpiredReason: reason })
    runSessionCleanup()
    authChannel?.postMessage({ type: 'logout', reason } satisfies AuthBroadcast)
  },
})
