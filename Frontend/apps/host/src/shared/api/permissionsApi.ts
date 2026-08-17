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
  /**
   * Sub-modules of this feature, each grantable in its own right with its own capability set — e.g.
   * Employee Management -> Employee / Department.
   *
   * This field was missing from the type while the API had been returning it for some time, so every
   * editor was blind to sub-modules and instead offered the PARENT key. For an app like
   * `remote.employee`, whose parent declares no capabilities at all, that produced grants such as
   * `remote.employee:View` which the server rejects with
   * "'remote.employee' does not declare a 'View' capability."
   *
   * Empty for host features and for any remote still reporting the flat discovery contract.
   */
  children: PermissionFeatureDto[]
}

/** The permission catalog — shared by settings-users (override editor) and settings-roles (matrix editor). Always fetched, never hardcoded; each feature carries its own capability set. */
export const permissionsApi = {
  catalog: (accessToken: string, activeOnly = true) =>
    apiFetch<PermissionFeatureDto[]>(`${base}/api/permissions/catalog?activeOnly=${activeOnly}`, { accessToken }),
}
