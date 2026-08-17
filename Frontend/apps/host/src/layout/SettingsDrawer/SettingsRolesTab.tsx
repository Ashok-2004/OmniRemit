import { useEffect, useState } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { rolesApi, type RoleListItemDto } from '../../features/settings-roles/api/rolesApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import styles from './SettingsRolesTab.module.css'

export function SettingsRolesTab() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAdministrator = Boolean(useAuthStore((s) => s.user)?.isAdministrator)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const pushLayer = useSettingsDrawerStore((s) => s.pushLayer)

  const canCreate = isAdministrator || hasCapability('host.settings.roles', 'Create')
  const canEdit = isAdministrator || hasCapability('host.settings.roles', 'Edit')
  const canDelete = isAdministrator || hasCapability('host.settings.roles', 'Delete')

  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function load() {
      try {
        const res = await rolesApi.list(accessToken!, { search: search || undefined })
        if (!cancelled) {
          setRoles(res.items)
          setTotal(res.total)
        }
      } catch (err) {
        console.error('Failed to load roles:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, search])

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete role "${name}"?`)) return
    if (!accessToken) return
    try {
      await rolesApi.remove(accessToken, id)
      const res = await rolesApi.list(accessToken, { search: search || undefined })
      setRoles(res.items)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to delete role:', err)
      window.alert('Failed to delete role.')
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Roles</h3>
          <p className={styles.subtitle}>Define roles and configure granular permissions.</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className={styles.createButton}
            onClick={() => pushLayer({ type: 'role-form' })}
          >
            <Icon.Plus width={16} height={16} />
            <span>Add Role</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className={styles.searchWrap}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search roles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Icon.Search width={16} height={16} className={styles.searchIcon} />
      </div>

      {/* Roles List */}
      <div className={styles.rolesList}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <SkeletonBlock height={52} width="100%" />
            </div>
          ))
        ) : roles.length > 0 ? (
          roles.map((role) => (
            <div key={role.id} className={styles.roleCard}>
              <div className={styles.roleIconWrap}>
                <Icon.ShieldCheck width={20} height={20} />
              </div>

              <div className={styles.roleInfo}>
                <div className={styles.roleNameRow}>
                  <span className={styles.roleName}>{role.name}</span>
                  {role.isAdministrator && (
                    <span className={styles.adminBadge}>Administrator</span>
                  )}
                  {role.isSystemRole && (
                    <span className={styles.systemBadge}>System</span>
                  )}
                </div>
                <span className={styles.roleDesc}>
                  {role.description || (role.isAdministrator ? 'Full platform administrator access' : 'Custom defined role')}
                </span>
              </div>

              <div className={styles.roleActions}>
                {canEdit && (
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => pushLayer({ type: 'role-form', roleId: role.id })}
                    title="Edit Role & Permissions"
                  >
                    <Icon.Edit width={16} height={16} />
                  </button>
                )}
                {canDelete && !role.isSystemRole && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(role.id, role.name)}
                    title="Delete Role"
                  >
                    <Icon.Trash width={16} height={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>No roles found.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerText}>
          Showing 1 to {roles.length} of {total} roles
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
