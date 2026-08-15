import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { Input } from '../../../shared/components/Input/Input'
import { Button } from '../../../shared/components/Button/Button'
import { Badge, type BadgeTone } from '../../../shared/components/Badge/Badge'
import { Table } from '../../../shared/components/Table/Table'
import { SkeletonTable } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { auditLogsApi, type AuditLogDto } from '../api/auditLogsApi'
import styles from './AuditLogsPage.module.css'

const PAGE_SIZE = 25

const SERVICE_TONES: Record<string, BadgeTone> = {
  AuthService: 'primary',
  ModuleRegistry: 'info',
  EmployeeService: 'warning',
}

function serviceTone(serviceName: string): BadgeTone {
  return SERVICE_TONES[serviceName] ?? 'neutral'
}

function formatTimestamp(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/**
 * Central audit trail — every major action from the host AND every registered remote app, all
 * written to AuthService's single AuditLogs table so this one page is the whole platform's record.
 * See AuthService/Controllers/InternalAuditLogsController for how remotes push into it.
 */
export function AuditLogsPage() {
  const accessToken = useAuthStore((s) => s.accessToken)

  const [logs, setLogs] = useState<AuditLogDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [service, setService] = useState('')
  const [action, setAction] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    try {
      const result = await auditLogsApi.list(accessToken, {
        page,
        pageSize: PAGE_SIZE,
        service: service || undefined,
        action: action || undefined,
      })
      setLogs(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load audit logs.')
    }
  }, [accessToken, page, service, action])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Audit Logs</h1>
        <p>Every user, role, and remote-app action across the whole platform — host and remotes alike.</p>
      </div>

      <div className={styles.toolbar}>
        <Input
          className={styles.filterInput}
          placeholder="Filter by service (e.g. AuthService)…"
          value={service}
          onChange={(e) => {
            setPage(1)
            setService(e.target.value)
          }}
        />
        <Input
          className={styles.filterInput}
          placeholder="Filter by action (e.g. user.created)…"
          value={action}
          onChange={(e) => {
            setPage(1)
            setAction(e.target.value)
          }}
        />
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {logs === null ? (
        <SkeletonTable rows={8} columns={6} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Service</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No audit entries match these filters.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td className={styles.timeCell}>{formatTimestamp(log.occurredAt)}</td>
                <td>
                  <Badge tone={serviceTone(log.serviceName)}>{log.serviceName}</Badge>
                </td>
                <td>{log.actorName ?? <span className={styles.mutedText}>System</span>}</td>
                <td className={styles.actionCell}>{log.action}</td>
                <td className={styles.mutedText}>
                  {log.entityType ? `${log.entityType}${log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}` : '—'}
                </td>
                <td className={styles.detailsCell} title={log.details ?? undefined}>
                  {log.details ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {total > PAGE_SIZE && (
        <div className={styles.pagination}>
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
