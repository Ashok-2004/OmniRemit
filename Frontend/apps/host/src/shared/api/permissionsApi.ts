import { env } from '../../config/env'
import { apiFetch } from './httpClient'

const base = env.authServiceUrl

export interface PermissionFeatureDto {
  id: string
  key: string
  displayName: string
  source: 'Host' | 'RemoteApp'
  sortOrder: number
}

/** The permission catalog and capability list — shared by settings-users (override editor) and settings-roles (matrix editor). Always fetched, never hardcoded. */
export const permissionsApi = {
  catalog: (accessToken: string, activeOnly = true) =>
    apiFetch<PermissionFeatureDto[]>(`${base}/api/permissions/catalog?activeOnly=${activeOnly}`, { accessToken }),

  capabilities: (accessToken: string) => apiFetch<string[]>(`${base}/api/permissions/capabilities`, { accessToken }),
}
