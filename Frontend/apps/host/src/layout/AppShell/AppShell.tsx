import { Outlet } from 'react-router-dom'
import { Sidebar, type SidebarAppItem } from '../Sidebar/Sidebar'
import { Topbar, type TopbarSettingsAccess } from '../Topbar/Topbar'
import { SettingsDrawer } from '../SettingsDrawer/SettingsDrawer'
import styles from './AppShell.module.css'

export interface AppShellProps {
  apps?: SidebarAppItem[]
  appsError?: string | null
  userName?: string
  settingsAccess?: TopbarSettingsAccess
  canAccessAuditLogs?: boolean
  onLogout?: () => void
}

export function AppShell({ apps, appsError, userName, settingsAccess, canAccessAuditLogs, onLogout }: AppShellProps) {
  return (
    <div className={styles.shell}>
      {/* Sidebar — only receives app-list and system-access props; profile is in Topbar */}
      <Sidebar
        apps={apps}
        error={appsError}
        canAccessAuditLogs={canAccessAuditLogs}
      />

      <div className={styles.main}>
        {/* Topbar — single source of truth for user identity & profile actions */}
        <Topbar
          userName={userName}
          settingsAccess={settingsAccess}
          onLogout={onLogout}
        />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>

      {/* Global slide-over settings & override layers */}
      <SettingsDrawer />
    </div>
  )
}
