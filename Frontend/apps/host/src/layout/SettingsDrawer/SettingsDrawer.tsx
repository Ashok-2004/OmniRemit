import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../features/auth/store/authStore'
import { queryKeys } from '../../shared/query/queryKeys'
import { Drawer } from '../../shared/components/Drawer/Drawer'
import { Button } from '../../shared/components/Button/Button'
import { Icon } from '../../shared/components/Icon/Icon'
import { IconTile } from '../../shared/components/IconTile/IconTile'
import { SkeletonText } from '../../shared/components/Skeleton'
import { usersApi } from '../../features/settings-users/api/usersApi'
import { rolesApi } from '../../features/settings-roles/api/rolesApi'
import { remoteAppsApi } from '../../features/settings-applications/api/remoteAppsApi'
import styles from './SettingsDrawer.module.css'

export interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
  access: { users: boolean; roles: boolean; applications: boolean }
}

interface SummaryRow {
  label: string
  value: number
  /** Token-backed colour for the leading dot. */
  color: string
}

/**
 * The settings entry point, opened from the topbar gear.
 *
 * Users / Roles / Applications live here and NOT in the sidebar. Having them in both produced two
 * routes to the same three pages sitting on screen simultaneously, which is the duplication this
 * replaces. The sidebar now carries only Dashboard, the registered remote apps, and System.
 *
 * The summary panel is context-aware: it describes whichever area you are currently looking at, so
 * opening the drawer from Applications does not show you a breakdown of users. Every figure is a
 * real count fetched from the API — nothing here is derived from a placeholder.
 */
