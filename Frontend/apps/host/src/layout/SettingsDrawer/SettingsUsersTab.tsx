import { useEffect, useState } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { usersApi, type UserListItemDto } from '../../features/settings-users/api/usersApi'
import { rolesApi, type RoleListItemDto } from '../../features/settings-roles/api/rolesApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import styles from './SettingsUsersTab.module.css'

export function SettingsUsersTab() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAdministrator = Boolean(useAuthStore((s) => s.user)?.isAdministrator)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const pushLayer = useSettingsDrawerStore((s) => s.pushLayer)

  const canCreate = isAdministrator || hasCapability('host.settings.users', 'Create')
  const canEdit = isAdministrator || hasCapability('host.settings.users', 'Edit')
  const canDelete = isAdministrator || hasCapability('host.settings.users', 'Delete')
  const canDisable = isAdministrator || hasCapability('host.settings.users', 'Disable')

  const [users, setUsers] = useState<UserListItemDto[]>([])
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')

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
      try {
        const res = await usersApi.list(accessToken!, {
          search: search || undefined,
          roleId: selectedRoleId || undefined,
        })
        if (!cancelled) {
          setUsers(res.items)
          setTotal(res.total)
        }
      } catch (err) {
        console.error('Failed to load users:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, search, selectedRoleId])

  const handleToggleStatus = async (id: string, currentActive: boolean) => {
    if (!accessToken) return
    try {
      await usersApi.updateStatus(accessToken, id, !currentActive)
      const res = await usersApi.list(accessToken, {
        search: search || undefined,
        roleId: selectedRoleId || undefined,
      })
      setUsers(res.items)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to update user status:', err)
      window.alert('Failed to update user status.')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${name}"? This action cannot be undone.`)) return
    if (!accessToken) return
    try {
      await usersApi.remove(accessToken, id)
      const res = await usersApi.list(accessToken, {
        search: search || undefined,
        roleId: selectedRoleId || undefined,
      })
      setUsers(res.items)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to delete user:', err)
      window.alert('Failed to delete user.')
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
                      onClick={() => handleDelete(u.id, u.name || u.email)}
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

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerText}>
          Showing 1 to {users.length} of {total} users
        </span>
        <div className={styles.pagination}>
          <button type="button" className={styles.pageBtn} disabled>
            &lt;
          </button>
          <span className={styles.pageActive}>1</span>
          <button type="button" className={styles.pageBtn} disabled>
            &gt;
          </button>
        </div>
      </div>
    </div>
  )
}
