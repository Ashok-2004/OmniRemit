import { useEffect, useState } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { usersApi } from '../../features/settings-users/api/usersApi'
import { rolesApi } from '../../features/settings-roles/api/rolesApi'
import { remoteAppsApi } from '../../features/settings-maintenance/api/remoteAppsApi'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import styles from './DashboardPage.module.css'

interface Stat {
  label: string
  value: number
}

/**
 * Landing page after login. Stat cards are sourced from real, permission-gated counts — a
 * capability the user lacks simply means its card never appears, rather than showing a fabricated
 * zero. Each count is a pageSize=1 request, so this stays O(1) regardless of table size.
 */
export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const [stats, setStats] = useState<Stat[] | null>(null)

  const canViewUsers = Boolean(user?.isAdministrator) || hasCapability('host.settings.users', 'View')
  const canViewRoles = Boolean(user?.isAdministrator) || hasCapability('host.settings.roles', 'View')
  const canViewApps = Boolean(user?.isAdministrator) || hasCapability('host.settings.maintenance', 'View')

  useEffect(() => {
    const token = accessToken
    if (!token) return
    let cancelled = false

    async function load(token: string) {
      const requests: Promise<Stat>[] = []
      if (canViewUsers) requests.push(usersApi.list(token, { pageSize: 1 }).then((r) => ({ label: 'Users', value: r.total })))
      if (canViewRoles) requests.push(rolesApi.list(token, { pageSize: 1 }).then((r) => ({ label: 'Roles', value: r.total })))
      if (canViewApps)
        requests.push(remoteAppsApi.list(token, { pageSize: 1 }).then((r) => ({ label: 'Registered apps', value: r.total })))

      try {
        const results = await Promise.all(requests)
        if (!cancelled) setStats(results)
      } catch {
        if (!cancelled) setStats([])
      }
    }

    void load(token)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, canViewUsers, canViewRoles, canViewApps])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Overview</span>
        <h1 className={styles.title}>{user?.name ? `Welcome back, ${user.name}` : 'Welcome back'}</h1>
      </div>

      {(stats === null || stats.length > 0) && (
        <div className={styles.statGrid}>
          {(stats ?? Array.from({ length: (canViewUsers ? 1 : 0) + (canViewRoles ? 1 : 0) + (canViewApps ? 1 : 0) || 1 })).map(
            (stat, i) => (
              <div className={styles.statCard} key={stat && 'label' in stat ? stat.label : i}>
                {stat && 'label' in stat ? (
                  <>
                    <span className={styles.statLabel}>{stat.label}</span>
                    <span className={styles.statValue}>{stat.value}</span>
                  </>
                ) : (
                  <>
                    <SkeletonBlock height={14} width="60%" />
                    <SkeletonBlock height={28} width="40%" />
                  </>
                )}
              </div>
            ),
          )}
        </div>
      )}

      <div className={styles.card}>
        <h2>Getting started</h2>
        <p>
          Remote apps you have access to appear in the sidebar once an administrator registers them
          in Setup &gt; Maintenance. If you don't see anything there yet, ask an administrator to
          register your first app.
        </p>
      </div>
    </div>
  )
}
