import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { Badge, type BadgeTone } from '../../../shared/components/Badge/Badge'
import { SkeletonBlock } from '../../../shared/components/Skeleton'
import { PermissionGate } from '../../../shared/components/PermissionGate/PermissionGate'
import { ApiError } from '../../../shared/api/httpClient'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { auditLogsApi, type AuditLogDto, type AuditLogSummaryDto } from '../api/auditLogsApi'
import { Icon } from '../../../shared/components/Icon/Icon'
// Same generated classes the Settings drawer and the System Audit Trail deep-link render from — reused
// here so a single record's details open as the identical right-side drawer shell used everywhere else
// in the host, rather than introducing a third drawer look.
import drawerStyles from '../../../layout/SettingsDrawer/SettingsDrawer.module.css'
import styles from './AuditLogsPage.module.css'

const FEATURE = 'host.system.audit-logs'
const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [5, 10, 15, 20] as const

const SERVICE_TONES: Record<string, BadgeTone> = {
  AuthService: 'primary',
  ModuleRegistry: 'info',
  EmployeeService: 'warning',
}

function serviceTone(serviceName: string): BadgeTone {
  return SERVICE_TONES[serviceName] ?? 'neutral'
}

// Raw actions arrive as backend event names ("auth.login_succeeded", "remoteapp.deleted") — accurate
// for logs, unreadable for the person reviewing them. Known actions get an exact, hand-written label;
// anything not in the map yet still gets turned into words instead of showing raw dot/underscore
// notation, so a new action type added later degrades gracefully rather than looking broken.
const ACTION_LABELS: Record<string, string> = {
  'auth.login_succeeded': 'Login Succeeded',
  'auth.login_failed': 'Login Failed',
  'remoteapp.created': 'Remote App Registered',
  'remoteapp.updated': 'Remote App Updated',
  'remoteapp.deleted': 'Remote App Removed',
  'remoteapp.status_changed': 'Remote App Status Changed',
  'employee.created': 'Employee Created',
  'employee.updated': 'Employee Updated',
  'employee.deleted': 'Employee Deleted',
  'lead.created': 'Lead Created',
  'lead.updated': 'Lead Updated',
  'lead.deleted': 'Lead Deleted',
}

