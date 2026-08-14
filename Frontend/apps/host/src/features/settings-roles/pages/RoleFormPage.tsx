import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Switch } from '../../../shared/components/Switch/Switch'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { permissionsApi, type PermissionFeatureDto } from '../../../shared/api/permissionsApi'
import { rolesApi, type RolePermissionGrantDto, type RoleUserDto } from '../api/rolesApi'
import { PermissionMatrix } from '../components/PermissionMatrix/PermissionMatrix'
import { UsersUsingRolePanel } from '../components/UsersUsingRolePanel/UsersUsingRolePanel'
import styles from './RoleFormPage.module.css'

export function RoleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSystemRole, setIsSystemRole] = useState(false)

  const [catalog, setCatalog] = useState<PermissionFeatureDto[]>([])
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [roleUsers, setRoleUsers] = useState<RoleUserDto[] | undefined>(undefined)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isAdministrator, setIsAdministrator] = useState(false)
  const [permissions, setPermissions] = useState<RolePermissionGrantDto[]>([])

  useEffect(() => {
    const token = accessToken
    if (!token) return
    let cancelled = false

    async function bootstrap(token: string) {
      try {
        const [catalogList, capabilityList] = await Promise.all([
          permissionsApi.catalog(token),
          permissionsApi.capabilities(token),
        ])
        if (cancelled) return
        setCatalog(catalogList)
        setCapabilities(capabilityList)

        if (id) {
          const role = await rolesApi.get(token, id)
          if (cancelled) return
          setName(role.name)
          setDescription(role.description ?? '')
          setIsAdministrator(role.isAdministrator)
          setIsSystemRole(role.isSystemRole)
          setPermissions(role.permissions)

          const users = await rolesApi.users(token, id)
          if (!cancelled) setRoleUsers(users)
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const token = await ensureFreshAccessToken()
      const body = { name, description: description || null, isAdministrator, permissions }

      if (isEdit && id) {
        await rolesApi.update(token, id, body)
      } else {
        await rolesApi.create(token, body)
      }
      navigate('/settings/roles')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this role.')
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
        <h1>{isEdit ? 'Edit Role' : 'Add Role'}</h1>
        <Button variant="ghost" onClick={() => navigate('/settings/roles')}>
          Cancel
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className={styles.grid}>
          <div className={styles.mainPanel}>
            <Input label="Role" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Description"
              placeholder="What is this role for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className={styles.toggleRow}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle}>Administrator Access</span>
                <span className={styles.toggleHint}>
                  Grants every permission, including any added in future updates.
                </span>
              </div>
              <Switch
                checked={isAdministrator}
                disabled={isSystemRole && isAdministrator}
                onChange={(e) => setIsAdministrator(e.target.checked)}
              />
            </div>

            <PermissionMatrix
              catalog={catalog}
              capabilities={capabilities}
              permissions={permissions}
              onChange={setPermissions}
              disabled={isAdministrator}
            />
          </div>

          <div className={styles.sideColumn}>
            <UsersUsingRolePanel users={roleUsers} isNewRole={!isEdit} />
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      </form>
    </div>
  )
}
