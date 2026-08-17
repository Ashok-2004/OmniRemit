import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../auth/store/authStore'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { queryKeys } from '../../../shared/query/queryKeys'
import { Input } from '../../../shared/components/Input/Input'
import { Button } from '../../../shared/components/Button/Button'
import { Badge, type BadgeTone } from '../../../shared/components/Badge/Badge'
import { Table } from '../../../shared/components/Table/Table'
import { SkeletonBlock, SkeletonTable } from '../../../shared/components/Skeleton'
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

function toMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Could not load audit logs.'
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

  const [exportError, setExportError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>(TAB_IDS.loginErrors)
  const [dateRange, setDateRange] = useState<DateRangePreset>('week')
  const [page, setPage] = useState(1)
  const [service, setService] = useState('')

  const [exporting, setExporting] = useState(false)
  const [selectedFailure, setSelectedFailure] = useState<AuditLogDto | null>(null)

  const range = useMemo(() => computeRange(dateRange), [dateRange])

  // Debounced so typing a service name doesn't fire one request per keystroke. The input stays fully
  // controlled by `service`, so it never feels laggy — only the query is delayed.
  const debouncedService = useDebouncedValue(service, 300)

  const summaryQuery = useQuery({
    queryKey: queryKeys.auditLogs.summary(range),
    queryFn: () => auditLogsApi.summary(accessToken!, range),
    enabled: Boolean(accessToken),
  })

  /**
   * THE FIX for the reported "wrong tab's rows flash before the right ones" bug.
   *
   * `tab` is part of the query key, so each tab reads its OWN cache entry. Previously all three tabs
   * shared a single `logs` state that was only ever written, never reset — so switching tab
   * re-rendered instantly with the PREVIOUS tab's rows underneath the NEW tab's column headers, and
   * only corrected itself when the network came back. That was deterministic, not a race.
   *
   * `placeholderData` is deliberately NOT set: keeping previous data is exactly the behaviour that
   * caused the bug. An unfetched tab shows its skeleton, which is honest.
   */
  const logsQuery = useQuery({
    queryKey: queryKeys.auditLogs.list({
      tab: activeTab,
      page,
      pageSize: PAGE_SIZE,
      service: debouncedService || undefined,
      ...range,
    }),
    queryFn: () =>
      auditLogsApi.list(accessToken!, {
        page,
        pageSize: PAGE_SIZE,
        service: debouncedService || undefined,
        action: TAB_ACTION_FILTER[activeTab],
        ...range,
      }),
    enabled: Boolean(accessToken),
  })

  const summary: AuditLogSummaryDto | undefined = summaryQuery.data
  const logs = logsQuery.data?.items
  const total = logsQuery.data?.total ?? 0
  const error = exportError ?? (logsQuery.isError ? toMessage(logsQuery.error) : null)

  /**
   * Page is reset here, in the handlers, rather than in an effect.
   *
   * The old code reset it in a `useEffect` registered AFTER the fetch effect, so every tab/filter
   * change fired TWO requests — one with the stale page, then one with page 1 — and with no
   * cancellation the stale-page response could land second and win.
   */
  function selectTab(key: TabId) {
    setActiveTab(key)
    setPage(1)
  }

  function selectDateRange(key: DateRangePreset) {
    setDateRange(key)
    setPage(1)
  }

  function updateServiceFilter(value: string) {
    setService(value)
    setPage(1)
  }

  async function handleExport() {
    if (!accessToken) return
    setExporting(true)
    setExportError(null)
    try {
      await auditLogsApi.exportCsv(accessToken, {
        service: service || undefined,
        action: TAB_ACTION_FILTER[activeTab],
        ...range,
      })
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Could not export audit logs.')
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
              onClick={() => selectDateRange(r.key)}
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
            <span className={styles.summaryValue}>{summaryQuery.isPending ? <SkeletonBlock height={28} width={60} /> : (summary?.loginSuccesses?.toLocaleString() ?? "—")}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon} aria-hidden="true">⚠</span>
          <div>
            <span className={styles.summaryLabel}>Login Errors</span>
            <span className={styles.summaryValue}>{summaryQuery.isPending ? <SkeletonBlock height={28} width={60} /> : (summary?.loginErrors?.toLocaleString() ?? "—")}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon} aria-hidden="true">📄</span>
          <div>
            <span className={styles.summaryLabel}>Audit Events</span>
            <span className={styles.summaryValue}>{summaryQuery.isPending ? <SkeletonBlock height={28} width={60} /> : (summary?.totalAuditEvents?.toLocaleString() ?? "—")}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon} aria-hidden="true">👥</span>
          <div>
            <span className={styles.summaryLabel}>Active Users</span>
            <span className={styles.summaryValue}>{summaryQuery.isPending ? <SkeletonBlock height={28} width={60} /> : (summary?.activeUsers?.toLocaleString() ?? "—")}</span>
          </div>
        </div>
      </div>

      <Tabs id="audit-logs-tabs" tabs={tabs} activeKey={activeTab} onChange={(key) => selectTab(key as TabId)} />

      <div className={styles.toolbar}>
        <Input
          className={styles.filterInput}
          placeholder="Filter by service (e.g. AuthService)…"
          value={service}
          onChange={(e) => updateServiceFilter(e.target.value)}
        />
        <div className={styles.toolbarActions}>
          <Button
            variant="secondary"
            loading={logsQuery.isFetching}
            onClick={() => {
              void logsQuery.refetch()
              void summaryQuery.refetch()
            }}
          >
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
          {/*
            Skeleton whenever this tab's own data isn't loaded yet — including the very first visit
            to a tab. There is no shared `logs` slot any more, so another tab's rows can never appear
            here while this one loads.
          */}
          {logs === undefined ? (
            <SkeletonTable rows={8} columns={isLoginTab ? 7 : 6} />
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
                    {/* Must match the header count for this tab, or the empty row spills past the table. */}
                    <td colSpan={activeTab === TAB_IDS.loginErrors ? 7 : 6} className={styles.emptyCell}>
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
