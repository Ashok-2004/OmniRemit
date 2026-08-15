import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClickOutside } from '../../shared/hooks/useClickOutside'
import { Icon } from '../../shared/components/Icon/Icon'
import styles from './Topbar.module.css'

export interface TopbarSettingsAccess {
  users: boolean
  roles: boolean
  applications: boolean
}

export interface TopbarProps {
  userName?: string
  settingsAccess?: TopbarSettingsAccess
  onLogout?: () => void
}

/**
 * Gear icon → grouped popover menu, not a page nav — the same pattern GitHub's org gear, Vercel's
 * project settings button, and most other multi-tenant admin dashboards use: the entry point stays
 * a single lightweight icon in the topbar, and only the items the caller can actually use appear
 * inside. Each item still routes into the existing SetupPanel sub-nav, so nothing about the
 * destination pages changes — only how you get there.
 */
const SETTINGS_LINKS = [
  { key: 'users' as const, label: 'Users', path: '/settings/users', Icon: Icon.Users },
  { key: 'roles' as const, label: 'Roles', path: '/settings/roles', Icon: Icon.ShieldCheck },
  { key: 'applications' as const, label: 'Applications', path: '/settings/applications', Icon: Icon.Grid },
]

export function Topbar({ userName, settingsAccess, onLogout }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  useClickOutside([menuRef], () => setMenuOpen(false), menuOpen)
  useClickOutside([settingsRef], () => setSettingsOpen(false), settingsOpen)

  const initial = userName?.trim().charAt(0).toUpperCase() || '?'
  const visibleSettingsLinks = SETTINGS_LINKS.filter((link) => settingsAccess?.[link.key])

  return (
    <header className={styles.topbar}>
      <div className={styles.search} aria-hidden="true">
        <Icon.Search width={16} height={16} />
        <span>Search…</span>
      </div>

      <div className={styles.actions}>
        {visibleSettingsLinks.length > 0 && (
          <div className={styles.menuWrapper} ref={settingsRef}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Settings"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Icon.Settings width={18} height={18} />
            </button>

            {settingsOpen && (
              <div className={styles.menu} role="menu">
                <div className={styles.menuLabel}>Setup</div>
                {visibleSettingsLinks.map((link) => (
                  <Link
                    key={link.key}
                    to={link.path}
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => setSettingsOpen(false)}
                  >
                    <link.Icon width={16} height={16} />
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <button type="button" className={styles.iconButton} aria-label="Notifications">
          <Icon.Bell width={18} height={18} />
        </button>

        <div className={styles.menuWrapper} ref={menuRef}>
          <button
            type="button"
            className={styles.userButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className={styles.avatar} aria-hidden="true">
              {initial}
            </span>
            {userName && <span className={styles.userName}>{userName}</span>}
          </button>

          {menuOpen && (
            <div className={styles.menu} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false)
                  onLogout?.()
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
