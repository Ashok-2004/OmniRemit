import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Switch } from '../../../shared/components/Switch/Switch'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { Tabs, TabPanel } from '../../../shared/components/Tabs/Tabs'
import { Badge } from '../../../shared/components/Badge/Badge'
import { ApiError } from '../../../shared/api/httpClient'
import { permissionsApi, type PermissionFeatureDto } from '../../../shared/api/permissionsApi'
import { rolesApi, type RolePermissionGrantDto, type RoleUserDto } from '../api/rolesApi'
import { PermissionMatrix } from '../components/PermissionMatrix/PermissionMatrix'
import { UsersUsingRolePanel } from '../components/UsersUsingRolePanel/UsersUsingRolePanel'
import styles from './RoleFormPage.module.css'

const TAB_IDS = {
  basics: 'basics',
  hostPermissions: 'host-permissions',
  applicationAccess: 'application-access',
  assignedUsers: 'assigned-users',
} as const

export function RoleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const refreshSession = useAuthStore((s) => s.refreshSession)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSystemRole, setIsSystemRole] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.basics)

  const [catalog, setCatalog] = useState<PermissionFeatureDto[]>([])
  const [roleUsers, setRoleUsers] = useState<RoleUserDto[] | undefined>(undefined)
  /** Real total assigned count — the list itself is capped server-side. */
  const [roleUsersTotal, setRoleUsersTotal] = useState<number | undefined>(undefined)

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
        const catalogList = await permissionsApi.catalog(token)
        if (cancelled) return
        setCatalog(catalogList)

        if (id) {
          const role = await rolesApi.get(token, id)
          if (cancelled) return
          setName(role.name)
          setDescription(role.description ?? '')
          setIsAdministrator(role.isAdministrator)
          setIsSystemRole(role.isSystemRole)
          setPermissions(role.permissions)

          const users = await rolesApi.users(token, id)
          if (!cancelled) {
            setRoleUsers(users.items)
            setRoleUsersTotal(users.total)
          }
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

  const hostFeatures = useMemo(() => catalog.filter((f) => f.source === 'Host'), [catalog])
  const remoteFeatures = useMemo(() => catalog.filter((f) => f.source === 'RemoteApp'), [catalog])

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
      // The acting admin may have just changed a role that affects their OWN effective permissions
      // (their own role, or a capability the sidebar/routes are already checking) — force this
      // session's own JWT to refresh now instead of waiting up to AccessTokenMinutes. Other
      // already-logged-in users on this role pick it up on their own next natural refresh.
      void refreshSession()
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

  const tabs = [
    { key: TAB_IDS.basics, label: 'Basic Details' },
    { key: TAB_IDS.hostPermissions, label: 'Host Permissions' },
    {
      key: TAB_IDS.applicationAccess,
      label: 'Application Access',
      suffix: remoteFeatures.length > 0 ? <Badge tone="neutral">{remoteFeatures.length}</Badge> : undefined,
    },
    { key: TAB_IDS.assignedUsers, label: 'Assigned Users' },
  ]

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
        <Tabs id="role-form-tabs" tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

        <TabPanel id="role-form-tabs" tabId={TAB_IDS.basics} active={activeTab === TAB_IDS.basics}>
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
          </div>
        </TabPanel>

        <TabPanel id="role-form-tabs" tabId={TAB_IDS.hostPermissions} active={activeTab === TAB_IDS.hostPermissions}>
          <PermissionMatrix
            catalog={hostFeatures}
            permissions={permissions}
            onChange={setPermissions}
            disabled={isAdministrator}
            showGroupHeader={false}
            emptyMessage="No host permission features found."
          />
        </TabPanel>

        <TabPanel id="role-form-tabs" tabId={TAB_IDS.applicationAccess} active={activeTab === TAB_IDS.applicationAccess}>
          <PermissionMatrix
            catalog={remoteFeatures}
            permissions={permissions}
            onChange={setPermissions}
            disabled={isAdministrator}
            showGroupHeader={false}
            emptyMessage="Registered applications will appear here for role-based access assignment."
          />
        </TabPanel>

        <TabPanel id="role-form-tabs" tabId={TAB_IDS.assignedUsers} active={activeTab === TAB_IDS.assignedUsers}>
          <UsersUsingRolePanel users={roleUsers} total={roleUsersTotal} isNewRole={!isEdit} />
        </TabPanel>

        <div className={styles.actions}>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      </form>
    </div>
  )
}
