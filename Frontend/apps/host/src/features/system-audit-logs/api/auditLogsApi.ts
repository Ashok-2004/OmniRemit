import { env } from '../../../config/env'
import { apiFetch } from '../../../shared/api/httpClient'
import type { PagedResult } from '../../settings-users/api/usersApi'

const base = env.authServiceUrl

export interface AuditLogDto {
  id: string
  occurredAt: string
  serviceName: string
  actorUserId: string | null
  actorName: string | null
  action: string
  entityType: string | null
  entityId: string | null
  details: string | null
}

export interface ListAuditLogsParams {
  page?: number
  pageSize?: number
  service?: string
  action?: string
  from?: string
  to?: string
}

function buildQuery(params: object) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params) as [string, string | number | boolean | undefined][]) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const auditLogsApi = {
  list: (accessToken: string, params: ListAuditLogsParams = {}) =>
    apiFetch<PagedResult<AuditLogDto>>(`${base}/api/audit-logs${buildQuery(params)}`, { accessToken }),
}
