import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useSettingsDrawerStore } from '../../../shared/stores/settingsDrawerStore'
import { Badge, type BadgeTone } from '../../../shared/components/Badge/Badge'
import { SkeletonBlock } from '../../../shared/components/Skeleton'
import { approvalsApi, type ApprovalStatus, type RevealTempPasswordResponse } from '../api/approvalsApi'
import { useApprovalRequests } from '../hooks/useApprovalRequests'
import { Icon } from '../../../shared/components/Icon/Icon'
import { ApiError } from '../../../shared/api/httpClient'
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
  const [refreshKey, setRefreshKey] = useState(0)
  const mutationCount = useSettingsDrawerStore((s) => s.mutationCount)

  const fetcher = useCallback(
    (token: string) =>
      approvalsApi.listMine(token, { page, pageSize, status: statusFilter === 'all' ? undefined : statusFilter }),
    [page, pageSize, statusFilter],
  )
  const { items, total, error } = useApprovalRequests(accessToken, fetcher, [page, pageSize, statusFilter, refreshKey, mutationCount])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  // Instant feedback: the fetched row still says hasTempPassword until the refetch lands, so the
  // button is hidden from this set immediately on success rather than flickering back.
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set())
  const [revealing, setRevealing] = useState<string | null>(null) // request id in flight
  const [revealed, setRevealed] = useState<RevealTempPasswordResponse | null>(null) // modal payload
  const [revealError, setRevealError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleReveal(id: string) {
    if (!accessToken) return
    setRevealing(id)
    setRevealError(null)
    try {
      const result = await approvalsApi.revealTempPassword(accessToken, id)
      setCollectedIds((prev) => new Set(prev).add(id))
      setRevealed(result)
    } catch (err) {
      // 410 (already collected) lands here too — mark it collected so the dead button disappears.
      setCollectedIds((prev) => new Set(prev).add(id))
      setRevealError(err instanceof ApiError ? err.message : 'Could not retrieve the temporary password.')
    } finally {
      setRevealing(null)
    }
  }

  function closeRevealModal() {
    setRevealed(null)
    setCopied(false)
    setRefreshKey((k) => k + 1) // re-sync with server truth after the optimistic hide
  }

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
      {revealError && <div className={styles.errorBanner}>{revealError}</div>}

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
              <th>PASSWORD</th>
              <th>REJECTION REASON</th>
            </tr>
          </thead>
          <tbody>
            {items === null ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i}><td colSpan={8}><SkeletonBlock height={20} radius="4px" /></td></tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
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
                  <td>
                    {r.hasTempPassword && !collectedIds.has(r.id) ? (
                      <button
                        type="button"
                        className={styles.revealBtn}
                        disabled={revealing === r.id}
                        onClick={() => handleReveal(r.id)}
                      >
                        <Icon.Lock width={13} height={13} />
                        <span>{revealing === r.id ? 'Retrieving…' : 'Get password'}</span>
                      </button>
                    ) : (
                      <span className={styles.mutedText}>—</span>
                    )}
                  </td>
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

      {revealed && (
        <div className={styles.modalBackdrop} onClick={closeRevealModal}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIconWrap}>
              <Icon.ShieldCheck width={34} height={34} />
            </div>
            <h3 className={styles.modalTitle}>Temporary Password</h3>
            <p className={styles.modalText}>
              Share this securely with <strong>{revealed.userName}</strong> ({revealed.userEmail}). They will be
              required to choose their own password the first time they sign in.
            </p>
            <div className={styles.tempPassBox}>
              <code className={styles.tempPassValue}>{revealed.temporaryPassword}</code>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => { void navigator.clipboard.writeText(revealed.temporaryPassword).then(() => setCopied(true)) }}
              >
                <Icon.Copy width={13} height={13} />
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className={styles.modalWarning} role="alert">
              <Icon.AlertCircle width={15} height={15} />
              <span>This is the only time it will be shown. Once you close this, it cannot be retrieved again — the account would have to be re-created.</span>
            </p>
            <button type="button" className={styles.modalDoneBtn} onClick={closeRevealModal}>
              I&apos;ve saved it — close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
