import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Switch } from '../../../shared/components/Switch/Switch'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { permissionsApi, type PermissionFeatureDto } from '../../../shared/api/permissionsApi'
import { rolesApi, type RolePermissionGrantDto, type RoleUserDto } from '../api/rolesApi'
import { Icon } from '../../../shared/components/Icon/Icon'
import styles from './RoleFormPage.module.css'

const TAB_IDS = {
  basics: 'basics',
  hostPermissions: 'host-permissions',
  applicationAccess: 'application-access',
  assignedUsers: 'assigned-users',
} as const

type TabType = (typeof TAB_IDS)[keyof typeof TAB_IDS]

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
  const [activeTab, setActiveTab] = useState<TabType>(TAB_IDS.basics)

  const [catalog, setCatalog] = useState<PermissionFeatureDto[]>([])
  const [roleUsers, setRoleUsers] = useState<RoleUserDto[]>([])
  const [roleUsersTotal, setRoleUsersTotal] = useState<number>(0)
  const [userSearch, setUserSearch] = useState('')

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

  const isGranted = (featureKey: string, capability: string) => {
    if (isAdministrator) return true
    return permissions.some((p) => p.featureKey === featureKey && p.capability === capability)
  }

  const togglePermission = (featureKey: string, capability: string) => {
    if (isAdministrator) return
    setPermissions((prev) => {
      const exists = prev.some((p) => p.featureKey === featureKey && p.capability === capability)
      if (exists) {
        return prev.filter((p) => !(p.featureKey === featureKey && p.capability === capability))
      } else {
        return [...prev, { featureKey, capability }]
      }
    })
  }

  const selectAllForFeature = (feature: PermissionFeatureDto) => {
    if (isAdministrator) return
    setPermissions((prev) => {
      const otherPerms = prev.filter((p) => p.featureKey !== feature.key)
      const newPerms = feature.capabilities.map((c) => ({
        featureKey: feature.key,
        capability: c.key,
      }))
      return [...otherPerms, ...newPerms]
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const token = await ensureFreshAccessToken()
      const body = {
        name,
        description: description || null,
        isAdministrator,
        permissions: isAdministrator ? [] : permissions,
      }

      if (isEdit && id) {
        await rolesApi.update(token, id, body)
      } else {
        await rolesApi.create(token, body)
      }

      void refreshSession()
      navigate('/settings/roles')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this role.')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!userSearch) return roleUsers
    const q = userSearch.toLowerCase()
    return roleUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [roleUsers, userSearch])

  if (loading) {
    return <SkeletonText lines={6} />
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <div className={styles.headerIconBox}>
            <Icon.ShieldCheck width={24} height={24} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>{isEdit ? 'Edit System Role' : 'Create System Role'}</h1>
            <p className={styles.pageSubtitle}>Define role scope, host permissions, and application access matrices</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => navigate('/settings/roles')}>
          Cancel
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Tabs List */}
      <div className={styles.tabsNav}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === TAB_IDS.basics ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab(TAB_IDS.basics)}
        >
          Basic Details
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === TAB_IDS.hostPermissions ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab(TAB_IDS.hostPermissions)}
        >
          Host Permissions
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === TAB_IDS.applicationAccess ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab(TAB_IDS.applicationAccess)}
        >
          <span>Application Access</span>
          {remoteFeatures.length > 0 && (
            <span className={styles.tabBadge}>{remoteFeatures.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === TAB_IDS.assignedUsers ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab(TAB_IDS.assignedUsers)}
        >
          <span>Assigned Users</span>
          {roleUsersTotal > 0 && (
            <span className={styles.tabBadge}>{roleUsersTotal}</span>
          )}
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className={styles.form}>
        {/* Tab 1: Basics */}
        {activeTab === TAB_IDS.basics && (
          <div className={styles.tabSection}>
            <div className={styles.formCard}>
              <h3 className={styles.formCardTitle}>Role Details</h3>
              <div className={styles.fieldsGrid}>
                <div className={styles.inputGroupFull}>
                  <label className={styles.label}>
                    Role Name <span className={styles.req}>*</span>
                  </label>
                  <div className={styles.inputIconWrap}>
                    <input
                      type="text"
                      required
                      className={styles.inputWithIcon}
                      placeholder="e.g. Employee Operations Manager"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <Icon.ShieldCheck width={18} height={18} className={styles.fieldLeftIcon} />
                  </div>
                </div>

                <div className={styles.inputGroupFull}>
                  <label className={styles.label}>Role Description</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Briefly describe the operational scope and capabilities of this role..."
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={styles.adminToggleCard}>
              <div className={styles.adminToggleText}>
                <div className={styles.adminTitleRow}>
                  <span className={isAdministrator ? styles.badgeDotGreen : styles.badgeDotGray} />
                  <span className={styles.toggleTitle}>Platform Administrator Access</span>
                </div>
                <span className={styles.toggleDesc}>
                  Grants full unrestricted access to all host features and remote applications, including future micro-frontends.
                </span>
              </div>
              <Switch
                checked={isAdministrator}
                disabled={isSystemRole && isAdministrator}
                onChange={(e) => setIsAdministrator(e.target.checked)}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Host Permissions */}
        {activeTab === TAB_IDS.hostPermissions && (
          <div className={styles.tabSection}>
            <div className={styles.matrixCard}>
              <div className={styles.matrixHeader}>
                <div>
                  <h4 className={styles.matrixTitle}>Platform Administrative Modules</h4>
                  <p className={styles.matrixSubtitle}>
                    {isAdministrator
                      ? 'Administrator roles automatically receive all capabilities across host features.'
                      : 'Configure granular read, create, edit, and delete permissions for core platform features.'}
                  </p>
                </div>
              </div>

              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th className={styles.thFeature}>FEATURE / MODULE</th>
                    <th className={styles.thCap}>VIEW</th>
                    <th className={styles.thCap}>CREATE</th>
                    <th className={styles.thCap}>EDIT</th>
                    <th className={styles.thCap}>DELETE</th>
                  </tr>
                </thead>
                <tbody>
                  {hostFeatures.map((f) => {
                    const hasView = f.capabilities.some((c) => c.key === 'View')
                    const hasCreate = f.capabilities.some((c) => c.key === 'Create' || c.key === 'Register')
                    const createCapKey = f.capabilities.find((c) => c.key === 'Create' || c.key === 'Register')?.key || 'Create'
                    const hasEdit = f.capabilities.some((c) => c.key === 'Edit')
                    const hasDelete = f.capabilities.some((c) => c.key === 'Delete' || c.key === 'Disable')
                    const deleteCapKey = f.capabilities.find((c) => c.key === 'Delete' || c.key === 'Disable')?.key || 'Delete'

                    return (
                      <tr key={f.key}>
                        <td className={styles.tdFeature}>
                          <span className={styles.featureName}>{f.displayName}</span>
                          <span className={styles.featureKey}>{f.key}</span>
                        </td>
                        <td className={styles.tdCap}>
                          {hasView ? (
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={isGranted(f.key, 'View')}
                              disabled={isAdministrator}
                              onChange={() => togglePermission(f.key, 'View')}
                            />
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td className={styles.tdCap}>
                          {hasCreate ? (
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={isGranted(f.key, createCapKey)}
                              disabled={isAdministrator}
                              onChange={() => togglePermission(f.key, createCapKey)}
                            />
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td className={styles.tdCap}>
                          {hasEdit ? (
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={isGranted(f.key, 'Edit')}
                              disabled={isAdministrator}
                              onChange={() => togglePermission(f.key, 'Edit')}
                            />
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td className={styles.tdCap}>
                          {hasDelete ? (
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={isGranted(f.key, deleteCapKey)}
                              disabled={isAdministrator}
                              onChange={() => togglePermission(f.key, deleteCapKey)}
                            />
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Application Access */}
        {activeTab === TAB_IDS.applicationAccess && (
          <div className={styles.tabSection}>
            <div className={styles.matrixCard}>
              <div className={styles.matrixHeader}>
                <div>
                  <h4 className={styles.matrixTitle}>Registered Micro-Frontend Applications</h4>
                  <p className={styles.matrixSubtitle}>
                    Control granular capabilities declared by remote applications.
                  </p>
                </div>
              </div>

              {remoteFeatures.length > 0 ? (
                <table className={styles.matrixTable}>
                  <thead>
                    <tr>
                      <th className={styles.thFeature}>APPLICATION FEATURE</th>
                      <th className={styles.thCap}>VIEW</th>
                      <th className={styles.thCap}>CREATE</th>
                      <th className={styles.thCap}>EDIT</th>
                      <th className={styles.thCap}>DELETE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remoteFeatures.map((f) => {
                      const hasView = f.capabilities.some((c) => c.key === 'View')
                      const hasCreate = f.capabilities.some((c) => c.key === 'Create')
                      const hasEdit = f.capabilities.some((c) => c.key === 'Edit')
                      const hasDelete = f.capabilities.some((c) => c.key === 'Delete')

                      return (
                        <tr key={f.key}>
                          <td className={styles.tdFeature}>
                            <div className={styles.appRowNameWrap}>
                              <span className={styles.featureName}>{f.displayName}</span>
                              {!isAdministrator && (
                                <button
                                  type="button"
                                  className={styles.selectLink}
                                  onClick={() => selectAllForFeature(f)}
                                >
                                  Select all
                                </button>
                              )}
                            </div>
                            <span className={styles.featureKey}>{f.key}</span>
                          </td>
                          <td className={styles.tdCap}>
                            {hasView ? (
                              <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={isGranted(f.key, 'View')}
                                disabled={isAdministrator}
                                onChange={() => togglePermission(f.key, 'View')}
                              />
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td className={styles.tdCap}>
                            {hasCreate ? (
                              <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={isGranted(f.key, 'Create')}
                                disabled={isAdministrator}
                                onChange={() => togglePermission(f.key, 'Create')}
                              />
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td className={styles.tdCap}>
                            {hasEdit ? (
                              <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={isGranted(f.key, 'Edit')}
                                disabled={isAdministrator}
                                onChange={() => togglePermission(f.key, 'Edit')}
                              />
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td className={styles.tdCap}>
                            {hasDelete ? (
                              <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={isGranted(f.key, 'Delete')}
                                disabled={isAdministrator}
                                onChange={() => togglePermission(f.key, 'Delete')}
                              />
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className={styles.emptyTable}>
                  No remote applications currently registered.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Assigned Users */}
        {activeTab === TAB_IDS.assignedUsers && (
          <div className={styles.tabSection}>
            <div className={styles.usersTabHeader}>
              <div>
                <h3 className={styles.subHeading}>Assigned Role Members ({roleUsersTotal})</h3>
                <p className={styles.sectionHint}>These users dynamically inherit all capabilities configured in this role.</p>
              </div>

              <div className={styles.searchWrapSmall}>
                <input
                  type="text"
                  className={styles.searchInputSmall}
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <Icon.Search width={14} height={14} className={styles.searchIconSmall} />
              </div>
            </div>

            <div className={styles.usersTableWrap}>
              <table className={styles.usersTable}>
                <thead>
                  <tr>
                    <th>USER</th>
                    <th>EMAIL ADDRESS</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.userAvatar}>
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                            <span className={styles.userNameText}>{u.name}</span>
                          </div>
                        </td>
                        <td className={styles.userEmailText}>{u.email}</td>
                        <td>
                          <span className={styles.activeBadgeSmall}>
                            <span className={styles.badgeDot} />
                            Active
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className={styles.emptyUsersCell}>
                        {isEdit ? 'No users assigned to this role yet.' : 'Users can be assigned to this role once saved.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/settings/roles')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            <Icon.CheckCircle width={16} height={16} />
            <span>{isEdit ? 'Save Changes' : 'Create Role'}</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
