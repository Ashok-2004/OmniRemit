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
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function Topbar({ userName, settingsAccess, onLogout }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const userTriggerRef = useRef<HTMLButtonElement>(null)

  const openSettings = useSettingsDrawerStore((s) => s.open)

  useClickOutside([menuRef], () => setMenuOpen(false), menuOpen)
  const handleUserMenuKeyDown = useMenuKeyboardNav(menuRef, () => setMenuOpen(false), userTriggerRef)

  const canAccessSettings = Boolean(settingsAccess?.users || settingsAccess?.roles || settingsAccess?.applications)

  return (
    <header className={styles.topbar}>
      {/* Search Input */}
      <div className={styles.search}>
        <Icon.Search width={16} height={16} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search..."
        />
      </div>

      {/* Top Right Action Items */}
      <div className={styles.actions}>
        {/* Settings Gear Button (Opens Slide-over Drawer) */}
        {canAccessSettings && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Settings"
            onClick={() => openSettings('users')}
            title="System Settings"
          >
            <Icon.Settings width={18} height={18} />
          </button>
        )}

        {/* Notification Bell with dot */}
        <button type="button" className={styles.iconButton} aria-label="Notifications" title="Notifications">
          <Icon.Bell width={18} height={18} />
          <span className={styles.notificationDot} />
        </button>

        {/* User Pill Dropdown */}
        <div className={styles.menuWrapper} ref={menuRef} onKeyDown={handleUserMenuKeyDown}>
          <button
            ref={userTriggerRef}
            type="button"
            className={styles.userButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className={styles.avatar} aria-hidden="true">
              {getUserInitials(userName)}
            </span>
            <span className={styles.userName}>{userName || 'Super Admin'}</span>
            <Icon.ChevronDown width={14} height={14} className={styles.userChevron} />
          </button>

          {menuOpen && (
            <div className={styles.menu} role="menu">
              <div className={styles.menuUserHeader}>
                <span className={styles.menuUserHeaderName}>{userName || 'Super Admin'}</span>
                <span className={styles.menuUserHeaderRole}>Platform Administrator</span>
              </div>
              <div className={styles.menuDivider} />

              <Link to="/profile" role="menuitem" className={styles.menuItem} onClick={() => setMenuOpen(false)}>
                <Icon.Users width={16} height={16} />
                <span>My Profile</span>
              </Link>
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false)
                  openSettings('users')
                }}
              >
                <Icon.Settings width={16} height={16} />
                <span>Settings</span>
              </button>
              <div className={styles.menuDivider} />
              <button
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => {
                  setMenuOpen(false)
                  onLogout?.()
                }}
              >
                <Icon.LogOut width={16} height={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
