import { env } from '../../../config/env'
import { apiFetch } from '../../../shared/api/httpClient'
import type { PagedResult } from '../../settings-users/api/usersApi'

const base = env.moduleRegistryUrl

export type RemoteAppStatus = 'Active' | 'Maintenance' | 'Disabled'

export interface CapabilityDto {
  key: string
  displayName: string
}

export interface RemoteAppDto {
  id: string
  key: string
  displayName: string
  iconKey: string | null
  manifestUrl: string
  sidebarOrder: number
  status: RemoteAppStatus
  maintenanceMessage: string | null
  permissionFeatureKey: string
  permissionsSourceUrl: string | null
  capabilities: CapabilityDto[]
  /**
   * Last observed reachability from ModuleRegistry's background manifest probe. 'Unknown' means not
   * probed yet and is rendered neutrally — never as a failure.
   */
  health: 'Unknown' | 'Healthy' | 'Unreachable'
  lastHealthCheckAt: string | null
  lastHealthError: string | null
  /** Module Federation container name read from the built manifest. Null until first probed. */
  containerName: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRemoteAppRequest {
  key: string
  displayName: string
  iconKey?: string | null
  manifestUrl: string
  permissionsSourceUrl?: string | null
  sidebarOrder?: number
}

export interface UpdateRemoteAppRequest {
  displayName: string
  iconKey?: string | null
  manifestUrl: string
  permissionsSourceUrl?: string | null
  sidebarOrder: number
}

export interface ListRemoteAppsParams {
  page?: number
  pageSize?: number
  search?: string
}

function buildQuery(params: object) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params) as [string, string | number | boolean | undefined][]) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const remoteAppsApi = {
  list: (accessToken: string, params: ListRemoteAppsParams = {}) =>
    apiFetch<PagedResult<RemoteAppDto>>(`${base}/api/remote-apps${buildQuery(params)}`, { accessToken }),

  get: (accessToken: string, id: string) => apiFetch<RemoteAppDto>(`${base}/api/remote-apps/${id}`, { accessToken }),

  create: (accessToken: string, body: CreateRemoteAppRequest) =>
    apiFetch<RemoteAppDto>(`${base}/api/remote-apps`, { method: 'POST', accessToken, body }),

  update: (accessToken: string, id: string, body: UpdateRemoteAppRequest) =>
    apiFetch<RemoteAppDto>(`${base}/api/remote-apps/${id}`, { method: 'PUT', accessToken, body }),

  updateStatus: (accessToken: string, id: string, status: RemoteAppStatus, maintenanceMessage?: string | null) =>
    apiFetch<RemoteAppDto>(`${base}/api/remote-apps/${id}/status`, {
      method: 'PATCH',
      accessToken,
      body: { status, maintenanceMessage },
    }),

  remove: (accessToken: string, id: string) =>
    apiFetch<void>(`${base}/api/remote-apps/${id}`, { method: 'DELETE', accessToken }),

  resyncPermissions: (accessToken: string) =>
    apiFetch<{ resyncedCount: number }>(`${base}/api/remote-apps/resync-permissions`, { method: 'POST', accessToken }),
}
