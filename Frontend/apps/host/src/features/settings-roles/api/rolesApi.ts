import { env } from '../../../config/env'
import { apiFetch } from '../../../shared/api/httpClient'
import type { PagedResult } from '../../settings-users/api/usersApi'

const base = env.authServiceUrl

export interface RoleListItemDto {
  id: string
  name: string
  description: string | null
  isSystemRole: boolean
  isAdministrator: boolean
  usersCount: number
  permissionsCount: number
  createdAt: string
}

export interface RolePermissionGrantDto {
  featureKey: string
  capability: string
}

export interface RoleDetailDto {
  id: string
  name: string
  description: string | null
  isSystemRole: boolean
  isAdministrator: boolean
  permissions: RolePermissionGrantDto[]
  createdAt: string
  updatedAt: string
}

export interface UpsertRoleRequest {
  name: string
  description?: string | null
  isAdministrator: boolean
  permissions: RolePermissionGrantDto[]
}

export interface RoleUserDto {
  id: string
  name: string
  email: string
}

export interface ListRolesParams {
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

export const rolesApi = {
  list: (accessToken: string, params: ListRolesParams = {}) =>
    apiFetch<PagedResult<RoleListItemDto>>(`${base}/api/roles${buildQuery(params)}`, { accessToken }),

  get: (accessToken: string, id: string) => apiFetch<RoleDetailDto>(`${base}/api/roles/${id}`, { accessToken }),

  create: (accessToken: string, body: UpsertRoleRequest) =>
    apiFetch<RoleDetailDto>(`${base}/api/roles`, { method: 'POST', accessToken, body }),

  update: (accessToken: string, id: string, body: UpsertRoleRequest) =>
    apiFetch<RoleDetailDto>(`${base}/api/roles/${id}`, { method: 'PUT', accessToken, body }),

  remove: (accessToken: string, id: string) => apiFetch<void>(`${base}/api/roles/${id}`, { method: 'DELETE', accessToken }),

  users: (accessToken: string, id: string) => apiFetch<RoleUserDto[]>(`${base}/api/roles/${id}/users`, { accessToken }),
}
