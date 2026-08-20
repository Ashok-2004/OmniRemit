import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { Badge, type BadgeTone } from '../../../shared/components/Badge/Badge'
import { SkeletonBlock } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import {
  approvalsApi,
  type ApprovalRequestListItemDto,
  type ApprovalRequestDetailDto,
  type ApprovalSummaryDto,
  type ApprovalStatus,
} from '../api/approvalsApi'
import { APPROVAL_MODULES } from '../api/checkerAssignmentsApi'
import { Icon } from '../../../shared/components/Icon/Icon'
// Same drawer shell Audit Logs / Settings use — the whole point of "keep the design language" is
// not building a fourth right-side-panel implementation.
import drawerStyles from '../../../layout/SettingsDrawer/SettingsDrawer.module.css'
import styles from './ApprovalCenterPage.module.css'

const FEATURE = 'host.system.approvals'
const DEFAULT_PAGE_SIZE = 10

const STATUS_TONES: Record<ApprovalStatus, BadgeTone> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
}

const ACTION_LABELS: Record<string, string> = {
  Create: 'Create',
  Update: 'Update',
  Delete: 'Delete',
  Enable: 'Enable',
  Disable: 'Disable',
}

function formatTimestamp(iso: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Pretty-prints a JSON snapshot as a key/value list, falling back to raw text if it isn't valid JSON. */
function renderDataFields(json: string | null, emptyLabel: string) {
  if (!json) return <p className={styles.mutedText}>{emptyLabel}</p>
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const entries = Object.entries(parsed).filter(([key]) => key.toLowerCase() !== 'permissions')
    if (entries.length === 0) return <p className={styles.mutedText}>{emptyLabel}</p>
    return (
      <dl className={styles.dataFieldList}>
        {entries.map(([key, value]) => (
          <div key={key} className={styles.dataFieldRow}>
            <dt>{key}</dt>
            <dd>{value === null || value === undefined || value === '' ? '—' : String(value)}</dd>
          </div>
        ))}
      </dl>
    )
  } catch {
    return <p className={styles.wrapText}>{json}</p>
  }
}

const TAB_IDS = { pending: 'pending', processed: 'processed', all: 'all' } as const
type TabId = (typeof TAB_IDS)[keyof typeof TAB_IDS]
const TAB_STATUS_FILTER: Record<TabId, ApprovalStatus | undefined> = {
  [TAB_IDS.pending]: 'Pending',
  [TAB_IDS.processed]: undefined, // handled specially below (Approved OR Rejected)
  [TAB_IDS.all]: undefined,
}

/**
 * The centralized Approval Center — one source of truth across the whole platform (Phase 1: Users and
 * Roles; every future gated module lands in this same table, same page, no separate flow per module).
 */
