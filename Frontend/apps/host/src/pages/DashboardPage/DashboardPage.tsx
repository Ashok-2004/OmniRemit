import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../features/auth/store/authStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { IconTile } from '../../shared/components/IconTile/IconTile'
import { StatCard } from '../../shared/components/StatCard/StatCard'
import { DonutChart, type DonutSegment } from '../../shared/components/DonutChart/DonutChart'
import { BarList } from '../../shared/components/BarList/BarList'
import { SkeletonText } from '../../shared/components/Skeleton'
import { EmptyState } from '../../shared/components/EmptyState/EmptyState'
import { queryKeys } from '../../shared/query/queryKeys'
import { ApiError } from '../../shared/api/httpClient'
import { dashboardApi } from '../../features/dashboard/api/dashboardApi'
import { auditLogsApi } from '../../features/system-audit-logs/api/auditLogsApi'
import { SystemHealthPanel } from '../../features/dashboard/components/SystemHealthPanel/SystemHealthPanel'
import styles from './DashboardPage.module.css'

const FEATURE_KEYS = {
  users: 'host.settings.users',
  roles: 'host.settings.roles',
  auditLogs: 'host.system.audit-logs',
} as const

const RECENT_LIMIT = 5

/** Slice colours, in order. Token-backed so the donut follows the palette. */
const DONUT_COLORS = [
  'var(--omni-color-primary-600)',
  '#7c3aed',
  'var(--omni-color-success)',
  'var(--omni-color-warning)',
  '#0891b2',
  'var(--omni-color-text-muted)',
]

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

