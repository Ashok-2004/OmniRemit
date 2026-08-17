import { useEffect, useState } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { usersApi, type UserListItemDto } from '../../features/settings-users/api/usersApi'
import { rolesApi, type RoleListItemDto } from '../../features/settings-roles/api/rolesApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Icon } from '../../shared/components/Icon/Icon'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import { Pagination } from '../../shared/components/Pagination/Pagination'
import { Modal } from '../../shared/components/Modal/Modal'
import { Button } from '../../shared/components/Button/Button'
import { ApiError } from '../../shared/api/httpClient'
import styles from './SettingsUsersTab.module.css'

const PAGE_SIZE = 10

export function SettingsUsersTab() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAdministrator = Boolean(useAuthStore((s) => s.user)?.isAdministrator)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const pushLayer = useSettingsDrawerStore((s) => s.pushLayer)
  const mutationCount = useSettingsDrawerStore((s) => s.mutationCount)
  const notifyMutation = useSettingsDrawerStore((s) => s.notifyMutation)

  const canCreate = isAdministrator || hasCapability('host.settings.users', 'Create')
  const canEdit = isAdministrator || hasCapability('host.settings.users', 'Edit')
  const canDelete = isAdministrator || hasCapability('host.settings.users', 'Delete')
  const canDisable = isAdministrator || hasCapability('host.settings.users', 'Disable')

  const [users, setUsers] = useState<UserListItemDto[]>([])
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<UserListItemDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Debounced so typing a name doesn't fire one query per keystroke against the user table.
  const debouncedSearch = useDebouncedValue(search, 300)

  // Load available roles for the filter dropdown
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function loadRoles() {
      try {
        const res = await rolesApi.list(accessToken!, { pageSize: 100 })
        if (!cancelled) setRoles(res.items)
      } catch (err) {
        console.error('Failed to load roles for filter:', err)
      }
    }

    void loadRoles()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  // Load users filtered by search and role
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await usersApi.list(accessToken!, {
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch || undefined,
          roleId: selectedRoleId || undefined,
        })
        if (cancelled) return
        setUsers(res.items)
        setTotal(res.total)
        setError(null)
      } catch (err) {
        if (cancelled) return
        // Surfaced rather than console-only: a failed load previously rendered the empty state, so
        // an operator saw "no users" and could reasonably think the directory had been wiped.
        setError(err instanceof ApiError ? err.message : 'Could not load users.')
        setUsers([])
        setTotal(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, debouncedSearch, selectedRoleId, page, mutationCount])

  // Any change of filter invalidates the page number — page 4 of an unfiltered list is rarely a
  // valid page of the filtered one, and asking for it shows a confusing empty result.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, selectedRoleId])

  const handleToggleStatus = async (id: string, currentActive: boolean) => {
    if (!accessToken) return
    try {
      await usersApi.updateStatus(accessToken, id, !currentActive)
      notifyMutation()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this user.')
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || !accessToken) return
    setDeleting(true)
    try {
      await usersApi.remove(accessToken, pendingDelete.id)
      setPendingDelete(null)
      if (users.length === 1 && page > 1) setPage((p) => p - 1)
      else notifyMutation()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this user.')
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Users</h3>
          <p className={styles.subtitle}>Manage platform user accounts and their assigned roles.</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className={styles.createButton}
            onClick={() => pushLayer({ type: 'user-form' })}
          >
            <Icon.Plus width={16} height={16} />
            <span>Add User</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar: Search + Role Filter Dropdown */}
      <div className={styles.filterToolbar}>
        <div className={styles.searchWrap}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Icon.Search width={15} height={15} className={styles.searchIcon} />
        </div>

        <div className={styles.roleFilterWrap}>
          <select
            className={styles.roleFilterSelect}
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.isAdministrator ? '(Admin)' : ''}
              </option>
            ))}
          </select>
          <Icon.ChevronDown width={14} height={14} className={styles.selectChevron} />
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {/* Users List */}
      <div className={styles.usersList}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <SkeletonBlock height={52} width="100%" />
            </div>
          ))
        ) : users.length > 0 ? (
          users.map((u) => {
            const initial = (u.name || u.email).charAt(0).toUpperCase()
            const isActive = u.isActive

            return (
              <div key={u.id} className={styles.userCard}>
                <div className={styles.avatarWrap}>
                  <span className={styles.avatarLetter}>{initial}</span>
                </div>

                <div className={styles.userInfo}>
                  <div className={styles.userNameRow}>
                    <span className={styles.userName}>{u.name}</span>
                    <span className={styles.userRoleBadge}>{u.roleName || (u.isAdministrator ? 'Administrator' : 'No Role')}</span>
                  </div>
                  <span className={styles.userEmail}>{u.email}</span>
                </div>

                <div className={styles.userMeta}>
                  <span
                    className={isActive ? styles.activeBadge : styles.inactiveBadge}
                    onClick={() => canDisable && handleToggleStatus(u.id, u.isActive)}
                    style={{ cursor: canDisable ? 'pointer' : 'default' }}
                    title={canDisable ? 'Click to toggle status' : undefined}
                  >
                    <span className={isActive ? styles.badgeDotGreen : styles.badgeDotGray} />
                    {isActive ? 'Active' : 'Inactive'}
                  </span>

                  {canEdit && (
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => pushLayer({ type: 'user-form', userId: u.id })}
                      title="Edit User"
                    >
                      <Icon.Edit width={16} height={16} />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => setPendingDelete(u)}
                      title="Delete User"
                    >
                      <Icon.Trash width={16} height={16} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className={styles.emptyState}>
            <p>No users found matching the selected filters.</p>
          </div>
        )}
      </div>

      {/*
        Real pagination. The footer used to render a permanently disabled prev/next around a literal
        "1", so with more than one page of users the rest of the directory was unreachable.
      */}
      {total > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="user" />
      )}

      <Modal
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name || pendingDelete?.email}?`}
        onClose={() => setPendingDelete(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        This removes their access immediately. Their audit log entries are kept, so the record of
        what they did remains intact.
      </Modal>
    </div>
  )
}
