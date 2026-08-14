import { create } from 'zustand'
import { ApiError } from '../../../shared/api/httpClient'
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

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Attempts to restore a session from the httpOnly refresh cookie on app boot, without a full login. */
  hydrate: () => Promise<void>
  /** Returns a valid access token, refreshing first if it's missing or close to expiry. Throws if refresh fails (caller should treat as logged out). */
  ensureFreshAccessToken: () => Promise<string>
  hasCapability: (featureKey: string, capability: string) => boolean
}

const REFRESH_SKEW_MS = 30_000

// The refresh-token cookie is rotated server-side on every use (RefreshTokenService.RotateAsync) —
// a second concurrent call presenting the same now-already-rotated cookie is indistinguishable
// from token theft and trips reuse detection, which revokes the whole session (see AuthController).
// React 19 StrictMode double-invokes mount effects in dev (so useSilentRefresh/AppRoutes' hydrate()
// can genuinely fire twice), and in production two components could just as easily race a call to
// ensureFreshAccessToken() at the same time — so every caller here shares one in-flight refresh
// request instead of firing a duplicate one.
let inFlightRefresh: Promise<RefreshResponse> | null = null

function refreshOnce(): Promise<RefreshResponse> {
  if (!inFlightRefresh) {
    inFlightRefresh = authServiceClient.refresh().finally(() => {
      inFlightRefresh = null
    })
  }
  return inFlightRefresh
}

function applySession(session: { accessToken: string; expiresAt: string; user: CurrentUserDto }) {
  return {
    user: session.user,
    accessToken: session.accessToken,
    accessTokenExpiresAt: new Date(session.expiresAt).getTime(),
    status: 'authenticated' as const,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  loginLoading: false,
  loginError: null,

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

  async logout() {
    try {
      await authServiceClient.logout()
    } catch {
      // best-effort — the client-side session is cleared either way
    }
    set({ status: 'unauthenticated', user: null, accessToken: null, accessTokenExpiresAt: null })
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
        set({ status: 'unauthenticated', user: null, accessToken: null, accessTokenExpiresAt: null })
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
        set({ status: 'unauthenticated', user: null, accessToken: null, accessTokenExpiresAt: null })
      }
      throw err
    }
  },

  hasCapability(featureKey, capability) {
    const user = get().user
    if (!user) return false
    if (user.isAdministrator) return true
    return user.permissions.includes(`${featureKey}:${capability}`)
  },
}))
