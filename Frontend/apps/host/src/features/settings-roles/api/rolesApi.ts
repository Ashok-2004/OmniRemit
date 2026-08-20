import { env } from '../../../config/env'
import { apiFetch } from '../../../shared/api/httpClient'
import type { PagedResult } from '../../settings-users/api/usersApi'
import type { ApprovalPendingDto } from '../../approvals/api/approvalsApi'

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

/** `total` is the real full count even when `items` is capped, so the UI can say "showing N of M" honestly. */
export interface RoleUsersDto {
  items: RoleUserDto[]
  total: number
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

  // Widened for Maker-Checker: 202 (ApprovalPendingDto) when the "Roles" module has a checker
  // assigned; the real result otherwise, identical to before. Callers must branch with isApprovalPending().
  create: (accessToken: string, body: UpsertRoleRequest) =>
    apiFetch<RoleDetailDto | ApprovalPendingDto>(`${base}/api/roles`, { method: 'POST', accessToken, body }),

  update: (accessToken: string, id: string, body: UpsertRoleRequest) =>
    apiFetch<RoleDetailDto | ApprovalPendingDto>(`${base}/api/roles/${id}`, { method: 'PUT', accessToken, body }),

  remove: (accessToken: string, id: string) =>
    apiFetch<ApprovalPendingDto | undefined>(`${base}/api/roles/${id}`, { method: 'DELETE', accessToken }),

  /**
   * Users assigned to a role. Capped server-side (the endpoint used to return every member
   * unbounded), so `total` is the real count and `items` may be a prefix of it.
   */
  users: (accessToken: string, id: string) => apiFetch<RoleUsersDto>(`${base}/api/roles/${id}/users`, { accessToken }),
}
