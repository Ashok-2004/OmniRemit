import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../../auth/store/authStore'
import { useClickOutside } from '../../../../shared/hooks/useClickOutside'
import { useMenuKeyboardNav } from '../../../../shared/hooks/useMenuKeyboardNav'
import { Icon } from '../../../../shared/components/Icon/Icon'
import { SkeletonText } from '../../../../shared/components/Skeleton'
import { auditLogsApi } from '../../../system-audit-logs/api/auditLogsApi'
import styles from './SecurityAlertsMenu.module.css'

const ALERT_LIMIT = 8
/** Persisted per user so the unread count survives reloads without needing a server-side read model. */
const LAST_SEEN_KEY = 'omniremit:alerts-last-seen'

function readLastSeen(userId: string): number {
  try {
    const raw = localStorage.getItem(`${LAST_SEEN_KEY}:${userId}`)
    return raw ? Number(raw) : 0
  } catch {
    return 0
  }
}

function writeLastSeen(userId: string, at: number) {
  try {
    localStorage.setItem(`${LAST_SEEN_KEY}:${userId}`, String(at))
  } catch {
    // Storage can be unavailable (private mode, quota). The menu still works; only the unread
    // count resets on reload, which is a cosmetic degradation rather than a failure.
  }
}

function formatTime(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/**
 * Security alerts in the topbar.
 *
 * Replaces a bell button that had no click handler at all — but did have a hover state, so it
 * advertised itself as interactive and then did nothing.
 *
 * Every alert is a real failed sign-in row from the audit API. There is no notifications table and
 * nothing is synthesised: if there have been no failed sign-ins, the menu says exactly that. The
 * unread count is derived from a locally stored "last seen" timestamp compared against real row
 * timestamps.
 */
export function SecurityAlertsMenu() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const userId = useAuthStore((s) => s.user?.id)

  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useClickOutside([wrapperRef], () => setOpen(false), open)
  const handleKeyDown = useMenuKeyboardNav(wrapperRef, () => setOpen(false), triggerRef)

  useEffect(() => {
    if (userId) setLastSeen(readLastSeen(userId))
  }, [userId])

  const alertsQuery = useQuery({
    queryKey: ['securityAlerts', ALERT_LIMIT],
    queryFn: () =>
      auditLogsApi.list(accessToken!, { page: 1, pageSize: ALERT_LIMIT, action: 'auth.login_failed' }),
    enabled: Boolean(accessToken),
    // Security alerts are the one thing worth polling in the chrome — but slowly, since this runs on
    // every page in the app.
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const alerts = alertsQuery.data?.items ?? []
  const unreadCount = alerts.filter((a) => new Date(a.occurredAt).getTime() > lastSeen).length

  function toggle() {
    const next = !open
    setOpen(next)
    // Opening marks everything currently listed as seen.
    if (next && userId) {
      const now = Date.now()
      setLastSeen(now)
      writeLastSeen(userId, now)
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.iconButton}
        aria-label={unreadCount > 0 ? `Security alerts, ${unreadCount} new` : 'Security alerts'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon.Bell width={18} height={18} />
        {unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Security alerts">
          <div className={styles.menuHeader}>
            <span className={styles.menuTitle}>Security alerts</span>
            <Link to="/system/audit-logs" role="menuitem" className={styles.viewAll} onClick={() => setOpen(false)}>
              View all
            </Link>
          </div>

          {alertsQuery.isPending ? (
            <div className={styles.padded}>
              <SkeletonText lines={3} />
            </div>
          ) : alertsQuery.isError ? (
            <p className={styles.empty}>Could not load security alerts.</p>
          ) : alerts.length === 0 ? (
            <p className={styles.empty}>No failed sign-in attempts.</p>
          ) : (
            <ul className={styles.list}>
              {alerts.map((alert) => (
                <li key={alert.id} className={styles.item}>
                  <span className={styles.itemTitle}>Failed sign-in</span>
                  <span className={styles.itemMeta}>{alert.actorName ?? 'Unknown account'}</span>
                  <span className={styles.itemMeta}>
                    {formatTime(alert.occurredAt)}
                    {alert.sourceIp && <span className={styles.mono}> · {alert.sourceIp}</span>}
                  </span>
                  {alert.failureReason && <span className={styles.itemReason}>{alert.failureReason}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
