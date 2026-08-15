import { env } from '../../config/env'
import { apiFetch } from './httpClient'

const base = env.moduleRegistryUrl

/**
 * Reachability of a remote app, as last observed by ModuleRegistry's background probe.
 * 'Unknown' means "not probed yet" and is rendered neutrally — never as a failure.
 */
export type RemoteAppHealth = 'Unknown' | 'Healthy' | 'Unreachable'

export interface SidebarAppDto {
  key: string
  displayName: string
  iconKey: string | null
  manifestUrl: string
  sidebarOrder: number
  status: 'Active' | 'Maintenance' | 'Disabled'
  maintenanceMessage: string | null
  health: RemoteAppHealth
  lastHealthCheckAt: string | null
}

export interface HealthEntryDto {
  key: string
  displayName: string
  health: RemoteAppHealth
  lastCheckedAt: string | null
  error: string | null
}

/** Raw calls against ModuleRegistry's public surface. Admin CRUD calls (Setup > Applications) live in features/settings-applications/api. */
export const moduleRegistryClient = {
  forSidebar: (accessToken: string) => apiFetch<SidebarAppDto[]>(`${base}/api/remote-apps/for-sidebar`, { accessToken }),
  health: (accessToken: string) => apiFetch<HealthEntryDto[]>(`${base}/api/remote-apps/health`, { accessToken }),
}
