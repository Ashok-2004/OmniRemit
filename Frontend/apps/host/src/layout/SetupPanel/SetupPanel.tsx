import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { classNames } from '../../shared/utils/classNames'
import { useAuthStore } from '../../features/auth/store/authStore'
import styles from './SetupPanel.module.css'

const SECTIONS = [
  { key: 'users', label: 'User', path: '/settings/users', icon: '👤', feature: 'host.settings.users' },
  { key: 'roles', label: 'Role', path: '/settings/roles', icon: '🛡', feature: 'host.settings.roles' },
  { key: 'maintenance', label: 'Maintenance', path: '/settings/maintenance', icon: '🧰', feature: 'host.settings.maintenance' },
] as const

function navItemClass({ isActive }: { isActive: boolean }) {
  return classNames(styles.navItem, isActive && styles.navItemActive)
}

/** The "Setup" panel shell — a permission-filtered sub-nav (User/Role/Maintenance) plus routed content. */
export function SetupPanel() {
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const isAdministrator = Boolean(useAuthStore((s) => s.user)?.isAdministrator)
  const navigate = useNavigate()

  const visibleSections = SECTIONS.filter((s) => isAdministrator || hasCapability(s.feature, 'View'))

  return (
    <div className={styles.layout}>
      <nav className={styles.nav} aria-label="Setup">
        <div className={styles.navHeader}>
          <span className={styles.navTitle}>Setup</span>
          <button type="button" className={styles.closeButton} aria-label="Close Setup" onClick={() => navigate('/')}>
            ✕
          </button>
        </div>

        <div className={styles.navList}>
          {visibleSections.map((section) => (
            <NavLink key={section.key} to={section.path} className={navItemClass}>
              <span aria-hidden="true">{section.icon}</span>
              <span>{section.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}
