import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { classNames } from '../../shared/utils/classNames'
import { useAuthStore } from '../../features/auth/store/authStore'
import { Icon } from '../../shared/components/Icon/Icon'
import styles from './SetupPanel.module.css'

const SECTIONS = [
  { key: 'users', label: 'User', path: '/settings/users', Icon: Icon.Users, feature: 'host.settings.users' },
  { key: 'roles', label: 'Role', path: '/settings/roles', Icon: Icon.ShieldCheck, feature: 'host.settings.roles' },
  { key: 'applications', label: 'Applications', path: '/settings/applications', Icon: Icon.Grid, feature: 'host.settings.applications' },
] as const

function navItemClass({ isActive }: { isActive: boolean }) {
  return classNames(styles.navItem, isActive && styles.navItemActive)
}

/** The "Setup" panel shell — a permission-filtered sub-nav (User/Role/Applications) plus routed content. */
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
              <section.Icon width={18} height={18} />
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
