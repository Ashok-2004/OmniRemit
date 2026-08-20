import { env } from '../../../config/env'
import { apiFetch } from '../../../shared/api/httpClient'

const base = env.authServiceUrl

/**
 * Every module key the Checker Assignment UI can list. Mirrors AuthService's ApprovalModuleKeys —
 * only Users/Roles are actually enforced in Phase 1; the rest exist so the admin can see the full
 * picture of the platform from day one, marked "not yet enforced" until their host/remote-app code
 * calls the shared submission helper in a later phase.
 */
export const APPROVAL_MODULES = [
  { key: 'Users', label: 'Users', enforced: true },
  { key: 'Roles', label: 'Roles', enforced: true },
  { key: 'Applications', label: 'Applications', enforced: false },
  { key: 'Customer360.FieldConfig', label: 'Customer 360 — Field Settings', enforced: false },
  { key: 'LeadManagement.Config', label: 'Lead Management — Config', enforced: false },
] as const

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

  upsert: (accessToken: string, body: UpsertCheckerAssignmentRequest) =>
    apiFetch<CheckerAssignmentDto>(`${base}/api/checker-assignments`, { method: 'POST', accessToken, body }),

  remove: (accessToken: string, id: string) =>
    apiFetch<void>(`${base}/api/checker-assignments/${id}`, { method: 'DELETE', accessToken }),
}
