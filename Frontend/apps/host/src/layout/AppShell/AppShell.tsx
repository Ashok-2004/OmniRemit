import { Outlet } from 'react-router-dom'
import { Sidebar, type SidebarAppItem } from '../Sidebar/Sidebar'
import { Topbar } from '../Topbar/Topbar'
import styles from './AppShell.module.css'

export interface AppShellProps {
  apps?: SidebarAppItem[]
  userName?: string
  canAccessSettings?: boolean
  onLogout?: () => void
}

/** The authenticated-area frame: sidebar + topbar + routed content. Real data is threaded in from App.tsx. */
export function AppShell({ apps, userName, canAccessSettings, onLogout }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar apps={apps} />
      <div className={styles.main}>
        <Topbar userName={userName} canAccessSettings={canAccessSettings} onLogout={onLogout} />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
