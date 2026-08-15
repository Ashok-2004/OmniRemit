import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { Input } from '../../../shared/components/Input/Input'
import { Button } from '../../../shared/components/Button/Button'
import { Badge, type BadgeTone } from '../../../shared/components/Badge/Badge'
import { Table } from '../../../shared/components/Table/Table'
import { SkeletonTable } from '../../../shared/components/Skeleton'
import { Tabs, TabPanel } from '../../../shared/components/Tabs/Tabs'
import { Modal } from '../../../shared/components/Modal/Modal'
import { PermissionGate } from '../../../shared/components/PermissionGate/PermissionGate'
import { ApiError } from '../../../shared/api/httpClient'
import { auditLogsApi, type AuditLogDto, type AuditLogSummaryDto } from '../api/auditLogsApi'
import styles from './AuditLogsPage.module.css'

const FEATURE = 'host.system.audit-logs'
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

type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all'

const DATE_RANGES: { key: DateRangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All' },
]

/** Real from/to ISO bounds for a preset — never a fabricated range, just real Date arithmetic against "now". */
function computeRange(preset: DateRangePreset): { from?: string; to?: string } {
  const now = new Date()
  switch (preset) {
    case 'today': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { from: start.toISOString() }
    }
    case 'yesterday': {
      const start = new Date(now)
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setHours(23, 59, 59, 999)
      return { from: start.toISOString(), to: end.toISOString() }
    }
    case 'week': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { from: start.toISOString() }
    }
    case 'month': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { from: start.toISOString() }
    }
    case 'all':
    default:
      return {}
  }
}

const TAB_IDS = {
  loginErrors: 'login-errors',
  loginSuccesses: 'login-successes',
  auditEvents: 'audit-events',
} as const

type TabId = (typeof TAB_IDS)[keyof typeof TAB_IDS]

const TAB_ACTION_FILTER: Record<TabId, string | undefined> = {
  [TAB_IDS.loginErrors]: 'auth.login_failed',
  [TAB_IDS.loginSuccesses]: 'auth.login_succeeded',
  [TAB_IDS.auditEvents]: undefined,
}

/**
 * Enterprise security & audit module — real login success/failure events (backed by
 * AuthAppService's login-audit writes, see Backend/AuthService) plus the platform-wide CRUD audit
 * trail (host and every remote), summary cards from a real backend aggregate, CSV export, and a
 * failure-details drill-down. Every field shown is real backend data — no fabricated location,
 * device, or failure detail anywhere on this page.
 */