function formatTime(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/** Picks a row icon from the action namespace, so the feed is scannable without reading every line. */
function activityIcon(action: string) {
  if (action.startsWith('user.')) return { icon: <Icon.Users width={16} height={16} />, tone: 'primary' as const }
  if (action.startsWith('role.')) return { icon: <Icon.ShieldCheck width={16} height={16} />, tone: 'info' as const }
  if (action.startsWith('remoteapp.')) return { icon: <Icon.Grid width={16} height={16} />, tone: 'success' as const }
  if (action.startsWith('auth.')) return { icon: <Icon.Lock width={16} height={16} />, tone: 'warning' as const }
  return { icon: <Icon.FileText width={16} height={16} />, tone: 'neutral' as const }
}

/**
 * Landing page after login.
 *
 * Everything is real, permission-gated backend data. A count the caller cannot see comes back null
 * and its card is omitted entirely rather than rendered as a fabricated zero, and a trend is shown
 * only where a genuine previous-period baseline exists.
 */
export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)

  const isAdministrator = Boolean(user?.isAdministrator)
  const canViewUsers = isAdministrator || hasCapability(FEATURE_KEYS.users, 'View')
  const canViewRoles = isAdministrator || hasCapability(FEATURE_KEYS.roles, 'View')
  const canViewAudit = isAdministrator || hasCapability(FEATURE_KEYS.auditLogs, 'View')

  const statsQuery = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => dashboardApi.stats(accessToken!),
    enabled: Boolean(accessToken),
  })

  const healthQuery = useQuery({
    queryKey: queryKeys.dashboard.health(),
    queryFn: () => dashboardApi.health(accessToken!),
    enabled: Boolean(accessToken),
    // Health is the one thing here that genuinely changes minute to minute, and the backend probes
    // on its own interval — polling stops a stale "Operational" sitting on screen for a dead app.
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const activityQuery = useQuery({
    queryKey: [...queryKeys.auditLogs.all(), 'recent', 'dashboard'],
    queryFn: () => auditLogsApi.list(accessToken!, { page: 1, pageSize: RECENT_LIMIT }),
    enabled: Boolean(accessToken) && canViewAudit,
  })

  const stats = statsQuery.data
  const statsLoading = statsQuery.isPending

  const donutSegments: DonutSegment[] = (stats?.roleDistribution ?? []).map((entry, i) => ({
    label: entry.roleName,
    value: entry.userCount,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }))

  const barItems = (stats?.serviceActivity ?? []).map((entry) => ({
    id: entry.serviceName,
    label: entry.serviceName,
    value: entry.eventCount,
    icon: (
      <IconTile tone="primary" size="sm">
        <Icon.Activity width={16} height={16} />
      </IconTile>
    ),
  }))

  const lastLogin = user?.lastLoginAt ? new Date(user.lastLoginAt) : null
  const lastLoginLabel =
    lastLogin && !Number.isNaN(lastLogin.getTime()) ? lastLogin.toLocaleDateString(undefined, { dateStyle: 'medium' }) : null

  const unreachableCount = healthQuery.data?.filter((a) => a.health === 'Unreachable').length ?? 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>
            {user?.name ? `Welcome back, ${user.name}` : 'Welcome back'}
            <span className={styles.wave} aria-hidden="true">
              {' '}
              👋
            </span>
          </h1>
          <p className={styles.subtitle}>Here&rsquo;s what&rsquo;s happening with your system today.</p>
        </div>

        {/* Shows the caller's real last sign-in rather than a date filter — nothing on this page is
            filtered by date, and a control that changes nothing would be the same problem as the
            old fake search box. */}
        {lastLoginLabel && (
          <div className={styles.lastLogin}>
            <Icon.Calendar width={16} height={16} />
            <span>Last sign-in {lastLoginLabel}</span>
          </div>
        )}
      </header>

      <div className={styles.statGrid}>
        {canViewUsers && (
          <StatCard
            index={0}
            label="Total Users"
            value={stats?.users ?? null}
            trend={stats?.usersTrend ?? null}
            caption={stats?.activeUsers != null ? `${stats.activeUsers.toLocaleString()} active` : undefined}
            icon={<Icon.Users width={20} height={20} />}
            tone="primary"
            to="/settings/users"
            loading={statsLoading}
          />
        )}
        {canViewRoles && (
          <StatCard
            index={1}
            label="Total Roles"
            value={stats?.roles ?? null}
            trend={stats?.rolesTrend ?? null}
            icon={<Icon.ShieldCheck width={20} height={20} />}
            tone="info"
            to="/settings/roles"
            loading={statsLoading}
          />
        )}
        <StatCard
          index={2}
          label="Applications"
          value={healthQuery.data?.length ?? null}
          caption={unreachableCount > 0 ? `${unreachableCount} not responding` : 'All operational'}
          icon={<Icon.Grid width={20} height={20} />}
          tone={unreachableCount > 0 ? 'danger' : 'success'}
          to="/settings/applications"
          loading={healthQuery.isPending}
        />
        {canViewAudit && (
          <StatCard
            index={3}
            label="Audit Events"
            value={stats?.auditEvents ?? null}
            trend={stats?.auditEventsTrend ?? null}
            icon={<Icon.FileText width={20} height={20} />}
            tone="warning"
            to="/system/audit-logs"
            loading={statsLoading}
          />
        )}
      </div>

      <div className={styles.chartGrid}>
        {canViewUsers && canViewRoles && (
          <section className={styles.panel} aria-labelledby="users-by-role-heading">
            <div className={styles.panelHeader}>
              <h2 id="users-by-role-heading" className={styles.panelTitle}>
                Users by Role
              </h2>
            </div>

            {statsLoading ? (
              <SkeletonText lines={5} />
            ) : donutSegments.length === 0 ? (
              <EmptyState
                icon={<Icon.Users width={22} height={22} />}
                title="No users yet"
                description="Role distribution appears once accounts exist."
              />
            ) : (
              <DonutChart segments={donutSegments} centerLabel="Total" />
            )}
          </section>
        )}

        {canViewAudit && (
          <section className={styles.panel} aria-labelledby="service-activity-heading">
            <div className={styles.panelHeader}>
              <h2 id="service-activity-heading" className={styles.panelTitle}>
                Activity by Service
              </h2>
              <span className={styles.panelHint}>Last 30 days</span>
            </div>

            {statsLoading ? (
              <SkeletonText lines={5} />
            ) : (
              <BarList items={barItems} emptyMessage="No activity recorded in the last 30 days." />
            )}
          </section>
        )}
      </div>

      <div className={styles.bottomGrid}>
        {canViewAudit && (
          <section className={styles.panel} aria-labelledby="system-activity-heading">
            <div className={styles.panelHeader}>
              <h2 id="system-activity-heading" className={styles.panelTitle}>
                System Activity
              </h2>
              <a className={styles.viewAll} href="/system/audit-logs">
                View all
              </a>
            </div>

            {activityQuery.isPending ? (
              <SkeletonText lines={5} />
            ) : activityQuery.isError ? (
              <p className={styles.panelError}>{errorMessage(activityQuery.error, 'Could not load recent activity.')}</p>
            ) : !activityQuery.data || activityQuery.data.items.length === 0 ? (
              <EmptyState
                icon={<Icon.FileText width={22} height={22} />}
                title="No activity yet"
                description="Actions across the platform will appear here as they happen."
              />
            ) : (
              <ul className={styles.activityList}>
                {activityQuery.data.items.map((entry, index) => {
                  const { icon, tone } = activityIcon(entry.action)
                  return (
                    <li className={styles.activityRow} key={entry.id} style={{ animationDelay: `${index * 45}ms` }}>
                      <IconTile tone={tone} size="sm">
                        {icon}
                      </IconTile>
                      <div className={styles.activityText}>
                        <span className={styles.activityActor}>{entry.actorName ?? 'System'}</span>
                        <span className={styles.activityDetail}>{entry.details ?? entry.action}</span>
                      </div>
                      <time className={styles.activityTime} dateTime={entry.occurredAt}>
                        {formatTime(entry.occurredAt)}
                      </time>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        <SystemHealthPanel
          entries={healthQuery.data}
          loading={healthQuery.isPending}
          error={healthQuery.isError ? errorMessage(healthQuery.error, 'Could not load application health.') : null}
        />
      </div>
    </div>
  )
}
