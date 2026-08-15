import { Outlet } from 'react-router-dom'
import { Sidebar, type SidebarAppItem } from '../Sidebar/Sidebar'
import { Topbar, type TopbarSettingsAccess } from '../Topbar/Topbar'
import styles from './AppShell.module.css'

export interface AppShellProps {
  apps?: SidebarAppItem[]
  userName?: string
  settingsAccess?: TopbarSettingsAccess
  canAccessAuditLogs?: boolean
  onLogout?: () => void
}

/** The authenticated-area frame: sidebar + topbar + routed content. Real data is threaded in from App.tsx. */
export function AppShell({ apps, userName, settingsAccess, canAccessAuditLogs, onLogout }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar apps={apps} canAccessAuditLogs={canAccessAuditLogs} />
      <div className={styles.main}>
        <Topbar userName={userName} settingsAccess={settingsAccess} onLogout={onLogout} />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
