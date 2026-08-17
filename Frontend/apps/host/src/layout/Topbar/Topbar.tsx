import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClickOutside } from '../../shared/hooks/useClickOutside'
import { useMenuKeyboardNav } from '../../shared/hooks/useMenuKeyboardNav'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
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

function getUserInitials(name?: string | null): string {
  if (!name) return 'SA'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Topbar({ userName, settingsAccess, onLogout }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef      = useRef<HTMLDivElement>(null)
  const triggerRef   = useRef<HTMLButtonElement>(null)

  const openSettings = useSettingsDrawerStore((s) => s.open)

  useClickOutside([menuRef], () => setMenuOpen(false), menuOpen)
  const handleKeyDown = useMenuKeyboardNav(menuRef, () => setMenuOpen(false), triggerRef)

  const canAccessSettings = Boolean(
    settingsAccess?.users || settingsAccess?.roles || settingsAccess?.applications
  )
  const displayName = userName || 'Super Admin'

  return (
    <header className={styles.topbar}>

      {/* Search */}
      <div className={styles.search}>
        <Icon.Search width={15} height={15} className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search..."
          aria-label="Search"
        />
      </div>

      {/* Right actions */}
      <div className={styles.actions}>

        {/* Settings gear */}
        {canAccessSettings && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Settings"
            title="System Settings"
            onClick={() => openSettings('users')}
          >
            <Icon.Settings width={17} height={17} />
          </button>
        )}

        {/* Notifications */}
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Notifications"
          title="Notifications"
        >
          <Icon.Bell width={17} height={17} />
          <span className={styles.notificationDot} />
        </button>

        <div className={styles.actionsDivider} aria-hidden="true" />

        {/* User pill */}
        <div className={styles.menuWrapper} ref={menuRef} onKeyDown={handleKeyDown}>
          <button
            ref={triggerRef}
            type="button"
            className={styles.userButton}
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className={styles.avatar} aria-hidden="true">
              {getUserInitials(userName)}
            </span>
            <span className={styles.userName}>{displayName}</span>
            <Icon.ChevronDown width={13} height={13} className={styles.userChevron} />
          </button>

          {menuOpen && (
            <div className={styles.menu} role="menu">

              {/* User header */}
              <div className={styles.menuUserHeader}>
                <span className={styles.menuUserHeaderAvatar} aria-hidden="true">
                  {getUserInitials(userName)}
                </span>
                <div className={styles.menuUserHeaderInfo}>
                  <span className={styles.menuUserHeaderName}>{displayName}</span>
                  <span className={styles.menuUserHeaderRole}>Platform Administrator</span>
                </div>
              </div>
              <div className={styles.menuDivider} />

              <Link
                to="/profile"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => setMenuOpen(false)}
              >
                <Icon.Users width={15} height={15} />
                <span>My Profile</span>
              </Link>

              {canAccessSettings && (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => { setMenuOpen(false); openSettings('users') }}
                >
                  <Icon.Settings width={15} height={15} />
                  <span>Settings</span>
                </button>
              )}

              <div className={styles.menuDivider} />

              <button
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => { setMenuOpen(false); onLogout?.() }}
              >
                <Icon.LogOut width={15} height={15} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
