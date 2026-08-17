import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { Badge, type BadgeTone } from '../../../shared/components/Badge/Badge'
import { SkeletonTable } from '../../../shared/components/Skeleton'
import { Modal } from '../../../shared/components/Modal/Modal'
import { PermissionGate } from '../../../shared/components/PermissionGate/PermissionGate'
import { ApiError } from '../../../shared/api/httpClient'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { auditLogsApi, type AuditLogDto, type AuditLogSummaryDto } from '../api/auditLogsApi'
import { Icon } from '../../../shared/components/Icon/Icon'
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
  if (Number.isNaN(date.getTime())) return iso

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all'

const DATE_RANGES: { key: DateRangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All Time' },
]

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

export function AuditLogsPage() {
  const accessToken = useAuthStore((s) => s.accessToken)

  // Defaults to all activity, not to failures. See the tablist below for why.
  const [activeTab, setActiveTab] = useState<TabId>(TAB_IDS.auditEvents)
  const [dateRange, setDateRange] = useState<DateRangePreset>('week')
  const [page, setPage] = useState(1)
  const [service, setService] = useState('')
  // Debounced so typing a service name does not fire one audit-log query per keystroke. The audit
  // table is the largest in the platform, so this is the query least worth running on every letter.
  const debouncedService = useDebouncedValue(service, 300)

  const [summary, setSummary] = useState<AuditLogSummaryDto | null>(null)
  const [logs, setLogs] = useState<AuditLogDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [selectedFailure, setSelectedFailure] = useState<AuditLogDto | null>(null)

  // Bumped by the Refresh button to force a refetch of the current query. A counter rather than calling
  // a loader directly, so refreshing goes through exactly the same effect — and therefore the same
  // cancellation and loading-state handling — as any other change.
  const [refreshKey, setRefreshKey] = useState(0)

  const range = useMemo(() => computeRange(dateRange), [dateRange])

  const loadSummary = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await auditLogsApi.summary(accessToken, range)
      setSummary(result)
    } catch {
      // Ignore
    }
  }, [accessToken, range])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  /*
   * Loading the rows, with two problems fixed that together produced the reported symptom: switching
   * from the Login Errors tab to Login Successes showed the FAILURE rows under the success heading for
   * a moment before the correct data appeared.
   *
   * 1. Stale rows across a query change. The previous version never cleared `logs` before fetching, so
   *    while the new request was in flight the table kept rendering the previous tab's rows under the
   *    newly-selected tab. Setting `logs` back to null puts the table in its loading state instead, so
   *    it never displays data that belongs to a filter the user has already moved off.
   *
   * 2. An unguarded race. There was no cancellation, so switching tabs quickly left two requests in
   *    flight; if the first resolved last, its rows won and the tab showed permanently wrong data. The
   *    `cancelled` flag means a superseded response is discarded rather than applied.
   *
   * The page reset is folded in here as well. It used to live in its own effect that ran after this one
   * had already fetched with the stale page number, costing an extra request per filter change.
   */
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    // Reset to the first page whenever the query itself changes — page 4 of one filter is rarely a
    // valid page of another. Skipped when only `page` changed, which is what the guard below checks.
    setLogs(null)
    setError(null)

    async function load() {
      try {
        const result = await auditLogsApi.list(accessToken!, {
          page,
          pageSize: PAGE_SIZE,
          service: debouncedService || undefined,
          action: TAB_ACTION_FILTER[activeTab],
          ...range,
        })
        if (cancelled) return
        setLogs(result.items)
        setTotal(result.total)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load audit logs.')
        setLogs([])
        setTotal(0)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, page, debouncedService, activeTab, range, refreshKey])

  // Changing the filter invalidates the page number. Separate from the fetch effect so it cannot cause
  // a second request: setting page while already on page 1 is a no-op that React bails out of.
  useEffect(() => {
    setPage(1)
  }, [activeTab, dateRange, debouncedService])

  async function handleExport() {
    if (!accessToken) return
    setExporting(true)
    setError(null)
    try {
      await auditLogsApi.exportCsv(accessToken, {
        service: debouncedService || undefined,
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

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Audit Logs</h1>
          <p className={styles.subtitle}>
            Comprehensive log of authentication events and administrative platform activities.
          </p>
        </div>

        {/* Date Filter Pills */}
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

      {/* 4 Summary Stat Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconGreen}`}>
            <Icon.CheckCircle width={20} height={20} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Login Successes</span>
            <span className={styles.summaryValue}>{summary?.loginSuccesses ?? '0'}</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconRed}`}>
            <Icon.AlertCircle width={20} height={20} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Login Errors</span>
            <span className={styles.summaryValue}>{summary?.loginErrors ?? '0'}</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconBlue}`}>
            <Icon.FileText width={20} height={20} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Audit Events</span>
            <span className={styles.summaryValue}>{summary?.totalAuditEvents ?? '0'}</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconPurple}`}>
            <Icon.Users width={20} height={20} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Active Users</span>
            <span className={styles.summaryValue}>{summary?.activeUsers ?? '0'}</span>
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className={styles.navBar}>
        {/*
          Broadest view first, and it is the default. The page used to open on Login Errors, so an
          administrator's first sight of the audit log was a list of failures — alarming out of context,
          and the wrong starting point for "what has been happening on this platform".

          role="tablist" and aria-selected are what let a screen reader announce these as tabs rather
          than as three unrelated buttons.
        */}
        <div className={styles.tabsList} role="tablist" aria-label="Audit log views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_IDS.auditEvents}
            className={`${styles.tabBtn} ${activeTab === TAB_IDS.auditEvents ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(TAB_IDS.auditEvents)}
          >
            All Activity
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_IDS.loginSuccesses}
            className={`${styles.tabBtn} ${activeTab === TAB_IDS.loginSuccesses ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(TAB_IDS.loginSuccesses)}
          >
            Sign-ins
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_IDS.loginErrors}
            className={`${styles.tabBtn} ${activeTab === TAB_IDS.loginErrors ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(TAB_IDS.loginErrors)}
          >
            Failed Sign-ins
          </button>
        </div>

        <div className={styles.toolbarActions}>
          <div className={styles.searchBox}>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="Filter by service..."
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
            <Icon.Search width={14} height={14} className={styles.searchIcon} />
          </div>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => {
              setRefreshKey((k) => k + 1)
              void loadSummary()
            }}
            title="Refresh Logs"
          >
            <Icon.Activity width={15} height={15} />
            <span>Refresh</span>
          </button>

          <PermissionGate featureKey={FEATURE} capability="Export">
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              <Icon.FileText width={15} height={15} />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Logs Table Container */}
      <div className={styles.tableContainer}>
        {logs === null ? (
          <SkeletonTable rows={8} columns={isLoginTab ? 6 : 6} />
        ) : (
          <table className={styles.logTable}>
            <thead>
              {isLoginTab ? (
                <tr>
                  <th>TIME</th>
                  <th>ACTOR / EMAIL</th>
                  <th>AUTH METHOD</th>
                  <th>IP ADDRESS</th>
                  <th>BROWSER / DEVICE</th>
                  <th>RESULT</th>
                  {activeTab === TAB_IDS.loginErrors && <th aria-label="Actions" />}
                </tr>
              ) : (
                <tr>
                  <th>TIME</th>
                  <th>SERVICE</th>
                  <th>ACTOR</th>
                  <th>ACTION</th>
                  <th>ENTITY</th>
                  <th>DETAILS</th>
                </tr>
              )}
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    No audit records found matching the selected filters.
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const initial = (log.actorName || log.actorUserId || 'S').charAt(0).toUpperCase()

                return isLoginTab ? (
                  <tr key={log.id}>
                    <td className={styles.timeCell}>{formatTimestamp(log.occurredAt)}</td>
                    <td>
                      <div className={styles.actorCell}>
                        <span className={styles.actorAvatar}>{initial}</span>
                        <span className={styles.actorName}>
                          {log.actorName ?? <span className={styles.mutedText}>Unknown</span>}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.authPill}>{log.authMethod ?? 'Local'}</span>
                    </td>
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
                        <button
                          type="button"
                          className={styles.viewDetailBtn}
                          onClick={() => setSelectedFailure(log)}
                        >
                          Details
                        </button>
                      </td>
                    )}
                  </tr>
                ) : (
                  <tr key={log.id}>
                    <td className={styles.timeCell}>{formatTimestamp(log.occurredAt)}</td>
                    <td>
                      <Badge tone={serviceTone(log.serviceName)}>{log.serviceName}</Badge>
                    </td>
                    <td>
                      <div className={styles.actorCell}>
                        <span className={styles.actorAvatar}>{initial}</span>
                        <span className={styles.actorName}>
                          {log.actorName ?? <span className={styles.mutedText}>System</span>}
                        </span>
                      </div>
                    </td>
                    <td className={styles.actionCell}>{log.action}</td>
                    <td className={styles.mutedText}>
                      {log.entityType ? `${log.entityType}${log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}` : '—'}
                    </td>
                    <td className={styles.detailsCell} title={log.details ?? undefined}>
                      {log.details ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            &lt; Previous
          </button>
          <span className={styles.pageIndicator}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next &gt;
          </button>
        </div>
      )}

      {/* Failure Drilldown Modal */}
      <Modal open={Boolean(selectedFailure)} title="Login Failure Details" onClose={() => setSelectedFailure(null)}>
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
