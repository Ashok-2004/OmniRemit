import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { permissionsApi, type PermissionFeatureDto } from '../../shared/api/permissionsApi'
import { rolesApi, type RolePermissionGrantDto, type RoleUserDto } from '../../features/settings-roles/api/rolesApi'
import { remoteAppsApi, type RemoteAppDto } from '../../features/settings-applications/api/remoteAppsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { resolveIcon } from '../../shared/components/Icon/resolveIcon'
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
  const notifyMutation = useSettingsDrawerStore((s) => s.notifyMutation)

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

  /**
   * Columns for the host permission grid: the union of every capability host features declare.
   *
   * The grid used to have four fixed columns — View / Create / Edit / Delete — and folded the odd
   * ones out by aliasing (`Register` shown under Create, `Disable` under Delete). Anything that
   * matched no column simply had no checkbox, which silently made three seeded capabilities
   * impossible to grant through the UI at all:
   *
   *   host.settings.users         -> Disable   (Delete already claimed the column)
   *   host.settings.applications  -> Disable   (same)
   *   host.system.audit-logs      -> Export    (matched nothing)
   *
   * An administrator could not give anyone "export the audit log" or "deactivate a user" no matter
   * what they clicked. Deriving columns from the catalog fixes that permanently: a capability added
   * to a feature server-side shows up here with no frontend change.
   */
  const hostColumns = useMemo(() => {
    const columns: { key: string; displayName: string }[] = []
    for (const feature of hostFeatures) {
      for (const cap of feature.capabilities) {
        if (!columns.some((c) => c.key === cap.key)) {
          columns.push({ key: cap.key, displayName: cap.displayName })
        }
      }
    }
    return columns
  }, [hostFeatures])

  /**
   * One permission grid per registered application, built entirely from the catalog.
   *
   * This replaces a version that hardcoded four columns (Create/View/Edit/Delete) and tried to find
   * sub-modules by looking for a ':' inside capability keys. Both were wrong against the real
   * contract:
   *
   *  - Capability keys are plain verbs ('View', 'Approve', 'Export'). None contain a colon, so the
   *    sub-module branch was dead code and no sub-module row ever rendered.
   *  - Sub-modules are real `children` features, each with its OWN key
   *    (`remote.employee.department`) and its own capability set.
   *  - Fixing the columns to four verbs meant a remote declaring anything else — `Approve` on a
   *    payments module, say — had no checkbox at all, so the capability could never be granted no
   *    matter what the remote reported. That defeats the point of dynamic discovery.
   *
   * Columns are therefore the union of whatever the app and its sub-modules actually declare, in the
   * order the declaring service listed them (the backend already returns capabilities sorted by its
   * own SortOrder). A row shows a checkbox only for capabilities that row declares, and a dash
   * otherwise — so the grid stays honest about what is grantable where.
   */
  const appPermissionGroups = useMemo(() => {
    return remoteApps
      .filter((app) => app.status !== 'Disabled')
      .map((app) => {
        const feature = catalog.find((f) => f.key === `remote.${app.key}`)
        if (!feature) return null

        const rows = [
          // The app's own feature is grantable in its own right only if it declares capabilities.
          // An app that delegates everything to sub-modules gets no base row rather than an empty one.
          ...(feature.capabilities.length > 0
            ? [
                {
                  key: feature.key,
                  label: `${feature.displayName} (base access)`,
                  capabilities: feature.capabilities,
                },
              ]
            : []),
          ...feature.children.map((child) => ({
            key: child.key,
            label: child.displayName,
            capabilities: child.capabilities,
          })),
        ]

        const columns: { key: string; displayName: string }[] = []
        for (const row of rows) {
          for (const cap of row.capabilities) {
            if (!columns.some((c) => c.key === cap.key)) {
              columns.push({ key: cap.key, displayName: cap.displayName })
            }
          }
        }

        return { app, feature, rows, columns }
      })
      .filter((group): group is NonNullable<typeof group> => group !== null)
  }, [remoteApps, catalog])

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

  /**
   * Grant every capability this app declares, sub-modules included.
   *
   * The previous version only granted the app's own feature capabilities, so on a two-level app
   * "Select all" silently left every sub-module unchecked — the operator saw the link do almost
   * nothing and had no way to know why.
   */
  const handleSelectAllAppPerms = (appKey: string) => {
    if (isAdministrator) return
    const group = appPermissionGroups.find((g) => g.app.key === appKey)
    if (!group) return

    const rowKeys = new Set(group.rows.map((r) => r.key))
    setPermissions((prev) => [
      ...prev.filter((p) => !rowKeys.has(p.featureKey)),
      ...group.rows.flatMap((row) =>
        row.capabilities.map((cap) => ({ featureKey: row.key, capability: cap.key })),
      ),
    ])
  }

  /** True when this app has no grants at all — drives the accordion's summary count. */
  const grantedCountForApp = (appKey: string) => {
    const group = appPermissionGroups.find((g) => g.app.key === appKey)
    if (!group) return 0
    const rowKeys = new Set(group.rows.map((r) => r.key))
    return permissions.filter((p) => rowKeys.has(p.featureKey)).length
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
      // Tells the roles list underneath to refetch. Without this the drawer closed onto stale rows
      // and the only way to see the change you just saved was a full page reload.
      notifyMutation()
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
                  {hostColumns.length === 0 ? (
                    <p className={styles.sectionHint}>The permission catalog is empty.</p>
                  ) : (
                    <table className={styles.matrixTable}>
                      <thead>
                        <tr>
                          <th className={styles.thFeature}>FEATURE / MODULE</th>
                          {hostColumns.map((col) => (
                            <th key={col.key} className={styles.thCap} title={col.displayName}>
                              {col.displayName.toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hostFeatures.map((f) => (
                          <tr key={f.key}>
                            <td className={styles.tdFeature}>
                              <span className={styles.featureName}>{f.displayName}</span>
                              <span className={styles.featureKey}>{f.key}</span>
                            </td>
                            {hostColumns.map((col) => {
                              const declared = f.capabilities.some((c) => c.key === col.key)
                              return (
                                <td key={col.key} className={styles.tdCap}>
                                  {declared ? (
                                    <input
                                      type="checkbox"
                                      className={styles.checkbox}
                                      checked={isGranted(f.key, col.key)}
                                      disabled={isAdministrator}
                                      aria-label={`${col.displayName} on ${f.displayName}`}
                                      onChange={() => togglePermission(f.key, col.key)}
                                    />
                                  ) : (
                                    <span className={styles.capNotDeclared} title="Not applicable to this feature">
                                      —
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
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
                {appPermissionGroups.length === 0 && (
                  <p className={styles.sectionHint}>
                    No registered application has declared any permissions yet. Set a Permissions
                    Source URL on an application and resync it to populate this tab.
                  </p>
                )}

                {appPermissionGroups.map(({ app, rows, columns }) => {
                  const isExpanded = Boolean(expandedApps[app.key])
                  const AppIcon = resolveIcon(app.iconKey)
                  const grantedCount = grantedCountForApp(app.key)

                  return (
                    <div key={app.id} className={styles.accordionCard}>
                      <div
                        className={styles.accordionHeader}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => toggleAppAccordion(app.key)}
                        onKeyDown={(e) => {
                          // Keyboard parity with the mouse. The header was a plain div, so an
                          // operator navigating by keyboard could not expand an app at all.
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleAppAccordion(app.key)
                          }
                        }}
                      >
                        <div className={styles.appTitleGroup}>
                          <div className={styles.appIconSmall}>
                            <AppIcon width={18} height={18} />
                          </div>
                          <div>
                            <span className={styles.accordionAppName}>{app.displayName}</span>
                            <span className={styles.accordionAppKey}>{app.key}</span>
                          </div>
                        </div>

                        <div className={styles.accordionRightMeta}>
                          {!isAdministrator && grantedCount > 0 && (
                            <span className={styles.grantCountBadge}>
                              {grantedCount} granted
                            </span>
                          )}
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

                          {columns.length === 0 ? (
                            <p className={styles.sectionHint}>
                              This application hasn&rsquo;t declared any capabilities yet. Resync it
                              from the Applications tab to pull them in.
                            </p>
                          ) : (
                            <table className={styles.matrixTable}>
                              <thead>
                                <tr>
                                  <th className={styles.thFeature}>SUB-MODULE / CAPABILITY</th>
                                  {columns.map((col) => (
                                    <th key={col.key} className={styles.thCap} title={col.displayName}>
                                      {col.displayName.toUpperCase()}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row) => (
                                  <tr key={row.key}>
                                    <td className={styles.tdFeature}>
                                      <span className={styles.featureName}>{row.label}</span>
                                      <span className={styles.featureKey}>{row.key}</span>
                                    </td>
                                    {columns.map((col) => {
                                      const declared = row.capabilities.some((c) => c.key === col.key)
                                      return (
                                        <td key={col.key} className={styles.tdCap}>
                                          {declared ? (
                                            <input
                                              type="checkbox"
                                              className={styles.checkbox}
                                              checked={isGranted(row.key, col.key)}
                                              disabled={isAdministrator}
                                              aria-label={`${col.displayName} on ${row.label}`}
                                              onChange={() => togglePermission(row.key, col.key)}
                                            />
                                          ) : (
                                            <span className={styles.capNotDeclared} title="Not declared by this module">
                                              —
                                            </span>
                                          )}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
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
