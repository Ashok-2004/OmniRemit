import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../auth/store/authStore'
import { queryKeys } from '../../../shared/query/queryKeys'
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader'
import { IconTile } from '../../../shared/components/IconTile/IconTile'
import { Icon } from '../../../shared/components/Icon/Icon'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { EmptyState } from '../../../shared/components/EmptyState/EmptyState'
import { auditLogsApi } from '../../system-audit-logs/api/auditLogsApi'
import { usersApi } from '../../settings-users/api/usersApi'
import { rolesApi } from '../../settings-roles/api/rolesApi'
import { remoteAppsApi } from '../../settings-applications/api/remoteAppsApi'
import styles from './SettingsOverviewPage.module.css'

const FEATURE_KEYS = {
  users: 'host.settings.users',
  roles: 'host.settings.roles',
  applications: 'host.settings.applications',
  auditLogs: 'host.system.audit-logs',
} as const

/** Setup-related audit actions, so this page shows configuration changes rather than every event. */
const SETUP_ACTION_PREFIXES = ['user.', 'role.', 'remoteapp.']

function formatTime(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/**
 * Landing page for the Setup area, reached from the settings drawer.
 *
 * Every count is a real total read from the same list endpoints the individual pages use, and the
 * activity list is real audit rows filtered to configuration changes. A card the caller lacks
 * permission for is not rendered at all rather than shown disabled — the platform never hints at
 * areas someone cannot reach.
 */
export function SettingsOverviewPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const hasCapability = useAuthStore((s) => s.hasCapability)

  const isAdministrator = Boolean(user?.isAdministrator)
  const canViewUsers = isAdministrator || hasCapability(FEATURE_KEYS.users, 'View')
  const canViewRoles = isAdministrator || hasCapability(FEATURE_KEYS.roles, 'View')
  const canViewApps = isAdministrator || hasCapability(FEATURE_KEYS.applications, 'View')
  const canViewAudit = isAdministrator || hasCapability(FEATURE_KEYS.auditLogs, 'View')

  // pageSize:1 — only `total` is read, so this never transfers a full page of records.
  const usersQuery = useQuery({
    queryKey: [...queryKeys.users.all(), 'count', 'overview'],
    queryFn: () => usersApi.list(accessToken!, { pageSize: 1 }),
    enabled: Boolean(accessToken) && canViewUsers,
  })

  const rolesQuery = useQuery({
    queryKey: [...queryKeys.roles.all(), 'count', 'overview'],
    queryFn: () => rolesApi.list(accessToken!, { pageSize: 1 }),
    enabled: Boolean(accessToken) && canViewRoles,
  })

  const appsQuery = useQuery({
    queryKey: [...queryKeys.applications.all(), 'count', 'overview'],
    queryFn: () => remoteAppsApi.list(accessToken!, { pageSize: 1 }),
    enabled: Boolean(accessToken) && canViewApps,
  })

  const activityQuery = useQuery({
    queryKey: [...queryKeys.auditLogs.all(), 'setup-activity'],
    queryFn: () => auditLogsApi.list(accessToken!, { page: 1, pageSize: 25 }),
    enabled: Boolean(accessToken) && canViewAudit,
  })

  const setupActivity = activityQuery.data?.items
    .filter((entry) => SETUP_ACTION_PREFIXES.some((prefix) => entry.action.startsWith(prefix)))
    .slice(0, 6)

  const cards = [
    {
      key: 'users',
      to: '/settings/users',
      title: 'Users',
      description: 'Staff accounts, their roles and what they can access.',
      icon: <Icon.Users width={22} height={22} />,
      tone: 'primary' as const,
      count: usersQuery.data?.total,
      loading: usersQuery.isPending,
      unit: 'user',
      visible: canViewUsers,
    },
    {
      key: 'roles',
      to: '/settings/roles',
      title: 'Roles',
      description: 'Group permissions into roles and assign them to users.',
      icon: <Icon.ShieldCheck width={22} height={22} />,
      tone: 'info' as const,
      count: rolesQuery.data?.total,
      loading: rolesQuery.isPending,
      unit: 'role',
      visible: canViewRoles,
    },
    {
      key: 'applications',
      to: '/settings/applications',
      title: 'Applications',
      description: 'Register remote applications and manage their visibility.',
      icon: <Icon.Grid width={22} height={22} />,
      tone: 'success' as const,
      count: appsQuery.data?.total,
      loading: appsQuery.isPending,
      unit: 'application',
      visible: canViewApps,
    },
  ].filter((card) => card.visible)

  return (
    <div className={styles.page}>
      <PageHeader
        icon={<Icon.Settings width={24} height={24} />}
        title="Settings"
        description="Manage system users, roles and applications from one place."
      />

      <div className={styles.cardGrid}>
        {cards.map((card, index) => (
          <Link key={card.key} to={card.to} className={styles.card} style={{ animationDelay: `${index * 70}ms` }}>
            <div className={styles.cardTop}>
              <IconTile tone={card.tone} size="lg">
                {card.icon}
              </IconTile>
              <span className={styles.cardArrow} aria-hidden="true">
                <Icon.ArrowRight width={18} height={18} />
              </span>
            </div>

            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>{card.title}</h2>
              <p className={styles.cardDescription}>{card.description}</p>
            </div>

            <span className={styles.cardCount}>
              {card.loading
                ? 'Loading…'
                : card.count === undefined
                  ? 'Unavailable'
                  : `${card.count} ${card.unit}${card.count === 1 ? '' : 's'}`}
            </span>
          </Link>
        ))}
      </div>

      {canViewAudit && (
        <section className={styles.activityPanel} aria-labelledby="setup-activity-heading">
          <div className={styles.activityHeader}>
            <h2 id="setup-activity-heading" className={styles.activityTitle}>
              Recent setup activity
            </h2>
            <Link to="/system/audit-logs" className={styles.viewAll}>
              View all
            </Link>
          </div>

          {activityQuery.isPending ? (
            <SkeletonText lines={4} />
          ) : activityQuery.isError ? (
            <p className={styles.activityError}>Could not load recent activity.</p>
          ) : !setupActivity || setupActivity.length === 0 ? (
            <EmptyState
              icon={<Icon.FileText width={22} height={22} />}
              title="No configuration changes yet"
              description="Creating a user, role or application will show up here."
            />
          ) : (
            <ul className={styles.activityList}>
              {setupActivity.map((entry, index) => (
                <li className={styles.activityRow} key={entry.id} style={{ animationDelay: `${index * 45}ms` }}>
                  <IconTile
                    tone={entry.action.startsWith('user.') ? 'primary' : entry.action.startsWith('role.') ? 'info' : 'success'}
                    size="sm"
                  >
                    {entry.action.startsWith('user.') ? (
                      <Icon.Users width={16} height={16} />
                    ) : entry.action.startsWith('role.') ? (
                      <Icon.ShieldCheck width={16} height={16} />
                    ) : (
                      <Icon.Grid width={16} height={16} />
                    )}
                  </IconTile>

                  <div className={styles.activityText}>
                    <span className={styles.activityActor}>{entry.actorName ?? 'System'}</span>
                    <span className={styles.activityDetail}>{entry.details ?? entry.action}</span>
                  </div>

                  <time className={styles.activityTime} dateTime={entry.occurredAt}>
                    {formatTime(entry.occurredAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
