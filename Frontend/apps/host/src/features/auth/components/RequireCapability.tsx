import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export interface RequireCapabilityProps {
  featureKey: string
  capability?: string
  children: ReactNode
}

/** Route-level permission gate — SetupPanel already hides links the user can't use, this stops direct URL access too. */
export function RequireCapability({ featureKey, capability = 'View', children }: RequireCapabilityProps) {
  const allowed = useAuthStore((s) => Boolean(s.user?.isAdministrator) || s.hasCapability(featureKey, capability))
  return allowed ? <>{children}</> : <Navigate to="/404" replace />
}
