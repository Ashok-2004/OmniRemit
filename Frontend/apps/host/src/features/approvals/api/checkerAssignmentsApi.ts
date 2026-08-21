import { env } from '../../../config/env'
import { apiFetch } from '../../../shared/api/httpClient'

const base = env.authServiceUrl

/** One module the Checker Assignment UI may offer a checker for — AuthService's own Users/Roles, or a
 * live PermissionFeature.Key from any registered remote app. Sourced from the same dynamic capability
 * catalog the Role editor renders, so a new remote app's module shows up here the moment it
 * registers/syncs — no code change, here or in AuthService, when a future remote app is added. */
export interface AssignableModuleDto {
  key: string
  label: string
}

export interface CheckerAssignmentDto {
  id: string
  module: string
  checkerUserId: string
  checkerName: string
  createdAt: string
}

export interface UpsertCheckerAssignmentRequest {
  module: string
  checkerUserId: string
}

export const checkerAssignmentsApi = {
  list: (accessToken: string, module?: string) =>
    apiFetch<CheckerAssignmentDto[]>(`${base}/api/checker-assignments${module ? `?module=${encodeURIComponent(module)}` : ''}`, { accessToken }),

  listModules: (accessToken: string) =>
    apiFetch<AssignableModuleDto[]>(`${base}/api/checker-assignments/modules`, { accessToken }),

  upsert: (accessToken: string, body: UpsertCheckerAssignmentRequest) =>
    apiFetch<CheckerAssignmentDto>(`${base}/api/checker-assignments`, { method: 'POST', accessToken, body }),

  remove: (accessToken: string, id: string) =>
    apiFetch<void>(`${base}/api/checker-assignments/${id}`, { method: 'DELETE', accessToken }),
}
