import { env } from '../../../config/env'
import { apiFetch } from '../../../shared/api/httpClient'

const base = env.authServiceUrl

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type AuthProviderValue = 'Local' | 'Google'

export interface UserListItemDto {
  id: string
  name: string
  email: string
  phoneNumber: string | null
  roleId: string | null
  roleName: string | null
  isAdministrator: boolean
  isActive: boolean
  lastLoginAt: string | null
  authProvider: AuthProviderValue
}

export interface PermissionOverrideDto {
  featureKey: string
  capability: string
  effect: 'Grant' | 'Revoke'
}

export interface UserDetailDto {
  id: string
  name: string
  email: string
  phoneNumber: string | null
  roleId: string | null
  roleName: string | null
  isAdministrator: boolean
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  permissionOverrides: PermissionOverrideDto[]
  authProvider: AuthProviderValue
}

/** authProvider defaults "Local" and is immutable after creation — see the backend DTO's doc comment. */
export interface CreateUserRequest {
  name: string
  email: string
  phoneNumber?: string | null
  roleId?: string | null
  isActive?: boolean
  authProvider?: AuthProviderValue
}

/** Null for Google-provisioned accounts — there's no local password to show. */
export interface CreateUserResponse {
  user: UserDetailDto
  temporaryPassword: string | null
}

export interface UpdateUserRequest {
  name: string
  email: string
  phoneNumber?: string | null
  roleId?: string | null
  /**
   * Whether the account may sign in.
   *
   * The edit form has always shown an "Account is Active" toggle, but neither this type nor the
   * server's UpdateUserRequest carried the field — so the toggle moved, the form saved, and the status
   * silently did not change. Status is edited here rather than from a list row, so this is the field
   * that actually applies it.
   */
  isActive: boolean
}

export interface ListUsersParams {
  page?: number
  pageSize?: number
  search?: string
  isActive?: boolean
  roleId?: string
}

function buildQuery(params: object) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params) as [string, string | number | boolean | undefined][]) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const usersApi = {
  list: (accessToken: string, params: ListUsersParams = {}) =>
    apiFetch<PagedResult<UserListItemDto>>(`${base}/api/users${buildQuery(params)}`, { accessToken }),

  get: (accessToken: string, id: string) => apiFetch<UserDetailDto>(`${base}/api/users/${id}`, { accessToken }),

  create: (accessToken: string, body: CreateUserRequest) =>
    apiFetch<CreateUserResponse>(`${base}/api/users`, { method: 'POST', accessToken, body }),

  update: (accessToken: string, id: string, body: UpdateUserRequest) =>
    apiFetch<UserDetailDto>(`${base}/api/users/${id}`, { method: 'PUT', accessToken, body }),

  updateStatus: (accessToken: string, id: string, isActive: boolean) =>
    apiFetch<UserDetailDto>(`${base}/api/users/${id}/status`, { method: 'PATCH', accessToken, body: { isActive } }),

  remove: (accessToken: string, id: string) => apiFetch<void>(`${base}/api/users/${id}`, { method: 'DELETE', accessToken }),

  getOverrides: (accessToken: string, id: string) =>
    apiFetch<PermissionOverrideDto[]>(`${base}/api/users/${id}/permission-overrides`, { accessToken }),

  replaceOverrides: (accessToken: string, id: string, overrides: PermissionOverrideDto[]) =>
    apiFetch<PermissionOverrideDto[]>(`${base}/api/users/${id}/permission-overrides`, {
      method: 'PUT',
      accessToken,
      body: { overrides },
    }),
}
