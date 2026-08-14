import { NavLink } from 'react-router-dom'
import { classNames } from '../../shared/utils/classNames'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import styles from './Sidebar.module.css'

export interface SidebarAppItem {
  key: string
  displayName: string
  iconKey?: string | null
}

export interface SidebarProps {
  /** undefined while the registry is still loading, [] once loaded with nothing registered/visible. */
  apps?: SidebarAppItem[]
}

function navItemClass({ isActive }: { isActive: boolean }) {
  return classNames(styles.navItem, isActive && styles.navItemActive)
}

export function Sidebar({ apps }: SidebarProps) {
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
            ⌂
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

        {apps?.length === 0 && <div className={styles.emptyState}>No apps registered yet.</div>}

        {apps?.map((app) => (
          <NavLink key={app.key} to={`/apps/${app.key}`} className={navItemClass}>
            <span className={styles.navIcon} aria-hidden="true">
              {app.iconKey ?? '▢'}
            </span>
            <span className={styles.navLabel}>{app.displayName}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
