import { Outlet } from 'react-router-dom'
import { Sidebar, type SidebarAppItem } from '../Sidebar/Sidebar'
import { Topbar, type TopbarSettingsAccess } from '../Topbar/Topbar'
import styles from './AppShell.module.css'

export interface AppShellProps {
  apps?: SidebarAppItem[]
  /** Set when the registry fetch failed, so the sidebar can say so instead of claiming nothing is registered. */
  appsError?: string | null
  userName?: string
  /** Shown under the name in the sidebar's user card. */
  userEmail?: string
  settingsAccess?: TopbarSettingsAccess
  canAccessAuditLogs?: boolean
  onLogout?: () => void
}

/** The authenticated-area frame: sidebar + topbar + routed content. Real data is threaded in from App.tsx. */
export function AppShell({ apps, appsError, userName, userEmail, settingsAccess, canAccessAuditLogs, onLogout }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar
        apps={apps}
        error={appsError}
        canAccessAuditLogs={canAccessAuditLogs}
        user={{ name: userName, email: userEmail }}
      />
      <div className={styles.main}>
        <Topbar
          userName={userName}
          settingsAccess={settingsAccess}
          canAccessAuditLogs={canAccessAuditLogs}
          onLogout={onLogout}
        />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
