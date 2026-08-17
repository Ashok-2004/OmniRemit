import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { permissionsApi, type PermissionFeatureDto } from '../../shared/api/permissionsApi'
import { rolesApi, type RolePermissionGrantDto, type RoleUserDto } from '../../features/settings-roles/api/rolesApi'
import { remoteAppsApi, type RemoteAppDto } from '../../features/settings-applications/api/remoteAppsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { Switch } from '../../shared/components/Switch/Switch'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import styles from './RoleFormLayer.module.css'

interface RoleFormLayerProps {
  roleId?: string
  initialTab?: string
}

type TabType = 'basic' | 'host' | 'apps' | 'users'

export function RoleFormLayer({ roleId, initialTab }: RoleFormLayerProps) {
  const isEdit = Boolean(roleId)
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const refreshSession = useAuthStore((s) => s.refreshSession)
  const popLayer = useSettingsDrawerStore((s) => s.popLayer)

  const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || 'basic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isAdministrator, setIsAdministrator] = useState(false)
  const [isSystemRole, setIsSystemRole] = useState(false)
  const [permissions, setPermissions] = useState<RolePermissionGrantDto[]>([])

  // Data
  const [catalog, setCatalog] = useState<PermissionFeatureDto[]>([])
  const [remoteApps, setRemoteApps] = useState<RemoteAppDto[]>([])
  const [assignedUsers, setAssignedUsers] = useState<RoleUserDto[]>([])
  const [assignedUsersTotal, setAssignedUsersTotal] = useState(0)
  const [userSearch, setUserSearch] = useState('')

  // Accordion expanded state for remote apps
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function loadData() {
      try {
        const [catalogRes, appsRes] = await Promise.all([
          permissionsApi.catalog(accessToken!),
          remoteAppsApi.list(accessToken!, { pageSize: 100 }),
        ])

        if (cancelled) return
        setCatalog(catalogRes)
        setRemoteApps(appsRes.items)

        // Expand first remote app by default
        if (appsRes.items.length > 0) {
          setExpandedApps({ [appsRes.items[0].key]: true })
        }

        if (roleId) {
          const [roleRes, usersRes] = await Promise.all([
            rolesApi.get(accessToken!, roleId),
            rolesApi.users(accessToken!, roleId),
          ])

          if (cancelled) return
          setName(roleRes.name)
          setDescription(roleRes.description ?? '')
          setIsAdministrator(roleRes.isAdministrator)
          setIsSystemRole(roleRes.isSystemRole)
          setPermissions(roleRes.permissions)
          setAssignedUsers(usersRes.items)
          setAssignedUsersTotal(usersRes.total)
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load role details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [accessToken, roleId])

  const hostFeatures = useMemo(() => catalog.filter((f) => f.source === 'Host'), [catalog])

  // Capability checking helpers
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

  const toggleAppAccordion = (key: string) => {
    setExpandedApps((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleCollapseAll = () => {
    setExpandedApps({})
  }

  const handleSelectAllAppPerms = (appKey: string) => {
    if (isAdministrator) return
    const feature = catalog.find((f) => f.key === `remote.${appKey}`)
    if (!feature) return

    setPermissions((prev) => {
      const otherPerms = prev.filter((p) => p.featureKey !== feature.key)
      const allAppPerms = feature.capabilities.map((c) => ({
        featureKey: feature.key,
        capability: c.key,
      }))
      return [...otherPerms, ...allAppPerms]
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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

      if (isEdit && roleId) {
        await rolesApi.update(token, roleId, body)
      } else {
        await rolesApi.create(token, body)
      }

      void refreshSession()
      popLayer()
    } catch (err: any) {
      setError(err?.message || 'Could not save role.')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!userSearch) return assignedUsers
    const q = userSearch.toLowerCase()
    return assignedUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [assignedUsers, userSearch])

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <SkeletonBlock height={50} width="70%" />
        <SkeletonBlock height={180} width="100%" />
        <SkeletonBlock height={180} width="100%" />
      </div>
    )
  }

  return (
    <div className={styles.layer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <div className={styles.headerIconBox}>
            <Icon.ShieldCheck width={20} height={20} />
          </div>
          <div>
            <h2 className={styles.title}>{isEdit ? 'Edit Role Definition' : 'Create System Role'}</h2>
            <p className={styles.subtitle}>Define role scope, host permissions, and application access</p>
          </div>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={popLayer}
          aria-label="Close Role Editor"
        >
          <Icon.X width={20} height={20} />
        </button>
      </div>

      {error && <div className={styles.errorAlert}>{error}</div>}

      {/* Tabs Bar */}
      <div className={styles.tabsList}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'basic' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          <span>Basic Details</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'host' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('host')}
        >
          <span>Host Permissions</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'apps' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('apps')}
        >
          <span>Application Access</span>
          {remoteApps.length > 0 && (
            <span className={styles.tabBadge}>{remoteApps.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span>Assigned Users</span>
          {assignedUsersTotal > 0 && (
            <span className={styles.tabBadge}>{assignedUsersTotal}</span>
          )}
        </button>
      </div>

      {/* Form Content */}
      <form id="role-form" onSubmit={(e) => void handleSubmit(e)} className={styles.form}>
        <div className={styles.contentArea}>
          {/* Tab 1: Basic Details */}
          {activeTab === 'basic' && (
            <div className={styles.tabSection}>
              <div className={styles.formCard}>
                <h4 className={styles.formCardTitle}>Role Details</h4>
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
                      <Icon.ShieldCheck width={16} height={16} className={styles.fieldLeftIcon} />
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
          {activeTab === 'host' && (
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

                <div className={styles.matrixTableWrap}>
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
            </div>
          )}

          {/* Tab 3: Application Access */}
          {activeTab === 'apps' && (
            <div className={styles.tabSection}>
              <div className={styles.appsHeaderRow}>
                <p className={styles.sectionHint}>
                  Control access to registered micro-frontend applications and their respective sub-modules.
                </p>
                <div className={styles.appsHeaderActions}>
                  <button
                    type="button"
                    className={styles.textActionBtn}
                    onClick={handleCollapseAll}
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              <div className={styles.accordionList}>
                {remoteApps
                  .filter((app) => app.status !== 'Disabled')
                  .map((app) => {
                    const isExpanded = Boolean(expandedApps[app.key])
                    const featureKey = `remote.${app.key}`
                    const feature = catalog.find((f) => f.key === featureKey)
                    const caps = (feature?.capabilities && feature.capabilities.length > 0)
                      ? feature.capabilities
                      : (app.capabilities ?? [])

                    const hasBaseCreate = caps.some((c) => c.key === 'Create')
                    const hasBaseView = caps.some((c) => c.key === 'View')
                    const hasBaseEdit = caps.some((c) => c.key === 'Edit')
                    const hasBaseDelete = caps.some((c) => c.key === 'Delete')

                    const submodules = Array.from(
                      new Set(
                        caps
                          .filter((c) => c.key.includes(':'))
                          .map((c) => c.key.split(':')[0]),
                      ),
                    )

                    return (
                      <div key={app.id} className={styles.accordionCard}>
                        {/* Accordion Bar */}
                        <div
                          className={styles.accordionHeader}
                          onClick={() => toggleAppAccordion(app.key)}
                        >
                          <div className={styles.appTitleGroup}>
                            <div className={styles.appIconSmall}>
                              <Icon.Users width={18} height={18} />
                            </div>
                            <div>
                              <span className={styles.accordionAppName}>{app.displayName}</span>
                              <span className={styles.accordionAppKey}>{app.key}</span>
                            </div>
                          </div>

                          <div className={styles.accordionRightMeta}>
                            <span className={styles.activeBadge}>
                              <span className={styles.badgeDot} />
                              {app.status}
                            </span>
                            {isExpanded ? (
                              <Icon.ChevronUp width={18} height={18} className={styles.chevron} />
                            ) : (
                              <Icon.ChevronDown width={18} height={18} className={styles.chevron} />
                            )}
                          </div>
                        </div>

                        {/* Expanded Permission Matrix */}
                        {isExpanded && (
                          <div className={styles.accordionBody}>
                            <div className={styles.selectRow}>
                              <span className={styles.appScopeLabel}>Declared Application Capabilities</span>
                              {!isAdministrator && (
                                <button
                                  type="button"
                                  className={styles.selectLink}
                                  onClick={() => handleSelectAllAppPerms(app.key)}
                                >
                                  Select all
                                </button>
                              )}
                            </div>

                            <table className={styles.matrixTable}>
                              <thead>
                                <tr>
                                  <th className={styles.thFeature}>SUB-MODULE / CAPABILITY</th>
                                  <th className={styles.thCap}>CREATE</th>
                                  <th className={styles.thCap}>VIEW</th>
                                  <th className={styles.thCap}>EDIT</th>
                                  <th className={styles.thCap}>DELETE</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Primary entity row */}
                                <tr>
                                  <td className={styles.tdFeature}>
                                    <span className={styles.featureName}>{app.displayName} (Base Access)</span>
                                  </td>
                                  <td className={styles.tdCap}>
                                    {hasBaseCreate ? (
                                      <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={isGranted(featureKey, 'Create')}
                                        disabled={isAdministrator}
                                        onChange={() => togglePermission(featureKey, 'Create')}
                                      />
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                  </td>
                                  <td className={styles.tdCap}>
                                    {hasBaseView ? (
                                      <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={isGranted(featureKey, 'View')}
                                        disabled={isAdministrator}
                                        onChange={() => togglePermission(featureKey, 'View')}
                                      />
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                  </td>
                                  <td className={styles.tdCap}>
                                    {hasBaseEdit ? (
                                      <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={isGranted(featureKey, 'Edit')}
                                        disabled={isAdministrator}
                                        onChange={() => togglePermission(featureKey, 'Edit')}
                                      />
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                  </td>
                                  <td className={styles.tdCap}>
                                    {hasBaseDelete ? (
                                      <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={isGranted(featureKey, 'Delete')}
                                        disabled={isAdministrator}
                                        onChange={() => togglePermission(featureKey, 'Delete')}
                                      />
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                  </td>
                                </tr>

                                {submodules.map((sub) => {
                                  const hasSubCreate = caps.some((c) => c.key === `${sub}:Create`)
                                  const hasSubView = caps.some((c) => c.key === `${sub}:View`)
                                  const hasSubEdit = caps.some((c) => c.key === `${sub}:Edit`)
                                  const hasSubDelete = caps.some((c) => c.key === `${sub}:Delete`)

                                  return (
                                    <tr key={sub}>
                                      <td className={styles.tdFeature}>
                                        <span className={styles.featureName}>{sub}</span>
                                      </td>
                                      <td className={styles.tdCap}>
                                        {hasSubCreate ? (
                                          <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={isGranted(featureKey, `${sub}:Create`)}
                                            disabled={isAdministrator}
                                            onChange={() => togglePermission(featureKey, `${sub}:Create`)}
                                          />
                                        ) : (
                                          <span style={{ color: '#94a3b8' }}>—</span>
                                        )}
                                      </td>
                                      <td className={styles.tdCap}>
                                        {hasSubView ? (
                                          <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={isGranted(featureKey, `${sub}:View`)}
                                            disabled={isAdministrator}
                                            onChange={() => togglePermission(featureKey, `${sub}:View`)}
                                          />
                                        ) : (
                                          <span style={{ color: '#94a3b8' }}>—</span>
                                        )}
                                      </td>
                                      <td className={styles.tdCap}>
                                        {hasSubEdit ? (
                                          <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={isGranted(featureKey, `${sub}:Edit`)}
                                            disabled={isAdministrator}
                                            onChange={() => togglePermission(featureKey, `${sub}:Edit`)}
                                          />
                                        ) : (
                                          <span style={{ color: '#94a3b8' }}>—</span>
                                        )}
                                      </td>
                                      <td className={styles.tdCap}>
                                        {hasSubDelete ? (
                                          <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={isGranted(featureKey, `${sub}:Delete`)}
                                            disabled={isAdministrator}
                                            onChange={() => togglePermission(featureKey, `${sub}:Delete`)}
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
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Tab 4: Assigned Users */}
          {activeTab === 'users' && (
            <div className={styles.tabSection}>
              <div className={styles.usersTabHeader}>
                <div>
                  <h4 className={styles.subHeading}>Assigned Role Members ({assignedUsersTotal})</h4>
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
        </div>

        {/* Sticky Bottom Bar */}
        <div className={styles.bottomBar}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={popLayer}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={saving}
          >
            {saving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Icon.CheckCircle width={16} height={16} />
                <span>{isEdit ? 'Save Changes' : 'Create System Role'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
