import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

const PROACTIVE_REFRESH_BUFFER_MS = 60_000

/**
 * Mounted once near the app root. Schedules a proactive refresh shortly before the current access
 * token expires, so an active session never has to wait for a failed request before renewing —
 * ensureFreshAccessToken() (called from API clients) is still the fallback if this timer is late.
 */
export function useSilentRefresh() {
  const status = useAuthStore((s) => s.status)
  const expiresAt = useAuthStore((s) => s.accessTokenExpiresAt)

  useEffect(() => {
    if (status !== 'authenticated' || !expiresAt) {
      return
    }

    const delay = Math.max(expiresAt - Date.now() - PROACTIVE_REFRESH_BUFFER_MS, 0)
    const timer = window.setTimeout(() => {
      useAuthStore.getState().ensureFreshAccessToken().catch(() => {
        // ensureFreshAccessToken already moves the store to 'unauthenticated' on failure — the
        // route guard picks that up and redirects to /login, nothing else to do here.
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [status, expiresAt])
}