export function ApprovalCenterPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const [activeTab, setActiveTab] = useState<TabId>(TAB_IDS.pending)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [module, setModule] = useState('')
  const [makerSearch, setMakerSearch] = useState('')
  const debouncedMaker = useDebouncedValue(makerSearch, 300)
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false)

  const [summary, setSummary] = useState<ApprovalSummaryDto | null>(null)
  const [items, setItems] = useState<ApprovalRequestListItemDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [viewingId, setViewingId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ApprovalRequestDetailDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const loadSummary = useCallback(async () => {
    if (!accessToken) return
    try {
      setSummary(await approvalsApi.summary(accessToken))
    } catch {
      // Non-critical — the cards just stay blank rather than blocking the table.
    }
  }, [accessToken])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setItems(null)
    setError(null)

    async function load() {
      try {
        // "Processed" spans both terminal states — two calls, merged, rather than a status filter the
        // backend doesn't support as an OR. Cheap: this tab is not the default view.
        if (activeTab === TAB_IDS.processed) {
          const [approved, rejected] = await Promise.all([
            approvalsApi.list(accessToken!, { page: 1, pageSize: 200, module: module || undefined, status: 'Approved', makerId: undefined }),
            approvalsApi.list(accessToken!, { page: 1, pageSize: 200, module: module || undefined, status: 'Rejected', makerId: undefined }),
          ])
          if (cancelled) return
          const merged = [...approved.items, ...rejected.items].sort(
            (a, b) => new Date(b.decidedAt ?? b.requestedAt).getTime() - new Date(a.decidedAt ?? a.requestedAt).getTime(),
          )
          const start = (page - 1) * pageSize
          setItems(merged.slice(start, start + pageSize))
          setTotal(merged.length)
          return
        }

        const result = await approvalsApi.list(accessToken!, {
          page,
          pageSize,
          module: module || undefined,
          status: TAB_STATUS_FILTER[activeTab],
          assignedToMe: assignedToMeOnly || undefined,
        })
        if (cancelled) return
        // Maker search is applied client-side against the already-fetched page's maker names — the
        // backend has no free-text maker filter, only an exact makerId one the UI doesn't have a
        // picker for yet.
        const filtered = debouncedMaker
          ? result.items.filter((r) => r.makerName?.toLowerCase().includes(debouncedMaker.toLowerCase()))
          : result.items
        setItems(filtered)
        setTotal(result.total)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load approval requests.')
        setItems([])
        setTotal(0)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, activeTab, page, pageSize, module, assignedToMeOnly, debouncedMaker, refreshKey])

  useEffect(() => {
    setPage(1)
  }, [activeTab, module, assignedToMeOnly, debouncedMaker])

  useEffect(() => {
    if (!viewingId || !accessToken) return
    let cancelled = false
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    setRejectReason('')

    approvalsApi
      .get(accessToken, viewingId)
      .then((res) => {
        if (!cancelled) setDetail(res)
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err instanceof ApiError ? err.message : 'Could not load this request.')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [viewingId, accessToken])

  const isMyDecisionToMake = Boolean(detail && currentUserId && detail.checkerId === currentUserId && detail.status === 'Pending')

  async function handleApprove() {
    if (!detail || !accessToken) return
    setDeciding(true)
    setDetailError(null)
    try {
      const updated = await approvalsApi.approve(accessToken, detail.id)
      setDetail(updated)
      setRefreshKey((k) => k + 1)
      void loadSummary()
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Could not approve this request.')
    } finally {
      setDeciding(false)
    }
  }

  async function handleReject() {
    if (!detail || !accessToken || !rejectReason.trim()) return
    setDeciding(true)
    setDetailError(null)
    try {
      const updated = await approvalsApi.reject(accessToken, detail.id, rejectReason.trim())
      setDetail(updated)
      setRejecting(false)
      setRefreshKey((k) => k + 1)
      void loadSummary()
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Could not reject this request.')
    } finally {
      setDeciding(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Approval Center</h1>
          <p className={styles.subtitle}>
            Every Maker-Checker request across the platform, in one place — filter by application,
            module, status, maker, and date.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconAmber}`}>
            <Icon.Clock width={20} height={20} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Pending</span>
            <span className={styles.summaryValue}>{summary?.pendingTotal ?? '0'}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconGreen}`}>
            <Icon.CheckCircle width={20} height={20} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Approved Today</span>
            <span className={styles.summaryValue}>{summary?.approvedToday ?? '0'}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconRed}`}>
            <Icon.AlertCircle width={20} height={20} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Rejected Today</span>
            <span className={styles.summaryValue}>{summary?.rejectedToday ?? '0'}</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.iconBlue}`}>
            <Icon.UserCheck width={20} height={20} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Assigned to Me</span>
            <span className={styles.summaryValue}>{summary?.assignedToMePending ?? '0'}</span>
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className={styles.navBar}>
        <div className={styles.tabsList} role="tablist" aria-label="Approval views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_IDS.pending}
            className={`${styles.tabBtn} ${activeTab === TAB_IDS.pending ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(TAB_IDS.pending)}
          >
            Pending
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_IDS.processed}
            className={`${styles.tabBtn} ${activeTab === TAB_IDS.processed ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(TAB_IDS.processed)}
          >
            Processed
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_IDS.all}
            className={`${styles.tabBtn} ${activeTab === TAB_IDS.all ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(TAB_IDS.all)}
          >
            All Requests
          </button>
        </div>

        <div className={styles.toolbarActions}>
          <select className={styles.moduleSelect} value={module} onChange={(e) => setModule(e.target.value)} aria-label="Filter by module">
            <option value="">All Modules</option>
            {APPROVAL_MODULES.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>

          <div className={styles.searchBox}>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="Filter by maker..."
              value={makerSearch}
              onChange={(e) => setMakerSearch(e.target.value)}
            />
            <Icon.Search width={14} height={14} className={styles.searchIcon} />
          </div>

          <label className={styles.assignedToMeToggle}>
            <input type="checkbox" checked={assignedToMeOnly} onChange={(e) => setAssignedToMeOnly(e.target.checked)} />
            <span>Assigned to me</span>
          </label>

          <button type="button" className={styles.refreshBtn} onClick={() => { setRefreshKey((k) => k + 1); void loadSummary() }}>
            <Icon.Activity width={15} height={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Table */}
      <div className={styles.tableContainer}>
        <table className={styles.logTable}>
          <thead>
            <tr>
              <th>REQUESTED</th>
              <th>MODULE</th>
              <th>ACTION</th>
              <th>ENTITY</th>
              <th>MAKER</th>
              <th>CHECKER</th>
              <th>STATUS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items === null ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8}><SkeletonBlock height={20} radius="4px" /></td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>No approval requests found matching the selected filters.</td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className={styles.timeCell}>{formatTimestamp(r.requestedAt)}</td>
                  <td><Badge tone="info">{r.module}</Badge></td>
                  <td>{ACTION_LABELS[r.action] ?? r.action}</td>
                  <td>
                    {r.entityLabel ? (
                      <span className={styles.entityLabel}>{r.entityLabel}</span>
                    ) : (
                      <span className={styles.mutedText}>—</span>
                    )}
                  </td>
                  <td>{r.makerName ?? <span className={styles.mutedText}>Unknown</span>}</td>
                  <td>{r.checkerName ?? <span className={styles.mutedText}>Unassigned</span>}</td>
                  <td><Badge tone={STATUS_TONES[r.status]} dot>{r.status}</Badge></td>
                  <td>
                    <button type="button" className={styles.viewDetailBtn} onClick={() => setViewingId(r.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className={styles.pagination}>
          <button type="button" className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            &lt; Previous
          </button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages}</span>
          <button type="button" className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next &gt;
          </button>
        </div>
      )}

      {/* Detail drawer */}
      {viewingId && (
        <div className={drawerStyles.overlayRoot}>
          <div className={drawerStyles.backdrop} onClick={() => setViewingId(null)} />
          <div className={drawerStyles.drawerContainer}>
            <div className={drawerStyles.rootPanel}>
              <div className={drawerStyles.header}>
                <div className={drawerStyles.headerLeft}>
                  <div className={drawerStyles.headerIcon}>
                    <Icon.UserCheck width={20} height={20} />
                  </div>
                  <div>
                    <h2 className={drawerStyles.title}>Approval Request</h2>
                    <p className={drawerStyles.subtitle}>Full details of this request</p>
                  </div>
                </div>
                <button type="button" className={drawerStyles.closeBtn} onClick={() => setViewingId(null)} aria-label="Close details">
                  <Icon.X width={20} height={20} />
                </button>
              </div>

              <div className={drawerStyles.tabBody}>
                {detailLoading ? (
                  <div className={styles.drawerSections}>
                    <SkeletonBlock height={120} radius="10px" />
                  </div>
                ) : detailError && !detail ? (
                  <div className={styles.errorBanner}>{detailError}</div>
                ) : detail ? (
                  <div className={styles.drawerSections}>
                    <section className={styles.drawerSection}>
                      <h3 className={styles.drawerSectionTitle}>Overview</h3>
                      <dl className={styles.detailList}>
                        <dt>Module</dt>
                        <dd><Badge tone="info">{detail.module}</Badge></dd>
                        <dt>Action</dt>
                        <dd>{ACTION_LABELS[detail.action] ?? detail.action}</dd>
                        {detail.entityType && (
                          <>
                            <dt>Entity</dt>
                            <dd>{detail.entityType}{detail.entityLabel ? ` — ${detail.entityLabel}` : ''}</dd>
                          </>
                        )}
                        <dt>Status</dt>
                        <dd><Badge tone={STATUS_TONES[detail.status]} dot>{detail.status}</Badge></dd>
                      </dl>
                    </section>

                    <section className={styles.drawerSection}>
                      <h3 className={styles.drawerSectionTitle}>Approval Timeline</h3>
                      <div className={styles.timeline}>
                        <div className={styles.timelineStep}>
                          <span className={styles.timelineDot} />
                          <div>
                            <span className={styles.timelineLabel}>Requested by {detail.makerName ?? 'Unknown'}</span>
                            <span className={styles.timelineTime}>{formatTimestamp(detail.requestedAt)}</span>
                          </div>
                        </div>
                        <div className={styles.timelineStep}>
                          <span className={`${styles.timelineDot} ${detail.status === 'Pending' ? styles.timelineDotPending : styles.timelineDotDone}`} />
                          <div>
                            <span className={styles.timelineLabel}>
                              {detail.status === 'Pending'
                                ? `Awaiting ${detail.checkerName ?? 'an assigned checker'}`
                                : `${detail.status} by ${detail.checkerName ?? 'checker'}`}
                            </span>
                            {detail.decidedAt && <span className={styles.timelineTime}>{formatTimestamp(detail.decidedAt)}</span>}
                          </div>
                        </div>
                      </div>
                      {detail.rejectionReason && (
                        <p className={styles.rejectionReasonText}>
                          <strong>Rejection reason:</strong> {detail.rejectionReason}
                        </p>
                      )}
                    </section>

                    <section className={styles.drawerSection}>
                      <h3 className={styles.drawerSectionTitle}>Before</h3>
                      {renderDataFields(detail.oldDataJson, detail.action === 'Create' ? 'New record — nothing existed before.' : 'No prior state recorded.')}
                    </section>

                    <section className={styles.drawerSection}>
                      <h3 className={styles.drawerSectionTitle}>Requested Change</h3>
                      {renderDataFields(detail.newDataJson, 'No change payload recorded.')}
                    </section>

                    {detailError && <div className={styles.errorBanner}>{detailError}</div>}

                    {/*
                      Row-level Approve/Reject visibility deliberately does NOT use PermissionGate —
                      PermissionGate/isAdministrator both bypass for admins, which is correct for
                      reaching this PAGE but wrong here: an admin who isn't the specific assigned
                      checker on THIS request must not see actionable buttons on someone else's
                      request. This is a custom, per-row identity check instead.
                    */}
                    {isMyDecisionToMake && (
                      <section className={styles.drawerSection}>
                        {!rejecting ? (
                          <div className={styles.decisionActions}>
                            <button type="button" className={styles.rejectBtn} onClick={() => setRejecting(true)} disabled={deciding}>
                              <Icon.X width={16} height={16} />
                              <span>Reject</span>
                            </button>
                            <button type="button" className={styles.approveBtn} onClick={() => void handleApprove()} disabled={deciding}>
                              <Icon.CheckCircle width={16} height={16} />
                              <span>{deciding ? 'Approving…' : 'Approve'}</span>
                            </button>
                          </div>
                        ) : (
                          <div className={styles.rejectForm}>
                            <label className={styles.label}>Rejection reason</label>
                            <textarea
                              className={styles.rejectTextarea}
                              rows={3}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Explain why this request is being rejected..."
                              autoFocus
                            />
                            <div className={styles.decisionActions}>
                              <button type="button" className={styles.cancelRejectBtn} onClick={() => setRejecting(false)} disabled={deciding}>
                                Cancel
                              </button>
                              <button
                                type="button"
                                className={styles.rejectBtn}
                                onClick={() => void handleReject()}
                                disabled={deciding || !rejectReason.trim()}
                              >
                                {deciding ? 'Rejecting…' : 'Confirm Reject'}
                              </button>
                            </div>
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
