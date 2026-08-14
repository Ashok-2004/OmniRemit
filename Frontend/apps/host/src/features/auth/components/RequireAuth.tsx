import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { SkeletonBlock } from '../../../shared/components/Skeleton'
import styles from './RequireAuth.module.css'

/** Gates the authenticated route tree: shows a loading state while hydrate() runs, then redirects to /login if it didn't find a session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'idle' || status === 'hydrating') {
    return (
      <div className={styles.loadingWrapper}>
        <SkeletonBlock height={40} width={240} />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
