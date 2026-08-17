import { env } from '../../config/env'
import { apiFetch } from './httpClient'

const base = env.authServiceUrl

export interface CapabilityDto {
  key: string
  displayName: string
}

export interface PermissionFeatureDto {
  id: string
  key: string
  displayName: string
  source: 'Host' | 'RemoteApp'
  sortOrder: number
  /** This feature's own declared action set — e.g. Employee only has Create+Edit today. Never a shared global list: what a feature doesn't declare, it can't be granted. */
  capabilities: CapabilityDto[]
}

/** The permission catalog — shared by settings-users (override editor) and settings-roles (matrix editor). Always fetched, never hardcoded; each feature carries its own capability set. */
export const permissionsApi = {
  catalog: (accessToken: string, activeOnly = true) =>
    apiFetch<PermissionFeatureDto[]>(`${base}/api/permissions/catalog?activeOnly=${activeOnly}`, { accessToken }),
}
