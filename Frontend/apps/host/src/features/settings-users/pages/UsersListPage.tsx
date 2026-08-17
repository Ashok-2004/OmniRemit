import { useState } from 'react'
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
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader'
import { StatCard } from '../../../shared/components/StatCard/StatCard'
import { DataTable, type DataTableColumn } from '../../../shared/components/DataTable/DataTable'
import { ListToolbar } from '../../../shared/components/ListToolbar/ListToolbar'
import { Pagination } from '../../../shared/components/Pagination/Pagination'
import { KebabMenu } from '../../../shared/components/KebabMenu/KebabMenu'
import { ApiError } from '../../../shared/api/httpClient'
import { usersApi, type UserListItemDto } from '../api/usersApi'
import styles from './UsersListPage.module.css'

const FEATURE = 'host.settings.users'
const PAGE_SIZE = 10

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

/** First + last initial, e.g. "Ashok Kumar Mishra" -> "AM". Single-word names give one letter. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** Deterministic avatar tint from the name, so a given user keeps the same colour across sessions. */
const AVATAR_TONES = ['a', 'b', 'c', 'd', 'e'] as const
function avatarTone(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % AVATAR_TONES.length
  return AVATAR_TONES[hash]
}

export function UsersListPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<UserListItemDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const canCreate = hasCapability(FEATURE, 'Create')
  const canEdit = hasCapability(FEATURE, 'Edit')
  const canDelete = hasCapability(FEATURE, 'Delete')
  const canDisable = hasCapability(FEATURE, 'Disable')

  const debouncedSearch = useDebouncedValue(search, 300)
  const isActiveParam = statusFilter === '' ? undefined : statusFilter === 'active'

  const usersQuery = useQuery({
    queryKey: queryKeys.users.list({ page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, status: statusFilter || undefined }),
    queryFn: () => usersApi.list(accessToken!, { page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, isActive: isActiveParam }),
    enabled: Boolean(accessToken),
  })

  /**
   * Counts come from the SERVER, via pageSize:1 requests that read only `total`.
   *
   * The previous implementation counted the current page, so "Active: 10" really meant "10 active on
   * this page" and silently disagreed with reality the moment there was more than one page. These
   * also live in the query cache, so a status toggle or delete invalidates and refreshes them — the
   * old effect-based version never updated at all after a mutation.
   */
  const totalQuery = useQuery({
    queryKey: [...queryKeys.users.all(), 'count', 'total'],
    queryFn: () => usersApi.list(accessToken!, { pageSize: 1 }),
    enabled: Boolean(accessToken),
  })
  const activeQuery = useQuery({
    queryKey: [...queryKeys.users.all(), 'count', 'active'],
    queryFn: () => usersApi.list(accessToken!, { pageSize: 1, isActive: true }),
    enabled: Boolean(accessToken),
  })

  const users = usersQuery.data?.items
  const total = usersQuery.data?.total ?? 0
  const totalUsers = totalQuery.data?.total ?? null
  const activeUsers = activeQuery.data?.total ?? null
  const inactiveUsers = totalUsers !== null && activeUsers !== null ? totalUsers - activeUsers : null
  const countsLoading = totalQuery.isPending || activeQuery.isPending

  const error = actionError ?? (usersQuery.isError ? toMessage(usersQuery.error, 'Could not load users.') : null)

  const statusMutation = useAppMutation<UserListItemDto>({
    mutationFn: (token, user) => usersApi.updateStatus(token, user.id, !user.isActive),
    invalidates: ['users'],
    onError: (err) => setActionError(toMessage(err, 'Could not update this user.')),
  })

  const deleteMutation = useAppMutation<UserListItemDto>({
    mutationFn: (token, user) => usersApi.remove(token, user.id),
    invalidates: ['users', 'roles'],
    onSuccess: () => setPendingDelete(null),
    onError: (err) => setActionError(toMessage(err, 'Could not delete this user.')),
  })

  const columns: DataTableColumn<UserListItemDto>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (user) => (
        <div className={styles.nameCell}>
          <span className={`${styles.avatar} ${styles[`avatar_${avatarTone(user.name)}`]}`} aria-hidden="true">
            {initials(user.name)}
          </span>
          {canEdit ? (
            <Link to={`/settings/users/${user.id}`} className={styles.nameLink}>
              {user.name}
            </Link>
          ) : (
            <span className={styles.nameStatic}>{user.name}</span>
          )}
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (user) => <span className={styles.emailText}>{user.email}</span> },
    {
      key: 'phone',
      header: 'Phone',
      hideOnNarrow: true,
      render: (user) => user.phoneNumber ?? <span className={styles.mutedText}>—</span>,
    },
    {
      key: 'role',
      header: 'Role',
      width: '150px',
      render: (user) =>
        user.roleName ? (
          <Badge tone={user.isAdministrator ? 'primary' : 'info'}>{user.roleName}</Badge>
        ) : (
          <span className={styles.mutedText}>No role</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (user) => (
        <Badge tone={user.isActive ? 'success' : 'neutral'} dot>
          {user.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '92px',
      render: (user) => (
        <div className={styles.actionsCell}>
          {canEdit && (
            <button
              type="button"
              className={styles.iconAction}
              aria-label={`Edit ${user.name}`}
              onClick={() => navigate(`/settings/users/${user.id}`)}
            >
              <Icon.Pencil width={16} height={16} />
            </button>
          )}
          <KebabMenu
            items={[
              ...(canDisable
                ? [
                    {
                      key: 'status',
                      label: user.isActive ? 'Deactivate' : 'Activate',
                      onSelect: () => statusMutation.mutate(user),
                    },
                  ]
                : []),
              ...(canDelete
                ? [{ key: 'delete', label: 'Delete user', danger: true, onSelect: () => setPendingDelete(user) }]
                : []),
            ]}
          />
        </div>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <PageHeader
        icon={<Icon.Users width={24} height={24} />}
        title="Users"
        description="Manage staff accounts, their roles and what they can access."
        actions={
          canCreate && (
            <Link to="/settings/users/new">
              <Button leadingIcon={<Icon.Plus width={16} height={16} />}>New User</Button>
            </Link>
          )
        }
      />

      <div className={styles.statGrid}>
        <StatCard index={0} label="Total Users" value={totalUsers} caption="All registered users" icon={<Icon.Users width={20} height={20} />} tone="primary" loading={countsLoading} />
        <StatCard index={1} label="Active" value={activeUsers} caption="Can sign in" icon={<Icon.Check width={20} height={20} />} tone="success" loading={countsLoading} />
        <StatCard index={2} label="Inactive" value={inactiveUsers} caption="Sign-in disabled" icon={<Icon.Lock width={20} height={20} />} tone="neutral" loading={countsLoading} />
      </div>

      <ListToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder="Search users…"
        filter={{
          label: 'Filter',
          value: statusFilter,
          onChange: (value) => {
            setStatusFilter(value)
            setPage(1)
          },
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        }}
      />

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(user) => user.id}
        loading={usersQuery.isPending}
        error={error}
        empty={{
          icon: <Icon.Users width={22} height={22} />,
          title: search || statusFilter ? 'No users match these filters' : 'No users yet',
          description:
            search || statusFilter ? 'Try a different search term or clear the filter.' : 'Add a user to give someone access.',
        }}
      />

      {total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="user" />}

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
        This removes their access immediately. Their entries in the audit log are kept, so the record
        of what they did remains intact.
      </Modal>

      {/* Nested route — renders the create/edit drawer on top of this list. */}
      <Outlet />
    </div>
  )
}
