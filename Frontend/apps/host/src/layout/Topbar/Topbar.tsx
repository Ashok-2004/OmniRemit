import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClickOutside } from '../../shared/hooks/useClickOutside'
import styles from './Topbar.module.css'

export interface TopbarProps {
  userName?: string
  canAccessSettings?: boolean
  onLogout?: () => void
}

export function Topbar({ userName, canAccessSettings, onLogout }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside([menuRef], () => setMenuOpen(false), menuOpen)

  const initial = userName?.trim().charAt(0).toUpperCase() || '?'

  return (
    <header className={styles.topbar}>
      <div className={styles.search} aria-hidden="true">
        <span>🔍</span>
        <span>Search…</span>
      </div>

      <div className={styles.actions}>
        {canAccessSettings && (
          <Link to="/settings" className={styles.iconButton} aria-label="Setup">
            ⚙
          </Link>
        )}
        <button type="button" className={styles.iconButton} aria-label="Notifications">
          🔔
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