export function SettingsDrawer({ open, onClose, access }: SettingsDrawerProps) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const navigate = useNavigate()
  const location = useLocation()

  const section = location.pathname.startsWith('/settings/roles')
    ? 'roles'
    : location.pathname.startsWith('/settings/applications')
      ? 'applications'
      : 'users'

  // Only the query backing the visible summary runs — opening the drawer on Applications should not
  // fetch users. Each is also gated on the caller actually being allowed to see that area.
  const usersQuery = useQuery({
    queryKey: [...queryKeys.users.all(), 'settings-summary'],
    queryFn: () => usersApi.list(accessToken!, { pageSize: 200 }),
    enabled: open && section === 'users' && access.users && Boolean(accessToken),
  })

  const rolesQuery = useQuery({
    queryKey: [...queryKeys.roles.all(), 'settings-summary'],
    queryFn: () => rolesApi.list(accessToken!, { pageSize: 200 }),
    enabled: open && section === 'roles' && access.roles && Boolean(accessToken),
  })

  const appsQuery = useQuery({
    queryKey: [...queryKeys.applications.all(), 'settings-summary'],
    queryFn: () => remoteAppsApi.list(accessToken!, { pageSize: 200 }),
    enabled: open && section === 'applications' && access.applications && Boolean(accessToken),
  })

  const summary = useMemo((): { title: string; total: string; rows: SummaryRow[]; loading: boolean } | null => {
    if (section === 'users') {
      const items = usersQuery.data?.items
      if (!items) return { title: 'Users Overview', total: '', rows: [], loading: usersQuery.isPending }

      // Grouped by the role each user actually holds, so the breakdown reflects real assignments
      // rather than a fixed list of role names that may not exist in this deployment.
      const byRole = new Map<string, number>()
      for (const user of items) {
        const key = user.roleName ?? 'No role'
        byRole.set(key, (byRole.get(key) ?? 0) + 1)
      }

      const palette = [
        'var(--omni-color-primary-600)',
        '#7c3aed',
        'var(--omni-color-success)',
        'var(--omni-color-warning)',
        '#0891b2',
      ]

      return {
        title: 'Users Overview',
        total: `${items.length} total user${items.length === 1 ? '' : 's'}`,
        rows: [
          { label: 'Active', value: items.filter((u) => u.isActive).length, color: 'var(--omni-color-success)' },
          { label: 'Inactive', value: items.filter((u) => !u.isActive).length, color: 'var(--omni-color-text-muted)' },
          ...[...byRole.entries()].map(([label, value], i) => ({ label, value, color: palette[i % palette.length] })),
        ],
        loading: false,
      }
    }

    if (section === 'roles') {
      const items = rolesQuery.data?.items
      if (!items) return { title: 'Roles Overview', total: '', rows: [], loading: rolesQuery.isPending }

      return {
        title: 'Roles Overview',
        total: `${items.length} total role${items.length === 1 ? '' : 's'}`,
        rows: [
          { label: 'Built-in', value: items.filter((r) => r.isSystemRole).length, color: 'var(--omni-color-primary-600)' },
          { label: 'Custom', value: items.filter((r) => !r.isSystemRole).length, color: '#7c3aed' },
          { label: 'With users', value: items.filter((r) => r.usersCount > 0).length, color: 'var(--omni-color-success)' },
          { label: 'Unassigned', value: items.filter((r) => r.usersCount === 0).length, color: 'var(--omni-color-text-muted)' },
        ],
        loading: false,
      }
    }

    const items = appsQuery.data?.items
    if (!items) return { title: 'Applications Overview', total: '', rows: [], loading: appsQuery.isPending }

    return {
      title: 'Applications Overview',
      total: `${items.length} registered app${items.length === 1 ? '' : 's'}`,
      rows: [
        { label: 'Active', value: items.filter((a) => a.status === 'Active').length, color: 'var(--omni-color-success)' },
        { label: 'Maintenance', value: items.filter((a) => a.status === 'Maintenance').length, color: 'var(--omni-color-warning)' },
        { label: 'Disabled', value: items.filter((a) => a.status === 'Disabled').length, color: 'var(--omni-color-text-muted)' },
        { label: 'Unreachable', value: items.filter((a) => a.health === 'Unreachable').length, color: 'var(--omni-color-danger)' },
      ],
      loading: false,
    }
  }, [section, usersQuery.data, usersQuery.isPending, rolesQuery.data, rolesQuery.isPending, appsQuery.data, appsQuery.isPending])

  const items = [
    {
      key: 'users',
      to: '/settings/users',
      label: 'Users',
      description: 'Manage and view user accounts',
      icon: <Icon.Users width={18} height={18} />,
      visible: access.users,
      active: section === 'users' && location.pathname.startsWith('/settings/users'),
    },
    {
      key: 'roles',
      to: '/settings/roles',
      label: 'Roles',
      description: 'Manage roles and permissions',
      icon: <Icon.ShieldCheck width={18} height={18} />,
      visible: access.roles,
      active: location.pathname.startsWith('/settings/roles'),
    },
    {
      key: 'applications',
      to: '/settings/applications',
      label: 'Applications',
      description: 'Manage applications and settings',
      icon: <Icon.Grid width={18} height={18} />,
      visible: access.applications,
      active: location.pathname.startsWith('/settings/applications'),
    },
    {
      key: 'overview',
      to: '/settings',
      label: 'Settings Overview',
      description: 'Go to settings dashboard',
      icon: <Icon.Settings width={18} height={18} />,
      visible: true,
      active: location.pathname === '/settings',
    },
  ].filter((item) => item.visible)

  function go(to: string) {
    onClose()
    navigate(to)
  }

  return (
    <Drawer
      open={open}
      title="Settings"
      description="Manage system users, roles and applications"
      size="sm"
      onClose={onClose}
      footer={
        <Button fullWidth variant="secondary" onClick={() => go('/settings')}>
          Go to Settings Dashboard
        </Button>
      }
    >
      <nav className={styles.nav} aria-label="Settings sections">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.active ? styles.itemActive : styles.item}
            aria-current={item.active ? 'page' : undefined}
            onClick={() => go(item.to)}
          >
            <IconTile tone={item.active ? 'primary' : 'neutral'} size="sm">
              {item.icon}
            </IconTile>
            <span className={styles.itemText}>
              <span className={styles.itemLabel}>{item.label}</span>
              <span className={styles.itemDescription}>{item.description}</span>
            </span>
          </button>
        ))}
      </nav>

      {summary && (
        <section className={styles.summary} aria-labelledby="settings-summary-heading">
          <h3 id="settings-summary-heading" className={styles.summaryTitle}>
            {summary.title}
          </h3>

          {summary.loading ? (
            <SkeletonText lines={4} />
          ) : (
            <>
              <p className={styles.summaryTotal}>{summary.total}</p>
              <ul className={styles.summaryList}>
                {summary.rows.map((row) => (
                  <li className={styles.summaryRow} key={row.label}>
                    <span className={styles.summaryDot} style={{ background: row.color }} aria-hidden="true" />
                    <span className={styles.summaryLabel}>{row.label}</span>
                    <span className={styles.summaryValue}>{row.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </Drawer>
  )
}
