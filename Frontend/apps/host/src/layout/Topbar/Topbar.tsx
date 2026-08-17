import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClickOutside } from '../../shared/hooks/useClickOutside'
import { useMenuKeyboardNav } from '../../shared/hooks/useMenuKeyboardNav'
import { Icon } from '../../shared/components/Icon/Icon'
import { SecurityAlertsMenu } from '../../features/notifications/components/SecurityAlertsMenu/SecurityAlertsMenu'
import { GlobalSearch } from '../../features/search/components/GlobalSearch/GlobalSearch'
import { SettingsDrawer } from '../SettingsDrawer/SettingsDrawer'
import styles from './Topbar.module.css'

export interface TopbarSettingsAccess {
  users: boolean
  roles: boolean
  applications: boolean
}

export interface TopbarProps {
  userName?: string
  settingsAccess?: TopbarSettingsAccess
  /** Gates the security-alerts bell, whose contents are audit-log rows. */
  canAccessAuditLogs?: boolean
  onLogout?: () => void
}

/**
 * Gear icon opens the Settings drawer (see layout/SettingsDrawer).
 *
 * It was previously a small popover listing Users/Roles/Applications, and those same three also sat
 * in the sidebar — two simultaneous routes to the same pages. The sidebar entries are gone; this is
 * now the single entry point, and the drawer adds a live summary of whichever area you are in.
 */

export function Topbar({ userName, settingsAccess, canAccessAuditLogs, onLogout }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const userTriggerRef = useRef<HTMLButtonElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)

  useClickOutside([menuRef], () => setMenuOpen(false), menuOpen)

  const handleUserMenuKeyDown = useMenuKeyboardNav(menuRef, () => setMenuOpen(false), userTriggerRef)

  const initial = userName?.trim().charAt(0).toUpperCase() || '?'
  const hasAnySettingsAccess = Boolean(settingsAccess && (settingsAccess.users || settingsAccess.roles || settingsAccess.applications))

  return (
    <header className={styles.topbar}>
      <GlobalSearch />

      <div className={styles.actions}>
        {hasAnySettingsAccess && (
          <button
            ref={settingsTriggerRef}
            type="button"
            className={styles.iconButton}
            aria-label="Settings"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <Icon.Settings width={18} height={18} />
          </button>
        )}

        {/*
          Gated on the audit-log View capability: the alerts are audit rows, so someone who cannot
          read the audit log must not see a bell at all — an empty bell would be worse than none,
          and a populated one would leak data they aren't entitled to.
        */}
        {canAccessAuditLogs && <SecurityAlertsMenu />}

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
              {initial}
            </span>
            {userName && <span className={styles.userName}>{userName}</span>}
          </button>

          {menuOpen && (
            <div className={styles.menu} role="menu">
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
                  onLogout?.()
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rendered here rather than in AppShell so the gear's own focus-restore target is the trigger
          that opened it — Drawer returns focus to whatever was focused when it mounted. */}
      {settingsAccess && (
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          access={settingsAccess}
        />
      )}
    </header>
  )
}
