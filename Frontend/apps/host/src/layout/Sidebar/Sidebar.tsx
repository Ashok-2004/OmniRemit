import { NavLink } from 'react-router-dom'
import { classNames } from '../../shared/utils/classNames'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import { Icon } from '../../shared/components/Icon/Icon'
import styles from './Sidebar.module.css'

export interface SidebarAppItem {
  key: string
  displayName: string
  iconKey?: string | null
  /** Last observed reachability. 'Unknown' is rendered exactly like 'Healthy' — an unprobed app is not a broken one. */
  health?: 'Unknown' | 'Healthy' | 'Unreachable'
}

export interface SidebarProps {
  /** undefined while the registry is still loading, [] once loaded with nothing registered/visible. */
  apps?: SidebarAppItem[]
  /** Gates the System section — currently just Audit Logs, deliberately the only System item (no Security/Integrations/System Settings). */
  canAccessAuditLogs?: boolean
  /**
   * Set when the registry fetch itself failed. Without this, an outage was indistinguishable from
   * "nothing registered" — the store has always produced an error string, but the sidebar never
   * received it and rendered the "No apps registered yet." empty state instead, actively
   * misinforming the user about why their apps had vanished.
   */
  error?: string | null
}

function navItemClass({ isActive }: { isActive: boolean }) {
  return classNames(styles.navItem, isActive && styles.navItemActive)
}

export function Sidebar({ apps, canAccessAuditLogs, error }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          O
        </span>
        <span className={styles.brandName}>OmniRemit</span>
      </div>

      <nav className={styles.nav} aria-label="Primary">
        <NavLink to="/" end className={navItemClass}>
          <span className={styles.navIcon} aria-hidden="true">
            <Icon.Home width={18} height={18} />
          </span>
          <span className={styles.navLabel}>Dashboard</span>
        </NavLink>

        <div className={styles.sectionLabel}>Apps</div>

        {apps === undefined &&
          Array.from({ length: 3 }, (_, i) => (
            <div className={styles.skeletonItem} key={i}>
              <SkeletonBlock height={20} />
            </div>
          ))}

        {error && (
          <div className={styles.errorState} role="status">
            {error}
          </div>
        )}

        {!error && apps?.length === 0 && <div className={styles.emptyState}>No apps registered yet.</div>}

        {apps?.map((app) => {
          const isUnreachable = app.health === 'Unreachable'
          return (
            <NavLink
              key={app.key}
              to={`/apps/${app.key}`}
              className={({ isActive }) => classNames(navItemClass({ isActive }), isUnreachable && styles.navItemUnreachable)}
              // Still a real link, not a disabled one: the app may have recovered since the last
              // probe, and the destination page can retry and recover on its own. The badge sets
              // the expectation without taking the choice away.
              title={isUnreachable ? `${app.displayName} is not responding` : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true">
                {app.iconKey ?? '▢'}
              </span>
              <span className={styles.navLabel}>{app.displayName}</span>
              {isUnreachable && (
                <span className={styles.unreachableBadge} title="This app's server is not responding">
                  <span className={styles.visuallyHidden}>Unavailable</span>
                  <span aria-hidden="true">!</span>
                </span>
              )}
            </NavLink>
          )
        })}

        {canAccessAuditLogs && (
          <>
            <div className={styles.sectionLabel}>System</div>
            <NavLink to="/system/audit-logs" className={navItemClass}>
              <span className={styles.navIcon} aria-hidden="true">
                <Icon.FileText width={18} height={18} />
              </span>
              <span className={styles.navLabel}>Audit Logs</span>
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  )
}
