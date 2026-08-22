import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { AppShellSkeleton } from '../../../shared/components/AppShellSkeleton/AppShellSkeleton'

/** Gates the authenticated route tree: shows a loading state while hydrate() runs, then redirects to /login if it didn't find a session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'idle' || status === 'hydrating') {
    return <AppShellSkeleton />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
