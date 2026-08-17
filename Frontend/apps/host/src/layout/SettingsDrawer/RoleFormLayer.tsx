import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { permissionsApi, type PermissionFeatureDto } from '../../shared/api/permissionsApi'
import { rolesApi, type RolePermissionGrantDto, type RoleUserDto } from '../../features/settings-roles/api/rolesApi'
import { remoteAppsApi, type RemoteAppDto } from '../../features/settings-applications/api/remoteAppsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { Switch } from '../../shared/components/Switch/Switch'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import { resolveIcon } from '../../shared/components/Icon/resolveIcon'
import { groupsFromCatalog, columnsForRows } from '../../shared/permissions/catalog'
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

  /*
   * Grid shape comes from the catalog, never from a fixed list of verbs.
   *
   * Host columns are the union of what host features declare, so `users:Disable`,
   * `applications:Register`, `audit-logs:Export` and `profile:ChangePassword` each get a checkbox —
   * all four were previously ungrantable because the grid only had View/Create/Edit/Delete.
   */
  // Turning the administrator flag on while standing on a permission tab would otherwise leave the
  // drawer showing a tab whose button no longer exists.
  useEffect(() => {
    if (isAdministrator && (activeTab === 'host' || activeTab === 'apps')) {
      setActiveTab('basic')
    }
  }, [isAdministrator, activeTab])

  const hostGroups = useMemo(() => groupsFromCatalog(catalog, 'Host'), [catalog])
  const hostColumns = useMemo(
    () => columnsForRows(hostGroups.flatMap((g) => g.rows)),
    [hostGroups],
  )

  /*
   * One group per remote application, joined to its registry row for status and icon.
   *
   * Driven by the CATALOG, not by the remote-apps list. The previous version iterated registered apps
   * and fabricated a single "Base Access" row against the parent key `remote.employee` — which
   * declares no capabilities at all — so saving emitted `remote.employee:View` and the server rightly
   * answered "'remote.employee' does not declare a 'View' capability."
   */
  const appGroups = useMemo(
    () =>
      groupsFromCatalog(catalog, 'RemoteApp').map((group) => ({
        ...group,
        app: remoteApps.find((a) => `remote.${a.key}` === group.feature.key),
      })),
    [catalog, remoteApps],
  )

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
   * Grant every capability an application declares, sub-modules included, keyed by the FEATURE key.
   *
   * Two bugs fixed. It took an app key and rebuilt `remote.${appKey}`, which broke as soon as the grid
   * started keying rows by feature; and it only granted the parent feature's own capabilities, so on a
   * two-level app — where the parent declares none — "Select all" granted literally nothing while
   * appearing to work.
   */
  const handleSelectAllAppPerms = (featureKey: string) => {
    const group = appGroups.find((g) => g.feature.key === featureKey)
    if (!group) return

    const rowKeys = new Set(group.rows.map((r) => r.key))
    setPermissions((prev) => [
      ...prev.filter((p) => !rowKeys.has(p.featureKey)),
      ...group.rows.flatMap((row) =>
        row.capabilities.map((cap) => ({ featureKey: row.key, capability: cap.key })),
      ),
    ])
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
        /*
         * Granular grants are PERSISTED even for an administrator role.
         *
         * This used to send `[]` whenever the administrator flag was on, which permanently destroyed
         * the role's configuration: switching a carefully built role to administrator and back left
         * every checkbox empty, with no warning and no way to recover it.
         *
         * Keeping them costs nothing and changes no access. PermissionClaimsBuilder short-circuits on
         * IsAdministrator and returns "unrestricted" without reading the grant rows at all, so the
         * effective permissions of an administrator are identical either way — the rows are simply
         * still there when the flag is turned back off.
         */
        permissions,
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
        {/*
          Both permission tabs are hidden while the role is an administrator. An administrator holds
          every capability unconditionally, so a grid of checkboxes there would be describing a choice
          that has no effect — worse, it would show boxes unticked while the role in fact has that
          access. The underlying grants are kept (see the submit handler), so turning the flag back off
          restores exactly what was configured.
        */}
        {!isAdministrator && (
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'host' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('host')}
          >
            <span>Host Permissions</span>
          </button>
        )}
        {!isAdministrator && (
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'apps' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('apps')}
        >
          <span>Application Access</span>
          {appGroups.length > 0 && (
            <span className={styles.tabBadge}>{appGroups.length}</span>
          )}
        </button>
        )}
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
                      Grant only the capabilities this role needs. Columns are exactly what each
                      feature declares, so a dash means the action does not exist for that feature.
                    </p>
                  </div>
                </div>

                <div className={styles.matrixTableWrap}>
                  {hostGroups.length === 0 ? (
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
                        {hostGroups.flatMap((group) =>
                          group.rows.map((row) => (
                            <tr key={row.key}>
                              <td className={styles.tdFeature}>
                                <span className={styles.featureName}>{row.label}</span>
                                <span className={styles.featureKey}>{row.key}</span>
                              </td>
                              {hostColumns.map((col) => {
                                const declared = row.capabilities.some((c) => c.key === col.key)
                                return (
                                  <td key={col.key} className={styles.tdCap}>
                                    {declared ? (
                                      <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={isGranted(row.key, col.key)}
                                        aria-label={`${col.displayName} on ${row.label}`}
                                        onChange={() => togglePermission(row.key, col.key)}
                                      />
                                    ) : (
                                      <span
                                        className={styles.capNotDeclared}
                                        title="Not applicable to this feature"
                                      >
                                        —
                                      </span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )),
                        )}
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
                  Access to registered applications and the sub-modules each one declares. Rows and
                  columns come from what the application itself reports, so a new module or action
                  appears here as soon as it is resynced.
                </p>
                <div className={styles.appsHeaderActions}>
                  <button type="button" className={styles.textActionBtn} onClick={handleCollapseAll}>
                    Collapse all
                  </button>
                </div>
              </div>

              <div className={styles.accordionList}>
                {appGroups.length === 0 && (
                  <p className={styles.sectionHint}>
                    No registered application has declared any permissions yet. Set a Permissions
                    Source URL on an application and resync it to populate this tab.
                  </p>
                )}

                {appGroups.map(({ feature, rows, columns, app }) => {
                  const isExpanded = Boolean(expandedApps[feature.key])
                  const AppIcon = resolveIcon(app?.iconKey)
                  const grantedCount = permissions.filter((p) =>
                    rows.some((r) => r.key === p.featureKey),
                  ).length

                  return (
                    <div key={feature.key} className={styles.accordionCard}>
                      <div
                        className={styles.accordionHeader}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => toggleAppAccordion(feature.key)}
                        onKeyDown={(e) => {
                          // The header was a plain div, so an operator navigating by keyboard could
                          // not expand an application at all.
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleAppAccordion(feature.key)
                          }
                        }}
                      >
                        <div className={styles.appTitleGroup}>
                          <div className={styles.appIconSmall}>
                            <AppIcon width={18} height={18} />
                          </div>
                          <div>
                            <span className={styles.accordionAppName}>{feature.displayName}</span>
                            <span className={styles.accordionAppKey}>{feature.key}</span>
                          </div>
                        </div>

                        <div className={styles.accordionRightMeta}>
                          {grantedCount > 0 && (
                            <span className={styles.grantCountBadge}>{grantedCount} granted</span>
                          )}
                          {app && (
                            <span className={styles.activeBadge}>
                              <span className={styles.badgeDot} />
                              {app.status}
                            </span>
                          )}
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
                            <span className={styles.appScopeLabel}>Declared Capabilities</span>
                            <button
                              type="button"
                              className={styles.selectLink}
                              onClick={() => handleSelectAllAppPerms(feature.key)}
                            >
                              Select all
                            </button>
                          </div>

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
                                            aria-label={`${col.displayName} on ${row.label}`}
                                            onChange={() => togglePermission(row.key, col.key)}
                                          />
                                        ) : (
                                          <span
                                            className={styles.capNotDeclared}
                                            title="Not declared by this module"
                                          >
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