export function AuditLogsPage() {
  const accessToken = useAuthStore((s) => s.accessToken)

  const [activeTab, setActiveTab] = useState<TabId>(TAB_IDS.loginErrors)
  const [dateRange, setDateRange] = useState<DateRangePreset>('week')
  const [page, setPage] = useState(1)
  const [service, setService] = useState('')

  const [summary, setSummary] = useState<AuditLogSummaryDto | null>(null)
  const [logs, setLogs] = useState<AuditLogDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [selectedFailure, setSelectedFailure] = useState<AuditLogDto | null>(null)

  const range = useMemo(() => computeRange(dateRange), [dateRange])

  const loadSummary = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await auditLogsApi.summary(accessToken, range)
      setSummary(result)
    } catch {
      // summary cards are a nice-to-have — leave them blank rather than blocking the table
    }
  }, [accessToken, range])

  const loadLogs = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    try {
      const result = await auditLogsApi.list(accessToken, {
        page,
        pageSize: PAGE_SIZE,
        service: service || undefined,
        action: TAB_ACTION_FILTER[activeTab],
        ...range,
      })
      setLogs(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load audit logs.')
    }
  }, [accessToken, page, service, activeTab, range])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    setPage(1)
  }, [activeTab, dateRange, service])

  async function handleExport() {
    if (!accessToken) return
    setExporting(true)
    setError(null)
    try {
      await auditLogsApi.exportCsv(accessToken, {
        service: service || undefined,
        action: TAB_ACTION_FILTER[activeTab],
        ...range,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export audit logs.')
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const isLoginTab = activeTab === TAB_IDS.loginErrors || activeTab === TAB_IDS.loginSuccesses

  const tabs = [
    { key: TAB_IDS.loginErrors, label: 'Login Errors' },
    { key: TAB_IDS.loginSuccesses, label: 'Login Successes' },
    { key: TAB_IDS.auditEvents, label: 'Audit Events' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Audit Logs</h1>
          <p>Every login attempt and platform action — host and remotes alike.</p>
        </div>
        <div className={styles.dateRangeGroup} role="group" aria-label="Date range">
          {DATE_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={r.key === dateRange ? styles.dateRangeActive : styles.dateRangeButton}
              onClick={() => setDateRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon} aria-hidden="true">✓</span>
          <div>
            <span className={styles.summaryLabel}>Login Successes</span>
            <span className={styles.summaryValue}>{summary?.loginSuccesses ?? '—'}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon} aria-hidden="true">⚠</span>
          <div>
            <span className={styles.summaryLabel}>Login Errors</span>
            <span className={styles.summaryValue}>{summary?.loginErrors ?? '—'}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon} aria-hidden="true">📄</span>
          <div>
            <span className={styles.summaryLabel}>Audit Events</span>
            <span className={styles.summaryValue}>{summary?.totalAuditEvents ?? '—'}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon} aria-hidden="true">👥</span>
          <div>
            <span className={styles.summaryLabel}>Active Users</span>
            <span className={styles.summaryValue}>{summary?.activeUsers ?? '—'}</span>
          </div>
        </div>
      </div>

      <Tabs id="audit-logs-tabs" tabs={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as TabId)} />

      <div className={styles.toolbar}>
        <Input
          className={styles.filterInput}
          placeholder="Filter by service (e.g. AuthService)…"
          value={service}
          onChange={(e) => setService(e.target.value)}
        />
        <div className={styles.toolbarActions}>
          <Button variant="secondary" onClick={() => void loadLogs()}>
            Refresh
          </Button>
          <PermissionGate featureKey={FEATURE} capability="Export">
            <Button variant="secondary" onClick={() => void handleExport()} loading={exporting}>
              Export CSV
            </Button>
          </PermissionGate>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {[TAB_IDS.loginErrors, TAB_IDS.loginSuccesses, TAB_IDS.auditEvents].map((tabId) => (
        <TabPanel key={tabId} id="audit-logs-tabs" tabId={tabId} active={activeTab === tabId}>
          {logs === null ? (
            <SkeletonTable rows={8} columns={isLoginTab ? 6 : 6} />
          ) : (
            <Table>
              <thead>
                {isLoginTab ? (
                  <tr>
                    <th>Time</th>
                    <th>Actor / Email</th>
                    <th>Auth Method</th>
                    <th>IP Address</th>
                    <th>Browser / Device</th>
                    <th>Result</th>
                    {activeTab === TAB_IDS.loginErrors && <th aria-label="Actions" />}
                  </tr>
                ) : (
                  <tr>
                    <th>Time</th>
                    <th>Service</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className={styles.emptyCell}>
                      No entries match these filters.
                    </td>
                  </tr>
                )}
                {logs.map((log) =>
                  isLoginTab ? (
                    <tr key={log.id}>
                      <td className={styles.timeCell}>{formatTimestamp(log.occurredAt)}</td>
                      <td>{log.actorName ?? <span className={styles.mutedText}>Unknown</span>}</td>
                      <td>{log.authMethod ?? <span className={styles.mutedText}>—</span>}</td>
                      <td className={styles.monoText}>{log.sourceIp ?? '—'}</td>
                      <td className={styles.deviceCell} title={log.userAgent ?? undefined}>
                        {log.userAgent ?? '—'}
                      </td>
                      <td>
                        <Badge tone={log.result === 'Success' ? 'success' : 'danger'} dot>
                          {log.result}
                        </Badge>
                      </td>
                      {activeTab === TAB_IDS.loginErrors && (
                        <td>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedFailure(log)}>
                            View Details
                          </Button>
                        </td>
                      )}
                    </tr>
                  ) : (
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
                  ),
                )}
              </tbody>
            </Table>
          )}
        </TabPanel>
      ))}

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

      <Modal open={Boolean(selectedFailure)} title="Login failure details" onClose={() => setSelectedFailure(null)}>
        {selectedFailure && (
          <dl className={styles.detailList}>
            <dt>Time</dt>
            <dd>{formatTimestamp(selectedFailure.occurredAt)}</dd>
            <dt>Attempted account</dt>
            <dd>{selectedFailure.actorName ?? '—'}</dd>
            <dt>Auth provider</dt>
            <dd>{selectedFailure.authMethod ?? '—'}</dd>
            <dt>Failure reason</dt>
            <dd>{selectedFailure.failureReason ?? '—'}</dd>
            <dt>IP address</dt>
            <dd className={styles.monoText}>{selectedFailure.sourceIp ?? '—'}</dd>
            <dt>Browser / device</dt>
            <dd className={styles.wrapText}>{selectedFailure.userAgent ?? '—'}</dd>
            <dt>Correlation ID</dt>
            <dd className={styles.monoText}>{selectedFailure.correlationId}</dd>
          </dl>
        )}
      </Modal>
    </div>
  )
}
