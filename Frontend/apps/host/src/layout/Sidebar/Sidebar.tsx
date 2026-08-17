import { useState, useRef } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { classNames } from '../../shared/utils/classNames'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import { Icon } from '../../shared/components/Icon/Icon'
import { useAuthStore } from '../../features/auth/store/authStore'
import { useClickOutside } from '../../shared/hooks/useClickOutside'
import styles from './Sidebar.module.css'

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
}

function navItemClass({ isActive }: { isActive: boolean }) {
  return classNames(styles.navItem, isActive && styles.navItemActive)
}

export function Sidebar({ apps, canAccessAuditLogs, error, userName, onLogout }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useClickOutside([profileRef], () => setProfileOpen(false), profileOpen)

  const displayName = userName || user?.name || 'Super Admin'
  const email = user?.email || 'superadmin@omniremit.local'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <aside className={styles.sidebar}>
      {/* Brand Logo */}
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="20" height="20" rx="6" fill="#4f46e5" />
            <path d="M7 12a5 5 0 0 1 10 0 5 5 0 0 1-10 0z" fill="#ffffff" />
          </svg>
        </span>
        <span className={styles.brandName}>OmniConnect</span>
      </div>

      {/* Nav List */}
      <nav className={styles.nav} aria-label="Primary">
        <NavLink to="/" end className={navItemClass}>
          <span className={styles.navIcon} aria-hidden="true">
            <Icon.Home width={18} height={18} />
          </span>
          <span className={styles.navLabel}>Dashboard</span>
        </NavLink>

        <div className={styles.sectionLabel}>APPS</div>

        {apps === undefined &&
          Array.from({ length: 2 }, (_, i) => (
            <div className={styles.skeletonItem} key={i}>
              <SkeletonBlock height={32} />
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
              title={isUnreachable ? `${app.displayName} is not responding` : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true">
                <Icon.Users width={18} height={18} />
              </span>
              <span className={styles.navLabel}>{app.displayName}</span>
              {isUnreachable && (
                <span className={styles.unreachableBadge} title="This app's server is not responding">
                  !
                </span>
              )}
            </NavLink>
          )
        })}

        {canAccessAuditLogs && (
          <>
            <div className={styles.sectionLabel}>SYSTEM</div>
            <NavLink to="/system/audit-logs" className={navItemClass}>
              <span className={styles.navIcon} aria-hidden="true">
                <Icon.FileText width={18} height={18} />
              </span>
              <span className={styles.navLabel}>Audit Logs</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Bottom Profile Pill */}
      <div className={styles.bottomProfileWrapper} ref={profileRef}>
        <button
          type="button"
          className={styles.profileButton}
          onClick={() => setProfileOpen((o) => !o)}
          aria-expanded={profileOpen}
        >
          <span className={styles.profileAvatar}>{initial}</span>
          <div className={styles.profileText}>
            <span className={styles.profileName}>{displayName}</span>
            <span className={styles.profileEmail}>{email}</span>
          </div>
          <Icon.ChevronDown width={14} height={14} className={styles.profileChevron} />
        </button>

        {profileOpen && (
          <div className={styles.profileMenu}>
            <Link
              to="/profile"
              className={styles.profileMenuItem}
              onClick={() => setProfileOpen(false)}
            >
              <Icon.Users width={14} height={14} />
              <span>My Profile</span>
            </Link>
            <button
              type="button"
              className={`${styles.profileMenuItem} ${styles.profileMenuDanger}`}
              onClick={() => {
                setProfileOpen(false)
                onLogout?.()
              }}
            >
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
