import { useAuthStore } from '../../features/auth/store/authStore'
import { env } from '../../config/env'

/**
 * The host's public runtime contract for every remote app. Deliberately NOT passed as React props —
 * loadRemoteAppModule renders `<LazyRemote />` with zero props (see remoteLoader.ts), and a remote
 * can mount long after login, or stay mounted across a token refresh. A global, live-read bridge
 * means a remote always reads the CURRENT access token/permissions at call time, never a stale
 * snapshot from whenever it happened to mount. Every remote app (Employee and any future one) uses
 * this instead of managing its own login/permission-check flow — see the host README's "Contract
 * for future remote apps" for the equivalent Module Federation contract.
 */
export interface OmniRemitHostBridge {
  /** Current in-memory access token, or null if not authenticated. Never persisted — see authStore's doc comment on why. */
  getAccessToken: () => string | null
  /** Same dedup'd refresh-then-return-token flow the host's own pages use before a mutation. Prefer this over getAccessToken() right before an API call, in case the token expired while the remote's UI (e.g. a modal) sat open. */
  ensureFreshAccessToken: () => Promise<string>
  /** Mirrors authStore's own capability check — administrators always true, everyone else checked against the JWT's cached `perms` claim. No network call. */
  hasCapability: (featureKey: string, capability: string) => boolean
  getUser: () => { id: string; name: string; email: string; isAdministrator: boolean } | null
  /** Base URLs so a remote's own API client doesn't have to guess or hardcode the host's environment. */
  apiBaseUrls: {
    authService: string
  }
}

declare global {
  interface Window {
    __omniremitHost__?: OmniRemitHostBridge
  }
}

/** Called once at boot (see main.tsx), before any remote can possibly load. */
export function installHostBridge() {
  window.__omniremitHost__ = {
    getAccessToken: () => useAuthStore.getState().accessToken,
    ensureFreshAccessToken: () => useAuthStore.getState().ensureFreshAccessToken(),
    hasCapability: (featureKey, capability) => useAuthStore.getState().hasCapability(featureKey, capability),
    getUser: () => {
      const user = useAuthStore.getState().user
      return user ? { id: user.id, name: user.name, email: user.email, isAdministrator: user.isAdministrator } : null
    },
    apiBaseUrls: {
      authService: env.authServiceUrl,
    },
  }
}