function formatActionLabel(action: string): string {
  if (!action) return 'Unknown Action'
  const known = ACTION_LABELS[action]
  if (known) return known
  const segment = action.includes('.') ? action.slice(action.lastIndexOf('.') + 1) : action
  return segment
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
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

interface ParsedUserAgent {
  browser: string
  os: string
}

function parseUserAgent(ua?: string | null): ParsedUserAgent | null {
  if (!ua) return null
  let browser = 'Browser'
  let os = 'Device'

  // OS detection
  if (/Windows NT 10.0|Windows NT 11/i.test(ua)) os = 'Windows 10/11'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  // Browser detection (order matters: Edge contains Chrome, Chrome contains Safari)
  if (/Edg\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/Edg\/([\d.]+)/i)
    browser = m ? `Edge ${m[1].split('.')[0]}` : 'Edge'
  } else if (/Chrome\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/Chrome\/([\d.]+)/i)
    browser = m ? `Chrome ${m[1].split('.')[0]}` : 'Chrome'
  } else if (/Firefox\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/Firefox\/([\d.]+)/i)
    browser = m ? `Firefox ${m[1].split('.')[0]}` : 'Firefox'
  } else if (/Version\/([\d.]+).*Safari/i.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/i)
    browser = m ? `Safari ${m[1].split('.')[0]}` : 'Safari'
  } else if (/Safari/i.test(ua)) {
    browser = 'Safari'
  }

  return { browser, os }
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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [isCustomPageSize, setIsCustomPageSize] = useState(false)
  const [customPageSizeInput, setCustomPageSizeInput] = useState('')
  const [service, setService] = useState('')
  // Debounced so typing a service name does not fire one audit-log query per keystroke. The audit
  // table is the largest in the platform, so this is the query least worth running on every letter.
  const debouncedService = useDebouncedValue(service, 300)

  const [summary, setSummary] = useState<AuditLogSummaryDto | null>(null)
  const [logs, setLogs] = useState<AuditLogDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  /**
   * The row whose full details are open in the right-side drawer, or null when the drawer is closed.
   * One record at a time — clicking "View" on another row just swaps which record the same drawer
   * shows. Previously this was an inline expand-in-place row (and a separate, never-actually-opened
   * "Login Failure Details" Modal); both are replaced by this single drawer so every "view details"
   * action on this page opens the same right-side panel the rest of the host uses.
   */
  const [viewingLog, setViewingLog] = useState<AuditLogDto | null>(null)

  // Bumped by the Refresh button to force a refetch of the current query. A counter rather than calling
  // a loader directly, so refreshing goes through exactly the same effect — and therefore the same
  // cancellation and loading-state handling — as any other change.
  const [refreshKey, setRefreshKey] = useState(0)

  const range = useMemo(() => computeRange(dateRange), [dateRange])

  useEffect(() => {
    if (!viewingLog) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewingLog(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewingLog])

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
          pageSize,
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
  }, [accessToken, page, pageSize, debouncedService, activeTab, range, refreshKey])

  // Changing the filter or page size invalidates the page number.
  useEffect(() => {
    setPage(1)
  }, [activeTab, dateRange, debouncedService, pageSize])

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

  // Handler for the page-size preset or custom selection
  function handlePageSizeSelect(value: string) {
    if (value === 'custom') {
      setIsCustomPageSize(true)
      setCustomPageSizeInput(String(pageSize))
    } else {
      const size = Number(value)
      setIsCustomPageSize(false)
      setCustomPageSizeInput('')
      setPageSize(size)
      setPage(1)
    }
  }

  function handleCustomPageSizeChange(val: string) {
    setCustomPageSizeInput(val)
    const parsed = parseInt(val, 10)
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 500) {
      setPageSize(parsed)
      setPage(1)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
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
          {/* Rows-per-page dropdown */}
          <div className={styles.rowsDropdownWrap}>
            <label htmlFor="audit-rows-select" className={styles.rowsDropdownLabel}>
              Rows
            </label>
            <div className={styles.rowsSelectWrap}>
              <select
                id="audit-rows-select"
                className={styles.rowsSelect}
                value={isCustomPageSize ? 'custom' : pageSize}
                onChange={(e) => handlePageSizeSelect(e.target.value)}
                aria-label="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
              <span className={styles.rowsSelectChevron} aria-hidden="true">▾</span>
            </div>
            {isCustomPageSize && (
              <input
                type="number"
                min={1}
                max={500}
                className={styles.rowsCustomInput}
                value={customPageSizeInput}
                placeholder="e.g. 50"
                onChange={(e) => handleCustomPageSizeChange(e.target.value)}
                onBlur={() => {
                  const parsed = parseInt(customPageSizeInput, 10)
                  if (Number.isNaN(parsed) || parsed < 1 || parsed > 500) {
                    setCustomPageSizeInput(String(pageSize))
                  }
                }}
                aria-label="Custom row count"
                autoFocus
              />
            )}
          </div>

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
                <th>DETAILS</th>
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
            {logs === null ? (
              Array.from({ length: pageSize > 15 ? 10 : pageSize }).map((_, i) => (
                <tr key={i} className={styles.skeletonTableRow}>
                  {isLoginTab ? (
                    <>
                      <td><SkeletonBlock width={130} height={16} radius="4px" /></td>
                      <td>
                        <div className={styles.actorCell}>
                          <SkeletonBlock width={28} height={28} radius="8px" />
                          <SkeletonBlock width={110} height={16} radius="4px" />
                        </div>
                      </td>
                      <td><SkeletonBlock width={60} height={22} radius="999px" /></td>
                      <td><SkeletonBlock width={95} height={22} radius="6px" /></td>
                      <td>
                        <div className={styles.devicePillGroup}>
                          <SkeletonBlock width={75} height={22} radius="6px" />
                          <SkeletonBlock width={60} height={22} radius="6px" />
                        </div>
                      </td>
                      <td><SkeletonBlock width={70} height={22} radius="999px" /></td>
                      <td><SkeletonBlock width={52} height={26} radius="7px" /></td>
                    </>
                  ) : (
                    <>
                      <td><SkeletonBlock width={130} height={16} radius="4px" /></td>
                      <td><SkeletonBlock width={90} height={22} radius="999px" /></td>
                      <td>
                        <div className={styles.actorCell}>
                          <SkeletonBlock width={28} height={28} radius="8px" />
                          <SkeletonBlock width={100} height={16} radius="4px" />
                        </div>
                      </td>
                      <td><SkeletonBlock width={120} height={22} radius="6px" /></td>
                      <td>
                        <div className={styles.entityWrap}>
                          <SkeletonBlock width={70} height={16} radius="4px" />
                          <SkeletonBlock width={45} height={16} radius="4px" />
                        </div>
                      </td>
                      <td><SkeletonBlock width={52} height={26} radius="7px" /></td>
                    </>
                  )}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={isLoginTab ? 7 : 6} className={styles.emptyCell}>
                  No audit records found matching the selected filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
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
                    <td>
                      {log.sourceIp ? (
                        <span className={styles.ipBadge}>
                          <span className={styles.ipDot} aria-hidden="true" />
                          {log.sourceIp}
                        </span>
                      ) : (
                        <span className={styles.mutedText}>—</span>
                      )}
                    </td>
                    <td
                      className={`${styles.deviceCell} ${log.userAgent ? styles.deviceCellClickable : ''}`}
                      onClick={() => setViewingLog(log)}
                      title="Click to view full details"
                    >
                      {(() => {
                        const parsed = parseUserAgent(log.userAgent)
                        if (!parsed) return <span className={styles.mutedText}>{log.userAgent ?? '—'}</span>
                        return (
                          <div className={styles.devicePillGroup}>
                            <span className={styles.browserPill}>{parsed.browser}</span>
                            <span className={styles.osPill}>{parsed.os}</span>
                          </div>
                        )
                      })()}
                    </td>
                    <td>
                      <Badge tone={log.result === 'Success' ? 'success' : 'danger'} dot>
                        {log.result}
                      </Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.viewDetailBtn}
                        onClick={() => setViewingLog(log)}
                        title="View full details"
                      >
                        View
                      </button>
                    </td>
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
                    <td>
                      <span className={styles.actionCell} title={log.action}>{formatActionLabel(log.action)}</span>
                    </td>
                    <td>
                      {log.entityType ? (
                        <div className={styles.entityWrap}>
                          <span className={styles.entityType}>{log.entityType}</span>
                          {log.entityLabel && (
                            <span className={styles.entityId} title={log.entityLabel}>
                              {log.entityLabel}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={styles.mutedText}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.viewDetailBtn}
                        onClick={() => setViewingLog(log)}
                        title="View full details"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
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

      {/* Record details drawer — opened per row by its "View" button (or, on the Sign-ins tabs, the
          device cell). The SAME right-side drawer shell Settings and the System Audit Trail deep-link
          use, scoped to just the one record clicked — NOT the whole audit log section. */}
      {viewingLog && (
        <div className={drawerStyles.overlayRoot}>
          <div className={drawerStyles.backdrop} onClick={() => setViewingLog(null)} />
          <div className={drawerStyles.drawerContainer}>
            <div className={drawerStyles.rootPanel}>
              <div className={drawerStyles.header}>
                <div className={drawerStyles.headerLeft}>
                  <div className={drawerStyles.headerIcon}>
                    <Icon.FileText width={20} height={20} />
                  </div>
                  <div>
                    <h2 className={drawerStyles.title}>Audit Record Details</h2>
                    <p className={drawerStyles.subtitle}>Full details of this audit trail entry</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={drawerStyles.closeBtn}
                  onClick={() => setViewingLog(null)}
                  aria-label="Close details"
                >
                  <Icon.X width={20} height={20} />
                </button>
              </div>

              <div className={drawerStyles.tabBody}>
                <div className={styles.drawerSections}>
                  {/* Overview — when, who, what happened, how it ended. The four facts anyone opening
                      this drawer wants first, before drilling into entity/network detail below. */}
                  <section className={styles.drawerSection}>
                    <h3 className={styles.drawerSectionTitle}>Overview</h3>
                    <dl className={styles.detailList}>
                      <dt>Time</dt>
                      <dd>{formatTimestamp(viewingLog.occurredAt)}</dd>

                      <dt>Service</dt>
                      <dd><Badge tone={serviceTone(viewingLog.serviceName)}>{viewingLog.serviceName}</Badge></dd>

                      <dt>Actor</dt>
                      <dd>{viewingLog.actorName ?? 'System'}</dd>

                      <dt>Action</dt>
                      <dd>{formatActionLabel(viewingLog.action)}</dd>

                      <dt>Result</dt>
                      <dd>
                        <Badge tone={viewingLog.result === 'Success' ? 'success' : 'danger'} dot>
                          {viewingLog.result}
                        </Badge>
                      </dd>

                      {viewingLog.failureReason && (
                        <>
                          <dt>Failure Reason</dt>
                          <dd className={styles.dangerText}>{viewingLog.failureReason}</dd>
                        </>
                      )}
                    </dl>
                  </section>

                  {/* Entity — what record this action touched, in the friendly name an admin actually
                      recognizes ("Lead Management"), never the raw type/UUID pair. */}
                  {viewingLog.entityType && (
                    <section className={styles.drawerSection}>
                      <h3 className={styles.drawerSectionTitle}>Entity</h3>
                      <dl className={styles.detailList}>
                        <dt>Type</dt>
                        <dd><Badge tone="neutral">{viewingLog.entityType}</Badge></dd>

                        <dt>Name</dt>
                        <dd>{viewingLog.entityLabel ?? <span className={styles.mutedText}>Not recorded</span>}</dd>
                      </dl>
                    </section>
                  )}

                  {/* Details — free-form context the writer chose to include, e.g. what specifically
                      changed. Not present on every action type. */}
                  {viewingLog.details && (
                    <section className={styles.drawerSection}>
                      <h3 className={styles.drawerSectionTitle}>Details</h3>
                      <p className={styles.detailsText}>{viewingLog.details}</p>
                    </section>
                  )}

                  {/* Sign-in-only fields render inside the same Network & Device section below when
                      present; auth method only makes sense for login/logout-shaped events. */}
                  <section className={styles.drawerSection}>
                    <h3 className={styles.drawerSectionTitle}>Network &amp; Device</h3>
                    <dl className={styles.detailList}>
                      {viewingLog.authMethod && (
                        <>
                          <dt>Auth Method</dt>
                          <dd>{viewingLog.authMethod}</dd>
                        </>
                      )}

                      <dt>IP Address</dt>
                      <dd className={styles.monoText}>{viewingLog.sourceIp ?? '—'}</dd>

                      <dt>Browser / Device</dt>
                      <dd>
                        {(() => {
                          const parsed = parseUserAgent(viewingLog.userAgent)
                          if (!parsed) return <span className={styles.mutedText}>—</span>
                          return (
                            <div className={styles.devicePillGroup}>
                              <span className={styles.browserPill}>{parsed.browser}</span>
                              <span className={styles.osPill}>{parsed.os}</span>
                            </div>
                          )
                        })()}
                      </dd>
                    </dl>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
