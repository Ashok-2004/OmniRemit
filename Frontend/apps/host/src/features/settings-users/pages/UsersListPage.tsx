import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Badge } from '../../../shared/components/Badge/Badge'
import { Table } from '../../../shared/components/Table/Table'
import { SkeletonTable } from '../../../shared/components/Skeleton'
import { Modal } from '../../../shared/components/Modal/Modal'
import { ApiError } from '../../../shared/api/httpClient'
import { rolesApi, type RoleListItemDto } from '../../settings-roles/api/rolesApi'
import { usersApi, type UserListItemDto } from '../api/usersApi'
import styles from './UsersListPage.module.css'

const FEATURE = 'host.settings.users'
const PAGE_SIZE = 20

export function UsersListPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)

  const [users, setUsers] = useState<UserListItemDto[] | null>(null)
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [total, setTotal] = useState(0)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [inactiveCount, setInactiveCount] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<UserListItemDto | null>(null)

  const canCreate = hasCapability(FEATURE, 'Create')
  const canEdit = hasCapability(FEATURE, 'Edit')
  const canDelete = hasCapability(FEATURE, 'Delete')
  const canDisable = hasCapability(FEATURE, 'Disable')

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    try {
      const result = await usersApi.list(accessToken, {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        roleId: selectedRoleId || undefined,
      })
      setUsers(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load users.')
    }
  }, [accessToken, page, search, selectedRoleId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function bootstrap() {
      try {
        const [rolesRes, activeRes, inactiveRes] = await Promise.all([
          rolesApi.list(accessToken!, { pageSize: 100 }),
          usersApi.list(accessToken!, { pageSize: 1, isActive: true }),
          usersApi.list(accessToken!, { pageSize: 1, isActive: false }),
        ])
        if (!cancelled) {
          setRoles(rolesRes.items)
          setActiveCount(activeRes.total)
          setInactiveCount(inactiveRes.total)
        }
      } catch {
        // ignore non-critical stat load failures
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  async function toggleStatus(user: UserListItemDto) {
    const token = await ensureFreshAccessToken()
    await usersApi.updateStatus(token, user.id, !user.isActive)
    void load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const token = await ensureFreshAccessToken()
    await usersApi.remove(token, pendingDelete.id)
    setPendingDelete(null)
    void load()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Users</h1>
          <p>Manage staff accounts, their roles and what they can access.</p>
        </div>
        {canCreate && (
          <Link to="/settings/users/new">
            <Button>+ New User</Button>
          </Link>
        )}
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total users</span>
          <span className={styles.statValue}>{total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active</span>
          <span className={styles.statValue}>{activeCount ?? '—'}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Inactive</span>
          <span className={styles.statValue}>{inactiveCount ?? '—'}</span>
        </div>
      </div>

      {/* Toolbar with Search and Role Filter */}
      <div className={styles.toolbar}>
        <div className={styles.filtersGroup}>
          <Input
            className={styles.searchInput}
            placeholder="Search users…"
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
          />
          <select
            className={styles.roleFilterSelect}
            value={selectedRoleId}
            onChange={(e) => {
              setPage(1)
              setSelectedRoleId(e.target.value)
            }}
          >
            <option value="">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} {role.isAdministrator ? '(Admin)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {users === null ? (
        <SkeletonTable rows={6} columns={5} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              {(canEdit || canDelete || canDisable) && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  No users found matching the selected filters.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className={styles.userCell}>
                    <div>
                      {canEdit ? (
                        <Link to={`/settings/users/${user.id}`} className={styles.nameLink}>
                          {user.name}
                        </Link>
                      ) : (
                        <span>{user.name}</span>
                      )}
                      <div className={styles.emailText}>{user.email}</div>
                    </div>
                  </div>
                </td>
                <td>{user.phoneNumber ?? '—'}</td>
                <td>
                  {user.isAdministrator ? (
                    <Badge tone="primary">Administrator</Badge>
                  ) : (
                    (user.roleName ?? <Badge tone="neutral">No role</Badge>)
                  )}
                </td>
                <td>
                  <Badge tone={user.isActive ? 'success' : 'neutral'} dot>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                {(canEdit || canDelete || canDisable) && (
                  <td>
                    <div className={styles.actionsCell}>
                      {canDisable && (
                        <Button size="sm" variant="ghost" onClick={() => void toggleStatus(user)}>
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => setPendingDelete(user)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {total > PAGE_SIZE && (
        <div className={styles.pagination}>
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Modal
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name}?`}
        onClose={() => setPendingDelete(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </>
        }
      >
        This removes the account from every list. It can't be undone from here.
      </Modal>
    </div>
  )
}
