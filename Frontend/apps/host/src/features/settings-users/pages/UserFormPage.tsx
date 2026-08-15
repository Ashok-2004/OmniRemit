import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Checkbox } from '../../../shared/components/Checkbox/Checkbox'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { permissionsApi, type PermissionFeatureDto } from '../../../shared/api/permissionsApi'
import { rolesApi, type RoleListItemDto } from '../../settings-roles/api/rolesApi'
import { usersApi, type PermissionOverrideDto } from '../api/usersApi'
import { PermissionOverrideGrid } from '../components/PermissionOverrideGrid/PermissionOverrideGrid'
import styles from './UserFormPage.module.css'

export function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [catalog, setCatalog] = useState<PermissionFeatureDto[]>([])
  const [roleGrants, setRoleGrants] = useState<Set<string>>(new Set())

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [overrides, setOverrides] = useState<PermissionOverrideDto[]>([])

  useEffect(() => {
    const token = accessToken
    if (!token) return
    let cancelled = false

    async function bootstrap(token: string) {
      try {
        const [roleList, catalogList] = await Promise.all([
          rolesApi.list(token, { pageSize: 100 }),
          permissionsApi.catalog(token),
        ])
        if (cancelled) return
        setRoles(roleList.items)
        setCatalog(catalogList)

        if (id) {
          const user = await usersApi.get(token, id)
          if (cancelled) return
          setName(user.name)
          setEmail(user.email)
          setPhone(user.phoneNumber ?? '')
          setRoleId(user.roleId ?? '')
          setIsActive(user.isActive)
          setOverrides(user.permissionOverrides)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this page.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrap(token)
    return () => {
      cancelled = true
    }
  }, [accessToken, id])

  useEffect(() => {
    if (!accessToken || !roleId) {
      setRoleGrants(new Set())
      return
    }
    let cancelled = false
    rolesApi
      .get(accessToken, roleId)
      .then((role) => {
        if (cancelled) return
        setRoleGrants(new Set(role.permissions.map((p) => `${p.featureKey}:${p.capability}`)))
      })
      .catch(() => {
        if (!cancelled) setRoleGrants(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, roleId])

  const selectedRole = roles.find((r) => r.id === roleId)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const token = await ensureFreshAccessToken()
      let userId = id

      if (isEdit && id) {
        await usersApi.update(token, id, { name, email, phoneNumber: phone || null, roleId: roleId || null })
      } else {
        const result = await usersApi.create(token, {
          name,
          email,
          phoneNumber: phone || null,
          roleId: roleId || null,
          isActive,
        })
        userId = result.user.id
        setTempPassword(result.temporaryPassword)
      }

      if (userId) {
        await usersApi.replaceOverrides(token, userId, overrides)
      }

      if (isEdit) {
        navigate('/settings/users')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this user.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SkeletonText lines={6} />
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{isEdit ? 'Edit User' : 'Add User'}</h1>
        <Button variant="ghost" onClick={() => navigate('/settings/users')}>
          Cancel
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {tempPassword && (
        <div className={styles.tempPasswordBanner}>
          <span>User created. Share this temporary password securely — it won't be shown again:</span>
          <span className={styles.tempPasswordValue}>{tempPassword}</span>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className={styles.grid}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Personal Information</h2>
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(tempPassword)}
            />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {!isEdit && (
              <Checkbox
                label="Active — user can sign in immediately"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            )}
          </div>

          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Role &amp; Permissions</h2>
            <div className={styles.selectField}>
              <label htmlFor="role-select">Role</label>
              <select id="role-select" className={styles.select} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">No role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedRole?.isAdministrator && (
              <div className={styles.adminNotice}>
                This role has unrestricted Administrator access — permission overrides below won't
                have any effect.
              </div>
            )}
            <p className={styles.hint}>
              Check a box to grant a capability the role doesn't have; uncheck one to revoke a
              capability the role does have. Everything else follows the role.
            </p>
          </div>

          <div className={`${styles.panel} ${styles.fullWidthPanel}`}>
            <PermissionOverrideGrid
              catalog={catalog}
              roleGrants={roleGrants}
              overrides={overrides}
              onChange={setOverrides}
              disabled={selectedRole?.isAdministrator}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      </form>
    </div>
  )
}
