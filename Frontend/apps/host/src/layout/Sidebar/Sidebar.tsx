import { NavLink } from 'react-router-dom'
import { classNames } from '../../shared/utils/classNames'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import { Icon } from '../../shared/components/Icon/Icon'
import { resolveIcon } from '../../shared/components/Icon/resolveIcon'
import { useAuditLogDrawerStore } from '../../shared/stores/auditLogDrawerStore'
import styles from './Sidebar.module.css'
import { APP_NAME } from '../../shared/config/branding'

export interface SidebarAppItem {
  key: string
  displayName: string
  iconKey?: string | null
  health?: 'Unknown' | 'Healthy' | 'Unreachable'
}

export interface SidebarProps {
  apps?: SidebarAppItem[]
  canAccessAuditLogs?: boolean
  error?: string | null
  userName?: string
  onLogout?: () => void
  /** Mobile: whether the sidebar is slid in over the content */
  mobileOpen?: boolean
  /** Mobile: called when the user taps the backdrop or a close trigger */
  onMobileClose?: () => void
}

function navItemClass({ isActive }: { isActive: boolean }) {
  return classNames(styles.navItem, isActive && styles.navItemActive)
}

export function Sidebar({ apps, canAccessAuditLogs, error, mobileOpen }: SidebarProps) {
  const openAuditLog = useAuditLogDrawerStore((s) => s.open)

  return (
    <aside className={classNames(styles.sidebar, mobileOpen ? styles.sidebarMobileOpen : '')}>

      {/* ── Brand ─────────────────────────────────────────── */}
      <div className={styles.brand}>
        <div className={styles.brandMark} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
            <polygon points="18,2 32,10 32,26 18,34 4,26 4,10"
              stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
            <line x1="18" y1="18" x2="18" y2="34" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" />
            <line x1="18" y1="18" x2="32" y2="10" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" />
            <line x1="18" y1="18" x2="4"  y2="10" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" />
            <polygon points="18,7 27,12 18,17 9,12"
              stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"
              fill="rgba(255,255,255,0.15)" />
          </svg>
        </div>
        <div className={styles.brandNames}>
          <span className={styles.brandName}>
            {/* Name from config; split only so the two-tone styling still applies. */}
            <span className={styles.brandOmni}>{APP_NAME.slice(0, 4)}</span>
            <span className={styles.brandAccent}>{APP_NAME.slice(4)}</span>
          </span>
        </div>
      </div>

      {/* ── Navigation — everything lives inside here ─────── */}
      <nav className={styles.nav} aria-label="Primary">

        {/* Dashboard */}
        <div className={styles.sectionLabel}>Main</div>
        <NavLink to="/" end className={navItemClass}>
          <span className={styles.navIcon} aria-hidden="true">
            <Icon.Home width={17} height={17} />
          </span>
          <span className={styles.navLabel}>Dashboard</span>
        </NavLink>

        {/* Apps section — remote apps inject entries here */}
        <div className={styles.sectionLabel}>Apps</div>

        {/* Loading */}
        {apps === undefined &&
          Array.from({ length: 3 }, (_, i) => (
            <div className={styles.skeletonItem} key={i}>
              <SkeletonBlock height={34} />
            </div>
          ))}

        {/* Error */}
        {error && (
          <div className={styles.errorState} role="status">{error}</div>
        )}

        {/* Empty */}
        {!error && apps?.length === 0 && (
          <div className={styles.emptyState}>No apps registered yet.</div>
        )}

        {/* App links */}
        {apps?.map((app) => {
          const isUnreachable = app.health === 'Unreachable'
          // The registry stores an icon per app; every entry was rendered with the same Users icon, so
          // a Helpdesk and an Inventory app were visually identical in the nav.
          const AppIcon = resolveIcon(app.iconKey)
          return (
            <NavLink
              key={app.key}
              to={`/apps/${app.key}`}
              className={({ isActive }) =>
                classNames(navItemClass({ isActive }), isUnreachable && styles.navItemUnreachable)
              }
              title={isUnreachable ? `${app.displayName} is not responding` : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true">
                <AppIcon width={17} height={17} />
              </span>
              <span className={styles.navLabel}>{app.displayName}</span>
              {isUnreachable && (
                <span className={styles.unreachableBadge} title="App server not responding">!</span>
              )}
            </NavLink>
          )
        })}

        {/* ── System section — pushed to bottom of nav with margin-top: auto
            so it sits right below the apps list, never floats to the bottom
            of 100vh creating a giant empty gap ─────────────────────────── */}
        {canAccessAuditLogs && (
          <div className={styles.systemSection}>
            <div className={styles.sectionLabel}>System</div>
            {/* A button, not a route link — Audit Logs opens as a right-side drawer over whatever
                page is currently showing, the same way the Settings gear does, rather than
                navigating away to a full page. The /system/audit-logs URL still works as a deep
                link (see App.tsx's AuditLogDeepLink), it just opens this same drawer now. */}
            <button
              type="button"
              className={navItemClass({ isActive: false })}
              onClick={openAuditLog}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', letterSpacing: 'inherit' }}
            >
              <span className={styles.navIcon} aria-hidden="true">
                <Icon.FileText width={17} height={17} />
              </span>
              <span className={styles.navLabel}>Audit Logs</span>
            </button>
          </div>
        )}

      </nav>

    </aside>
  )
}
