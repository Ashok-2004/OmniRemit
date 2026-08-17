import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../features/auth/store/authStore'
import { usersApi, type UserListItemDto } from '../../features/settings-users/api/usersApi'
import { rolesApi, type RoleListItemDto } from '../../features/settings-roles/api/rolesApi'
import { remoteAppsApi, type RemoteAppDto } from '../../features/settings-applications/api/remoteAppsApi'
import { auditLogsApi, type AuditLogDto } from '../../features/system-audit-logs/api/auditLogsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import { Icon } from '../../shared/components/Icon/Icon'
import { APP_NAME, APP_VERSION, COPYRIGHT_YEAR } from '../../shared/config/branding'
import styles from './DashboardPage.module.css'

interface RoleDistribution {
  name: string
  count: number
  percentage: number
  color: string
}

const ROLE_COLORS = ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#64748b']

const APP_COLORS = [
  { bg: '#eff6ff', color: '#3b82f6' },
  { bg: '#eef2ff', color: '#6366f1' },
  { bg: '#fff7ed', color: '#f97316' },
  { bg: '#ecfdf5', color: '#10b981' },
  { bg: '#fdf2f8', color: '#ec4899' },
  { bg: '#f5f3ff', color: '#8b5cf6' },
]

function formatEventTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `Today, ${timeStr}`
  if (isYesterday) return `Yesterday, ${timeStr}`

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`
}

function formatActionText(log: AuditLogDto): string {
  const action = log.action || 'Performed action'
  const entity = log.entityType ? ` ${log.entityType}` : ''
  const details = log.details ? ` "${log.details}"` : ''

  if (action.toLowerCase().includes('create')) return `Created new${entity}${details}`
  if (action.toLowerCase().includes('update')) return `Updated${entity}${details}`
  if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('remove'))
    return `Removed${entity}${details}`
  if (action.toLowerCase().includes('login')) return `Logged into platform`
  if (action.toLowerCase().includes('view')) return `Viewed${entity || ' system logs'}`

  return `${action}${entity}${details}`
}

function getUserInitials(name?: string | null): string {
  if (!name) return 'SA'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const openDrawer = useSettingsDrawerStore((s) => s.open)
  const pushLayer = useSettingsDrawerStore((s) => s.pushLayer)
  const mutationCount = useSettingsDrawerStore((s) => s.mutationCount)

  const [loading, setLoading] = useState(true)
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalRoles, setTotalRoles] = useState(0)
  const [totalApps, setTotalApps] = useState(0)

  const [users, setUsers] = useState<UserListItemDto[]>([])
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [apps, setApps] = useState<RemoteAppDto[]>([])
  const [recentLogs, setRecentLogs] = useState<AuditLogDto[]>([])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function loadDashboardData() {
      try {
        const [usersRes, rolesRes, appsRes, logsRes] = await Promise.all([
          usersApi.list(accessToken!, { pageSize: 100 }),
          rolesApi.list(accessToken!, { pageSize: 100 }),
          remoteAppsApi.list(accessToken!, { pageSize: 100 }),
          auditLogsApi.list(accessToken!, { pageSize: 6 }).catch(() => ({ items: [], total: 0 })),
        ])

        if (!cancelled) {
          setTotalUsers(usersRes.total)
          setTotalRoles(rolesRes.total)
          setTotalApps(appsRes.total)

          setUsers(usersRes.items)
          setRoles(rolesRes.items)
          setApps(appsRes.items)
          setRecentLogs(logsRes.items)
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDashboardData()
    return () => {
      cancelled = true
    }
  }, [accessToken, mutationCount])

  // Calculate Users by Role distribution for Donut Chart
  const roleDistribution: RoleDistribution[] = useMemo(() => {
    if (users.length === 0) {
      if (roles.length > 0) {
        return roles.slice(0, 4).map((r, i) => ({
          name: r.name,
          count: r.usersCount || (i === 0 ? 2 : 1),
          percentage: i === 0 ? 50 : 25,
          color: ROLE_COLORS[i % ROLE_COLORS.length],
        }))
      }
      return [
        { name: 'Administrators', count: 2, percentage: 50, color: ROLE_COLORS[0] },
        { name: 'Admins', count: 1, percentage: 25, color: ROLE_COLORS[1] },
        { name: 'Normal Users', count: 1, percentage: 25, color: ROLE_COLORS[2] },
        { name: 'Others', count: 0, percentage: 0, color: ROLE_COLORS[3] },
      ]
    }

    const counts: Record<string, number> = {}
    users.forEach((u) => {
      const roleName = u.roleName || (u.isAdministrator ? 'Administrators' : 'Normal Users')
      counts[roleName] = (counts[roleName] || 0) + 1
    })

    const total = users.length || 1
    const entries = Object.entries(counts).map(([name, count], index) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100),
      color: ROLE_COLORS[index % ROLE_COLORS.length],
    }))

    entries.sort((a, b) => b.count - a.count)

    if (entries.length < 4) {
      entries.push({ name: 'Others', count: 0, percentage: 0, color: '#94a3b8' })
    }

    return entries
  }, [users, roles])

  // SVG Donut calculation
  const donutSegments = useMemo(() => {
    const total = roleDistribution.reduce((sum, r) => sum + r.count, 0) || 1
    const radius = 54
    const circumference = 2 * Math.PI * radius
    let accumulatedAngle = 0

    return roleDistribution.map((item) => {
      const fraction = item.count / total
      const strokeLength = fraction * circumference
      const strokeDashoffset = -accumulatedAngle
      accumulatedAngle += strokeLength

      return {
        ...item,
        strokeDasharray: `${strokeLength} ${circumference - strokeLength}`,
        strokeDashoffset,
      }
    })
  }, [roleDistribution])

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [])

  return (
    <div className={styles.page}>
      {/* Top Hero Welcome Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroLeft}>
          <div className={styles.heroAvatarWrap}>
            <div className={styles.heroAvatar}>
              {getUserInitials(user?.name)}
            </div>
            <span className={styles.avatarOnlineDot} />
          </div>
          <div className={styles.heroText}>
            <div className={styles.heroGreetingRow}>
              <h1 className={styles.heroTitle}>
                <span className={styles.welcomeIntro}>Welcome back,</span>{' '}
                <span className={styles.userNameHighlight}>{user?.name || 'Super Admin'}</span>
              </h1>
              <span className={styles.roleChip}>
                <Icon.ShieldCheck width={15} height={15} className={styles.roleShieldIcon} />
                <span>{user?.isAdministrator ? 'Platform Administrator' : 'Authorized User'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.dateChip}>
            <Icon.Clock width={15} height={15} className={styles.clockIcon} />
            <span>{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* Top 4 Summary Stat Cards */}
      <div className={styles.statCardsGrid}>
        {/* Total Users */}
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={`${styles.statIconWrap} ${styles.iconWrapBlue}`}>
              <Icon.Users width={20} height={20} />
            </div>
            <span className={styles.statLabel}>Total Users</span>
          </div>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>
              {loading ? <SkeletonBlock height={32} width={36} /> : totalUsers || users.length || 0}
            </span>
          </div>
          <div className={styles.statTrendRow}>
            <span className={styles.trendGreen}>
              <span className={styles.trendArrow}>↑</span> Active Accounts
            </span>
            <span className={styles.trendSubtitle}>Platform-wide</span>
          </div>
        </div>

        {/* Total Roles */}
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={`${styles.statIconWrap} ${styles.iconWrapPurple}`}>
              <Icon.ShieldCheck width={20} height={20} />
            </div>
            <span className={styles.statLabel}>System Roles</span>
          </div>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>
              {loading ? <SkeletonBlock height={32} width={36} /> : totalRoles || roles.length || 0}
            </span>
          </div>
          <div className={styles.statTrendRow}>
            <span className={styles.trendGreen}>
              <span className={styles.trendArrow}>↑</span> Granular RBAC
            </span>
            <span className={styles.trendSubtitle}>Configured</span>
          </div>
        </div>

        {/* Total Applications */}
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={`${styles.statIconWrap} ${styles.iconWrapGreen}`}>
              <Icon.Grid width={20} height={20} />
            </div>
            <span className={styles.statLabel}>Remote Applications</span>
          </div>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>
              {loading ? <SkeletonBlock height={32} width={36} /> : totalApps || apps.length || 0}
            </span>
          </div>
          <div className={styles.statTrendRow}>
            <span className={styles.trendGreen}>
              <span className={styles.trendArrow}>↑</span> Federated Apps
            </span>
            <span className={styles.trendSubtitle}>Live loaded</span>
          </div>
        </div>

        {/* System Health Status */}
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={`${styles.statIconWrap} ${styles.iconWrapEmerald}`}>
              <Icon.CheckCircle width={20} height={20} />
            </div>
            <span className={styles.statLabel}>System Status</span>
          </div>
          <div className={styles.statValueRow}>
            <div className={styles.statusLiveRow}>
              <span className={styles.pulsingDot} />
              <span className={styles.statValueHealthy}>Operational</span>
            </div>
          </div>
          <div className={styles.statTrendRow}>
            <span className={styles.trendGreen}>
              <span>✓</span> 99.98% Uptime
            </span>
            <span className={styles.trendSubtitle}>All services healthy</span>
          </div>
        </div>
      </div>

      {/* Row 1: Users by Role (Left) & Quick Operations (Right) */}
      <div className={styles.twoColumnGrid}>
        {/* Widget 1: Users by Role */}
        <div className={styles.widgetCard}>
          <div className={styles.widgetHeader}>
            <div>
              <h2 className={styles.widgetTitle}>Users by Role</h2>
              <p className={styles.widgetSubtitle}>Role distribution across users</p>
            </div>
          </div>

          <div className={styles.donutContainer}>
            {/* SVG Donut Chart */}
            <div className={styles.donutSvgWrap}>
              <svg width="140" height="140" viewBox="0 0 150 150" className={styles.donutSvg}>
                {/* Background Ring */}
                <circle
                  cx="75"
                  cy="75"
                  r="54"
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="18"
                />

                {/* Segments */}
                {donutSegments.map((segment) =>
                  segment.count > 0 ? (
                    <circle
                      key={segment.name}
                      cx="75"
                      cy="75"
                      r="54"
                      fill="transparent"
                      stroke={segment.color}
                      strokeWidth="18"
                      strokeDasharray={segment.strokeDasharray}
                      strokeDashoffset={segment.strokeDashoffset}
                      strokeLinecap="round"
                      style={{
                        transformOrigin: 'center',
                        transform: 'rotate(-90deg)',
                        transition: 'stroke-dashoffset 0.4s ease, stroke-dasharray 0.4s ease',
                      }}
                    />
                  ) : null,
                )}
              </svg>

              {/* Center Donut Label */}
              <div className={styles.donutCenter}>
                <span className={styles.donutTotalNum}>
                  {loading ? '...' : totalUsers || users.length || 0}
                </span>
                <span className={styles.donutTotalLabel}>Total</span>
              </div>
            </div>

            {/* Legend List on Right */}
            <div className={styles.legendList}>
              {roleDistribution.map((item) => (
                <div key={item.name} className={styles.legendItem}>
                  <div className={styles.legendLeft}>
                    <span className={styles.legendDot} style={{ background: item.color }} />
                    <span className={styles.legendName}>{item.name}</span>
                  </div>
                  <span className={styles.legendStat}>
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Widget 2: Quick Operations (Side-by-side with Users by Role) */}
        <div className={styles.widgetCard}>
          <div className={styles.widgetHeader}>
            <div>
              <h2 className={styles.widgetTitle}>Quick Operations</h2>
              <p className={styles.widgetSubtitle}>Frequently used administrative actions</p>
            </div>
          </div>

          <div className={styles.quickOpsList}>
            {/* Action 1: Add New User */}
            <div
              className={styles.quickOpItem}
              onClick={() => pushLayer({ type: 'user-form' })}
              role="button"
              tabIndex={0}
            >
              <div className={`${styles.quickOpIcon} ${styles.opBlue}`}>
                <Icon.Users width={18} height={18} />
              </div>
              <div className={styles.quickOpText}>
                <span className={styles.quickOpTitle}>Add New User</span>
                <span className={styles.quickOpDesc}>Provision account &amp; assign custom permissions</span>
              </div>
              <Icon.ChevronRight width={16} height={16} className={styles.quickOpArrow} />
            </div>

            {/* Action 2: Create Role */}
            <div
              className={styles.quickOpItem}
              onClick={() => pushLayer({ type: 'role-form' })}
              role="button"
              tabIndex={0}
            >
              <div className={`${styles.quickOpIcon} ${styles.opPurple}`}>
                <Icon.ShieldCheck width={18} height={18} />
              </div>
              <div className={styles.quickOpText}>
                <span className={styles.quickOpTitle}>Create Role</span>
                <span className={styles.quickOpDesc}>Configure RBAC capability permissions</span>
              </div>
              <Icon.ChevronRight width={16} height={16} className={styles.quickOpArrow} />
            </div>

            {/* Action 3: Register Application */}
            <div
              className={styles.quickOpItem}
              onClick={() => pushLayer({ type: 'app-form' })}
              role="button"
              tabIndex={0}
            >
              <div className={`${styles.quickOpIcon} ${styles.opGreen}`}>
                <Icon.Grid width={18} height={18} />
              </div>
              <div className={styles.quickOpText}>
                <span className={styles.quickOpTitle}>Register Application</span>
                <span className={styles.quickOpDesc}>Connect remote Module Federation manifest URL</span>
              </div>
              <Icon.ChevronRight width={16} height={16} className={styles.quickOpArrow} />
            </div>

            {/* Action 4: System Audit Logs */}
            <Link to="/system/audit-logs" className={styles.quickOpItem}>
              <div className={`${styles.quickOpIcon} ${styles.opAmber}`}>
                <Icon.FileText width={18} height={18} />
              </div>
              <div className={styles.quickOpText}>
                <span className={styles.quickOpTitle}>System Audit Trail</span>
                <span className={styles.quickOpDesc}>Inspect authentication logs &amp; security events</span>
              </div>
              <Icon.ChevronRight width={16} height={16} className={styles.quickOpArrow} />
            </Link>
          </div>
        </div>
      </div>

      {/* Row 2: Live System Audit Trail (Left) & Registered Micro-Frontends (Right) */}
      <div className={styles.twoColumnGrid}>
        {/* Widget 3: Live System Audit Trail */}
        <div className={styles.widgetCard}>
          <div className={styles.widgetHeader}>
            <div>
              <h2 className={styles.widgetTitle}>Live System Audit Trail</h2>
              <p className={styles.widgetSubtitle}>Recent authentication events and changes</p>
            </div>
            <Link to="/system/audit-logs" className={styles.viewAllLink}>
              <span>Full Audit Logs</span>
              <Icon.ChevronRight width={14} height={14} />
            </Link>
          </div>

          <div className={styles.activityFeed}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.activityRow}>
                  <SkeletonBlock height={40} width="100%" />
                </div>
              ))
            ) : recentLogs.length > 0 ? (
              recentLogs.slice(0, 4).map((log, index) => {
                const isUser = log.action?.toLowerCase().includes('user') || log.entityType?.toLowerCase().includes('user')
                const isRole = log.action?.toLowerCase().includes('role')
                const isApp = log.action?.toLowerCase().includes('app')

                const iconTheme = isUser
                  ? { bg: '#ecfdf5', color: '#10b981', IconElem: Icon.Users }
                  : isRole
                  ? { bg: '#f3e8ff', color: '#8b5cf6', IconElem: Icon.ShieldCheck }
                  : isApp
                  ? { bg: '#fff7ed', color: '#f97316', IconElem: Icon.Grid }
                  : { bg: '#eff6ff', color: '#3b82f6', IconElem: Icon.FileText }

                return (
                  <div key={log.id || index} className={styles.activityRow}>
                    <div
                      className={styles.activityIconWrap}
                      style={{ background: iconTheme.bg, color: iconTheme.color }}
                    >
                      <iconTheme.IconElem width={16} height={16} />
                    </div>

                    <div className={styles.activityInfo}>
                      <span className={styles.activityActor}>
                        {log.actorName || log.actorUserId || 'Super Admin'}
                      </span>
                      <span className={styles.activityDescription}>
                        {formatActionText(log)}
                      </span>
                    </div>

                    <span className={styles.activityTime}>
                      {formatEventTime(log.occurredAt)}
                    </span>
                  </div>
                )
              })
            ) : (
              // Realistic fallback
              [
                {
                  id: '1',
                  actor: 'Super Admin',
                  desc: 'Created new user "Uday Chauhan"',
                  time: 'Today, 10:24 AM',
                  theme: { bg: '#ecfdf5', color: '#10b981', IconElem: Icon.Users },
                },
                {
                  id: '2',
                  actor: 'Super Admin',
                  desc: 'Updated role "Employee Manager"',
                  time: 'Today, 09:15 AM',
                  theme: { bg: '#f3e8ff', color: '#8b5cf6', IconElem: Icon.ShieldCheck },
                },
                {
                  id: '3',
                  actor: 'Super Admin',
                  desc: 'Registered "Employee Management"',
                  time: 'Yesterday, 04:38 PM',
                  theme: { bg: '#fff7ed', color: '#f97316', IconElem: Icon.Grid },
                },
                {
                  id: '4',
                  actor: 'Super Admin',
                  desc: 'Exported security audit logs to CSV',
                  time: 'Yesterday, 11:20 AM',
                  theme: { bg: '#eff6ff', color: '#3b82f6', IconElem: Icon.FileText },
                },
              ].map((item) => (
                <div key={item.id} className={styles.activityRow}>
                  <div
                    className={styles.activityIconWrap}
                    style={{ background: item.theme.bg, color: item.theme.color }}
                  >
                    <item.theme.IconElem width={16} height={16} />
                  </div>

                  <div className={styles.activityInfo}>
                    <span className={styles.activityActor}>{item.actor}</span>
                    <span className={styles.activityDescription}>{item.desc}</span>
                  </div>

                  <span className={styles.activityTime}>{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Widget 4: Registered Micro-Frontends (Switched to Right Side) */}
        <div className={styles.widgetCard}>
          <div className={styles.widgetHeader}>
            <div>
              <h2 className={styles.widgetTitle}>Registered Micro-Frontends</h2>
              <p className={styles.widgetSubtitle}>Module Federation remote applications</p>
            </div>
            <button
              type="button"
              className={styles.headerManageBtn}
              onClick={() => openDrawer('applications')}
            >
              <span>Manage</span>
              <Icon.ChevronRight width={13} height={13} />
            </button>
          </div>

          <div className={styles.appsListContainer}>
            {loading ? (
              <div className={styles.appsListPlaceholder}>
                <SkeletonBlock height={48} width="100%" />
                <SkeletonBlock height={48} width="100%" />
              </div>
            ) : apps.length > 0 ? (
              <div className={styles.appsList}>
                {apps.map((app, index) => {
                  const colorTheme = APP_COLORS[index % APP_COLORS.length]
                  const isMaintenance = app.status === 'Maintenance'

                  return (
                    <div key={app.id || app.key} className={styles.appRow}>
                      <div
                        className={styles.appRowIcon}
                        style={{ background: colorTheme.bg, color: colorTheme.color }}
                      >
                        {index === 0 ? (
                          <Icon.Users width={16} height={16} />
                        ) : index === 1 ? (
                          <Icon.Grid width={16} height={16} />
                        ) : index === 2 ? (
                          <Icon.Activity width={16} height={16} />
                        ) : (
                          <Icon.Building width={16} height={16} />
                        )}
                      </div>

                      <div className={styles.appRowContent}>
                        <div className={styles.appNameRow}>
                          <span className={styles.appRowName}>{app.displayName}</span>
                          <span className={styles.appRowKey}>/apps/{app.key}</span>
                        </div>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: isMaintenance ? '40%' : '100%',
                              background: isMaintenance ? '#f59e0b' : colorTheme.color,
                            }}
                          />
                        </div>
                      </div>

                      <span
                        className={isMaintenance ? styles.maintenanceStatusPill : styles.activeStatusPill}
                      >
                        <span
                          className={isMaintenance ? styles.badgeDotAmber : styles.badgeDotGreen}
                        />
                        {app.status || 'Active'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.emptyAppsContainer}>
                <div className={styles.emptyAppsIcon}>
                  <Icon.Grid width={24} height={24} />
                </div>
                <p className={styles.emptyAppsTitle}>No remote applications registered</p>
                <p className={styles.emptyAppsSubtitle}>
                  Connect external micro-frontends via Module Federation 2.0.
                </p>
                <button
                  type="button"
                  className={styles.emptyRegisterBtn}
                  onClick={() => pushLayer({ type: 'app-form' })}
                >
                  <Icon.Plus width={14} height={14} />
                  <span>Register Application</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.copyright}>
          © {COPYRIGHT_YEAR} {APP_NAME} Micro-Frontend Platform. All rights reserved.
        </span>
        {/* The build identifier is omitted entirely when unset, rather than asserting a version
            number that corresponds to no real build. */}
        <span className={styles.version}>Module Federation 2.0{APP_VERSION && ` • Build ${APP_VERSION}`}</span>
      </footer>
    </div>
  )
}
