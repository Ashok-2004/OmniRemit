import { useMemo, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../auth/store/authStore'
import { useAppMutation } from '../../../shared/query/useAppMutation'
import { queryKeys } from '../../../shared/query/queryKeys'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { Button } from '../../../shared/components/Button/Button'
import { Modal } from '../../../shared/components/Modal/Modal'
import { Badge } from '../../../shared/components/Badge/Badge'
import { Icon } from '../../../shared/components/Icon/Icon'
import { IconTile } from '../../../shared/components/IconTile/IconTile'
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader'
import { StatCard } from '../../../shared/components/StatCard/StatCard'
import { DataTable, type DataTableColumn } from '../../../shared/components/DataTable/DataTable'
import { ListToolbar } from '../../../shared/components/ListToolbar/ListToolbar'
import { Pagination } from '../../../shared/components/Pagination/Pagination'
import { ApiError } from '../../../shared/api/httpClient'
import { rolesApi, type RoleListItemDto } from '../api/rolesApi'
import styles from './RolesListPage.module.css'

const FEATURE = 'host.settings.roles'
const PAGE_SIZE = 10

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

/** Administrators get the crown; system roles a shield; custom roles a plain badge icon. */
function roleIcon(role: RoleListItemDto) {
  if (role.isAdministrator) return <Icon.Crown width={16} height={16} />
  if (role.isSystemRole) return <Icon.ShieldCheck width={16} height={16} />
  return <Icon.Star width={16} height={16} />
}

export function RolesListPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<RoleListItemDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const canCreate = hasCapability(FEATURE, 'Create')
  const canEdit = hasCapability(FEATURE, 'Edit')
  const canDelete = hasCapability(FEATURE, 'Delete')

  const debouncedSearch = useDebouncedValue(search, 300)

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.list({ page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined }),
    queryFn: () => rolesApi.list(accessToken!, { page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined }),
    enabled: Boolean(accessToken),
  })

  const allRoles = rolesQuery.data?.items
  const total = rolesQuery.data?.total ?? 0

  const roles = useMemo(() => {
    if (!allRoles || !typeFilter) return allRoles
    return allRoles.filter((r) => (typeFilter === 'builtin' ? r.isSystemRole : !r.isSystemRole))
  }, [allRoles, typeFilter])

  // Every one of these comes from a field the list DTO already returns — no extra requests, and
  // nothing derived from a guess.
  const stats = useMemo(() => {
    if (!allRoles) return null
    return {
      total,
      assigned: allRoles.filter((r) => r.usersCount > 0).length,
      permissions: allRoles.reduce((sum, r) => sum + r.permissionsCount, 0),
      custom: allRoles.filter((r) => !r.isSystemRole).length,
    }
  }, [allRoles, total])

  const error = actionError ?? (rolesQuery.isError ? toMessage(rolesQuery.error, 'Could not load roles.') : null)

  const deleteMutation = useAppMutation<RoleListItemDto>({
    mutationFn: (token, role) => rolesApi.remove(token, role.id),
    invalidates: ['roles', 'users'],
    refreshSession: true,
    onSuccess: () => setPendingDelete(null),
    onError: (err) => setActionError(toMessage(err, 'Could not delete this role.')),
  })

  const columns: DataTableColumn<RoleListItemDto>[] = [
    {
      key: 'name',
      header: 'Role Name',
      render: (role) => (
        <div className={styles.nameCell}>
          <IconTile tone={role.isAdministrator ? 'warning' : role.isSystemRole ? 'primary' : 'info'} size="sm">
            {roleIcon(role)}
          </IconTile>
          {canEdit ? (
            <Link to={`/settings/roles/${role.id}`} className={styles.nameLink}>
              {role.name}
            </Link>
          ) : (
            <span className={styles.nameStatic}>{role.name}</span>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '110px',
      render: (role) => <Badge tone={role.isSystemRole ? 'primary' : 'neutral'}>{role.isSystemRole ? 'Built-in' : 'Custom'}</Badge>,
    },
    { key: 'users', header: 'Users', align: 'right', width: '80px', render: (role) => role.usersCount },
    {
      key: 'permissions',
      header: 'Permissions',
      align: 'right',
      width: '110px',
      // An administrator role bypasses per-capability checks entirely, so a number here would
      // understate it — "All" is the accurate answer.
      render: (role) => (role.isAdministrator ? <span className={styles.allText}>All</span> : role.permissionsCount),
    },
    {
      key: 'description',
      header: 'Description',
      hideOnNarrow: true,
      render: (role) => <span className={styles.description}>{role.description ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '92px',
      render: (role) => (
        <div className={styles.actionsCell}>
          {canEdit && (
            <button
              type="button"
              className={styles.iconAction}
              aria-label={`Edit ${role.name}`}
              onClick={() => navigate(`/settings/roles/${role.id}`)}
            >
              <Icon.Pencil width={16} height={16} />
            </button>
          )}
          {canDelete && !role.isSystemRole && (
            <button
              type="button"
              className={styles.iconActionDanger}
              aria-label={`Delete ${role.name}`}
              onClick={() => setPendingDelete(role)}
            >
              <Icon.Trash width={16} height={16} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <PageHeader
        icon={<Icon.ShieldCheck width={24} height={24} />}
        title="Roles"
        description="Group permissions into roles and assign them to users."
        actions={
          canCreate && (
            <Link to="/settings/roles/new">
              <Button leadingIcon={<Icon.Plus width={16} height={16} />}>New Role</Button>
            </Link>
          )
        }
      />

      <div className={styles.statGrid}>
        <StatCard index={0} label="Total Roles" value={stats?.total ?? null} caption="All defined roles" icon={<Icon.ShieldCheck width={20} height={20} />} tone="primary" loading={!stats} />
        <StatCard index={1} label="Assigned Roles" value={stats?.assigned ?? null} caption="Roles with users" icon={<Icon.Users width={20} height={20} />} tone="success" loading={!stats} />
        <StatCard index={2} label="Permissions" value={stats?.permissions ?? null} caption="Granted across all roles" icon={<Icon.Key width={20} height={20} />} tone="info" loading={!stats} />
        <StatCard index={3} label="Custom Roles" value={stats?.custom ?? null} caption="Not built in" icon={<Icon.Star width={20} height={20} />} tone="warning" loading={!stats} />
      </div>

      <ListToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder="Search roles…"
        filter={{
          label: 'Filter',
          value: typeFilter,
          onChange: (value) => {
            setTypeFilter(value)
            setPage(1)
          },
          options: [
            { value: 'builtin', label: 'Built-in' },
            { value: 'custom', label: 'Custom' },
          ],
        }}
      />

      <DataTable
        columns={columns}
        rows={roles}
        rowKey={(role) => role.id}
        loading={rolesQuery.isPending}
        error={error}
        empty={{
          icon: <Icon.ShieldCheck width={22} height={22} />,
          title: search || typeFilter ? 'No roles match these filters' : 'No roles defined yet',
          description:
            search || typeFilter ? 'Try a different search term or clear the filter.' : 'Create a role to start grouping permissions.',
        }}
      />

      {total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="role" />}

      <Modal
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name}?`}
        onClose={() => setPendingDelete(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)}>
              Delete
            </Button>
          </>
        }
      >
        {pendingDelete && pendingDelete.usersCount > 0
          ? `${pendingDelete.usersCount} user${pendingDelete.usersCount === 1 ? '' : 's'} currently hold this role and will lose the access it grants.`
          : 'This role grants no access to anyone right now, so deleting it affects no one.'}
      </Modal>

      {/* Nested route — renders the create/edit drawer on top of this list. */}
      <Outlet />
    </div>
  )
}
