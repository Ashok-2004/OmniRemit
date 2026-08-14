import { env } from '../../config/env'
import { apiFetch } from './httpClient'

const base = env.moduleRegistryUrl

export interface SidebarAppDto {
  key: string
  displayName: string
  iconKey: string | null
  manifestUrl: string
  sidebarOrder: number
  status: 'Active' | 'Maintenance' | 'Disabled'
  maintenanceMessage: string | null
}

/** Raw calls against ModuleRegistry's public surface. Admin CRUD calls (Setup > Maintenance) live in features/settings-maintenance/api. */
export const moduleRegistryClient = {
  forSidebar: (accessToken: string) => apiFetch<SidebarAppDto[]>(`${base}/api/remote-apps/for-sidebar`, { accessToken }),
}
