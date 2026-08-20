import { useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { Badge, type BadgeTone } from '../../../shared/components/Badge/Badge'
import { SkeletonBlock } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { approvalsApi, type ApprovalRequestListItemDto, type ApprovalStatus } from '../api/approvalsApi'
import { Icon } from '../../../shared/components/Icon/Icon'
import styles from './MyRequestsPage.module.css'

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

const FILTERS: { key: ApprovalStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
]

/**
 * The maker dashboard — every authenticated user's own submitted requests, regardless of whether they
 * hold Approval Center access (see approvalsApi.listMine's own doc comment: it's scoped to the caller's
 * own id server-side, so this never needs a special permission to view).
 */
export function MyRequestsPage() {
  const accessToken = useAuthStore((s) => s.accessToken)

  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [items, setItems] = useState<ApprovalRequestListItemDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setItems(null)
    setError(null)

    approvalsApi
      .listMine(accessToken, { page, pageSize, status: statusFilter === 'all' ? undefined : statusFilter })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load your requests.')
        setItems([])
        setTotal(0)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, page, pageSize, statusFilter, refreshKey])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>My Requests</h1>
          <p className={styles.subtitle}>Every action you've submitted for approval — status, assigned checker, and rejection reasons if any.</p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={() => setRefreshKey((k) => k + 1)}>
          <Icon.Activity width={15} height={15} />
          <span>Refresh</span>
        </button>
      </div>

      <div className={styles.filterPills} role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={statusFilter === f.key}
            className={statusFilter === f.key ? styles.pillActive : styles.pill}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>SUBMITTED</th>
              <th>MODULE</th>
              <th>ACTION</th>
              <th>ENTITY</th>
              <th>CHECKER</th>
              <th>STATUS</th>
              <th>REJECTION REASON</th>
            </tr>
          </thead>
          <tbody>
            {items === null ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i}><td colSpan={7}><SkeletonBlock height={20} radius="4px" /></td></tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  {statusFilter === 'all' ? "You haven't submitted any requests yet." : `No ${statusFilter.toLowerCase()} requests.`}
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className={styles.timeCell}>{formatTimestamp(r.requestedAt)}</td>
                  <td><Badge tone="info">{r.module}</Badge></td>
                  <td>{ACTION_LABELS[r.action] ?? r.action}</td>
                  <td>{r.entityLabel ?? <span className={styles.mutedText}>—</span>}</td>
                  <td>{r.checkerName ?? <span className={styles.mutedText}>Unassigned</span>}</td>
                  <td><Badge tone={STATUS_TONES[r.status]} dot>{r.status}</Badge></td>
                  <td className={styles.reasonCell}>
                    {r.rejectionReason ?? <span className={styles.mutedText}>—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  )
}
