import { Suspense, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar, type SidebarAppItem } from '../Sidebar/Sidebar'
import { Topbar, type TopbarSettingsAccess } from '../Topbar/Topbar'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { lazyWithPreload, preloadWhenIdle } from '../../shared/utils/lazyWithPreload'
import styles from './AppShell.module.css'

/**
 * The settings drawer is by far the largest component in the app — the drawer plus its three tabs and
 * three form layers are several thousand lines, and the form layers pull in the permission catalog
 * editor. It was imported statically here, so all of it (and its CSS) shipped in the eager entry
 * chunk that every user downloads before the login form is interactive, even though the drawer renders
 * nothing at all until someone clicks the gear.
 *
 * Splitting it out defers that cost to the moment it is genuinely needed, and `preloadWhenIdle` then
 * fetches it during idle time after the shell has mounted — so by the time an admin reaches for the
 * gear the chunk is already parsed and it opens instantly. Cheaper first paint, no slower interaction.
 */
const { Component: SettingsDrawer, preload: preloadSettingsDrawer } = lazyWithPreload(() =>
  import('../SettingsDrawer/SettingsDrawer').then((m) => ({ default: m.SettingsDrawer })),
)

export interface AppShellProps {
  apps?: SidebarAppItem[]
  appsError?: string | null
  userName?: string
  settingsAccess?: TopbarSettingsAccess
  canAccessAuditLogs?: boolean
  onLogout?: () => void
}

export function AppShell({ apps, appsError, userName, settingsAccess, canAccessAuditLogs, onLogout }: AppShellProps) {
  // Subscribed so the drawer is only mounted when it is actually open. Mounting it unconditionally
  // would negate the split — React would resolve the lazy component on first render regardless.
  const drawerOpen = useSettingsDrawerStore((s) => s.isOpen)

  useEffect(() => {
    preloadWhenIdle(preloadSettingsDrawer)
  }, [])

  return (
    <div className={styles.shell}>
      <Sidebar
        apps={apps}
        error={appsError}
        canAccessAuditLogs={canAccessAuditLogs}
        userName={userName}
        onLogout={onLogout}
      />
      <div className={styles.main}>
        <Topbar userName={userName} settingsAccess={settingsAccess} onLogout={onLogout} />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>

      {/*
        Global right-side slide-over settings and override layers.

        No Suspense fallback is rendered: the drawer animates in from the edge, so a spinner in its
        place would be a visible flash of nothing where a panel is about to be. The idle preload means
        the chunk is normally already resolved by the time this mounts; in the rare case it is not, the
        drawer simply appears a moment later, which is indistinguishable from a slightly slower animation.
      */}
      {drawerOpen && (
        <Suspense fallback={null}>
          <SettingsDrawer />
        </Suspense>
      )}
    </div>
  )
}
