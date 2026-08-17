import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Switch } from '../../../shared/components/Switch/Switch'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { rolesApi, type RoleListItemDto } from '../../settings-roles/api/rolesApi'
import { remoteAppsApi, type RemoteAppDto } from '../../settings-applications/api/remoteAppsApi'
import { permissionsApi, type PermissionFeatureDto } from '../../../shared/api/permissionsApi'
import { usersApi, type PermissionOverrideDto } from '../api/usersApi'
import { Icon } from '../../../shared/components/Icon/Icon'
import styles from './UserFormPage.module.css'

type WizardStep = 'basic' | 'permissions' | 'review'

export function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const refreshSession = useAuthStore((s) => s.refreshSession)

  const [currentStep, setCurrentStep] = useState<WizardStep>('basic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  // Step 1: Basic Fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Step 2: Permissions state
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set())
  const [selectedPermKeys, setSelectedPermKeys] = useState<Set<string>>(new Set())
  const [catalog, setCatalog] = useState<PermissionFeatureDto[]>([])
  const [remoteApps, setRemoteApps] = useState<RemoteAppDto[]>([])
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({})
  const [permSearch, setPermSearch] = useState('')

  // Global & App-wise Select All calculation directly from catalog
  const hostPermissions = useMemo(() => {
    const list: { featureKey: string; capability: string }[] = []
    catalog
      .filter((f) => f.source === 'Host')
      .forEach((f) => {
        f.capabilities.forEach((c) => {
          list.push({ featureKey: f.key, capability: c.key })
        })
      })
    return list
  }, [catalog])

  const getAppPermissions = (appKey: string) => {
    const featureKey = `remote.${appKey}`
    const feature = catalog.find((f) => f.key === featureKey)
    const remoteApp = remoteApps.find((a) => a.key === appKey)
    const caps = (feature?.capabilities && feature.capabilities.length > 0)
      ? feature.capabilities
      : (remoteApp?.capabilities ?? [])
    return caps.map((c) => ({
      featureKey,
      capability: c.key,
    }))
  }

  const allGlobalPermissions = useMemo(() => {
    const list: { featureKey: string; capability: string }[] = []
    const seen = new Set<string>()
    catalog.forEach((f) => {
      f.capabilities.forEach((c) => {
        const id = `${f.key}:${c.key}`
        if (!seen.has(id)) {
          seen.add(id)
          list.push({ featureKey: f.key, capability: c.key })
        }
      })
    })
    remoteApps.forEach((app) => {
      const featureKey = `remote.${app.key}`
      ;(app.capabilities ?? []).forEach((c) => {
        const id = `${featureKey}:${c.key}`
        if (!seen.has(id)) {
          seen.add(id)
          list.push({ featureKey, capability: c.key })
        }
      })
    })
    return list
  }, [catalog, remoteApps])

  const fetchRolePermSet = async (targetRoleId: string, catalogData: PermissionFeatureDto[], appsData: RemoteAppDto[]): Promise<Set<string>> => {
    if (!accessToken || !targetRoleId) return new Set()
    try {
      const roleDetail = await rolesApi.get(accessToken, targetRoleId)
      if (roleDetail.isAdministrator) {
        const full = new Set<string>()
        catalogData.forEach((f) => {
          f.capabilities.forEach((c) => full.add(`${f.key}:${c.key}`))
        })
        appsData.forEach((app) => {
          (app.capabilities ?? []).forEach((c) => full.add(`remote.${app.key}:${c.key}`))
        })
        return full
      }
      return new Set((roleDetail.permissions ?? []).map((p) => `${p.featureKey}:${p.capability}`))
    } catch (err) {
      console.warn('Could not fetch role permissions', err)
      return new Set()
    }
  }

  useEffect(() => {
    const token = accessToken
    if (!token) return
    let cancelled = false

    async function bootstrap(token: string) {
      try {
        const [roleList, catalogRes, appsRes] = await Promise.all([
          rolesApi.list(token, { pageSize: 100 }),
          permissionsApi.catalog(token),
          remoteAppsApi.list(token, { pageSize: 100 }),
        ])
        if (cancelled) return
        setRoles(roleList.items)
        setCatalog(catalogRes)
        setRemoteApps(appsRes.items)

        if (appsRes.items.length > 0) {
          setExpandedApps({ [appsRes.items[0].key]: true, host: true })
        }

        if (id) {
          const [user, userOverrides] = await Promise.all([
            usersApi.get(token, id),
            usersApi.getOverrides(token, id).catch(() => []),
          ])
          if (cancelled) return
          setName(user.name)
          setEmail(user.email)
          setPhone(user.phoneNumber ?? '')
          setRoleId(user.roleId ?? '')
          setIsActive(user.isActive)

          let rolePermSet = new Set<string>()
          if (user.roleId) {
            rolePermSet = await fetchRolePermSet(user.roleId, catalogRes, appsRes.items)
          }
          setRolePermissions(rolePermSet)

          // Effective checked = (Role permissions + Grants) - Revokes
          const effective = new Set(rolePermSet)
          userOverrides.forEach((o) => {
            const id = `${o.featureKey}:${o.capability}`
            if (o.effect === 'Grant') {
              effective.add(id)
            } else if (o.effect === 'Revoke') {
              effective.delete(id)
            }
          })
          setSelectedPermKeys(effective)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load user.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrap(token)
    return () => {
      cancelled = true
    }
  }, [accessToken, id])

  const selectedRole = useMemo(() => roles.find((r) => r.id === roleId), [roles, roleId])

  const handleRoleChange = async (newRoleId: string) => {
    setRoleId(newRoleId)
    if (!accessToken || !newRoleId) {
      setRolePermissions(new Set())
      setSelectedPermKeys(new Set())
      return
    }

    try {
      const rolePermSet = await fetchRolePermSet(newRoleId, catalog, remoteApps)
      setRolePermissions(rolePermSet)
      // When role changes, pre-check all permissions of that role by default!
      setSelectedPermKeys(new Set(rolePermSet))
    } catch (err) {
      console.warn('Failed to load role permissions on role change', err)
    }
  }

  const toggleAppAccordion = (key: string) => {
    setExpandedApps((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const isOverrideGranted = (featureKey: string, capability: string) => {
    return selectedPermKeys.has(`${featureKey}:${capability}`)
  }

  const toggleOverride = (featureKey: string, capability: string) => {
    const id = `${featureKey}:${capability}`
    setSelectedPermKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const isAllGloballySelected = useMemo(() => {
    return (
      allGlobalPermissions.length > 0 &&
      allGlobalPermissions.every((p) => selectedPermKeys.has(`${p.featureKey}:${p.capability}`))
    )
  }, [allGlobalPermissions, selectedPermKeys])

  const handleToggleGlobalAll = (checked: boolean) => {
    if (checked) {
      setSelectedPermKeys(new Set(allGlobalPermissions.map((p) => `${p.featureKey}:${p.capability}`)))
    } else {
      setSelectedPermKeys(new Set())
    }
  }

  const isAppFullySelected = (items: { featureKey: string; capability: string }[]) => {
    return items.length > 0 && items.every((p) => selectedPermKeys.has(`${p.featureKey}:${p.capability}`))
  }

  const toggleAppAll = (items: { featureKey: string; capability: string }[], checked: boolean) => {
    setSelectedPermKeys((prev) => {
      const next = new Set(prev)
      items.forEach((it) => {
        const id = `${it.featureKey}:${it.capability}`
        if (checked) next.add(id)
        else next.delete(id)
      })
      return next
    })
  }

  // Compute exact diff overrides (Grants and Revokes) relative to assigned role
  const computedOverrides = useMemo(() => {
    const list: PermissionOverrideDto[] = []
    allGlobalPermissions.forEach((p) => {
      const id = `${p.featureKey}:${p.capability}`
      const isSelected = selectedPermKeys.has(id)
      const isRoleGranted = rolePermissions.has(id)

      if (isSelected && !isRoleGranted) {
        list.push({ featureKey: p.featureKey, capability: p.capability, effect: 'Grant' })
      } else if (!isSelected && isRoleGranted) {
        list.push({ featureKey: p.featureKey, capability: p.capability, effect: 'Revoke' })
      }
    })
    return list
  }, [allGlobalPermissions, selectedPermKeys, rolePermissions])

  const grantsList = useMemo(() => computedOverrides.filter((o) => o.effect === 'Grant'), [computedOverrides])
  const revokesList = useMemo(() => computedOverrides.filter((o) => o.effect === 'Revoke'), [computedOverrides])

  async function handleFinalSubmit() {
    setError(null)
    setSaving(true)
    try {
      const token = await ensureFreshAccessToken()

      if (isEdit && id) {
        await usersApi.update(token, id, {
          name,
          email,
          phoneNumber: phone || null,
          roleId: roleId || null,
          isActive,
        })
        await usersApi.replaceOverrides(token, id, computedOverrides)
        void refreshSession()
        navigate('/settings/users')
      } else {
        const result = await usersApi.create(token, {
          name,
          email,
          phoneNumber: phone || null,
          roleId: roleId || null,
          isActive,
        })
        if (computedOverrides.length > 0) {
          await usersApi.replaceOverrides(token, result.user.id, computedOverrides)
        }
        setTempPassword(result.temporaryPassword)
        void refreshSession()
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save user.')
    } finally {
      setSaving(false)
    }
  }

  const handleNextFromBasic = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Please provide a valid name and email address.')
      return
    }
    setError(null)
    setCurrentStep('permissions')
  }

  if (loading) {
    return <SkeletonText lines={6} />
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <div className={styles.headerIconBox}>
            <Icon.Users width={24} height={24} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>{isEdit ? 'Edit User Account' : 'Create New User'}</h1>
            <p className={styles.pageSubtitle}>
              {currentStep === 'basic' && 'Step 1 of 3: Account information & assigned role'}
              {currentStep === 'permissions' && 'Step 2 of 3: Granular application & module access'}
              {currentStep === 'review' && 'Step 3 of 3: Final confirmation & save'}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => navigate('/settings/users')}>
          Cancel
        </Button>
      </div>

      {/* Modern Stepper Progress Header */}
      {!tempPassword && (
        <div className={styles.stepperContainer}>
          <button
            type="button"
            className={`${styles.stepTab} ${currentStep === 'basic' ? styles.stepTabActive : ''} ${name && email ? styles.stepTabDone : ''}`}
            onClick={() => setCurrentStep('basic')}
          >
            <div className={styles.stepBadge}>
              {name && email && currentStep !== 'basic' ? (
                <Icon.CheckCircle width={16} height={16} className={styles.stepCheckIcon} />
              ) : (
                <span>1</span>
              )}
            </div>
            <div className={styles.stepTabText}>
              <span className={styles.stepTitle}>Basic Details</span>
              <span className={styles.stepDesc}>Name, Email & Role</span>
            </div>
          </button>

          <div className={styles.stepperLine} />

          <button
            type="button"
            className={`${styles.stepTab} ${currentStep === 'permissions' ? styles.stepTabActive : ''}`}
            onClick={() => {
              if (name && email) setCurrentStep('permissions')
            }}
          >
            <div className={styles.stepBadge}>
              <span>2</span>
            </div>
            <div className={styles.stepTabText}>
              <span className={styles.stepTitle}>Extra Permissions</span>
              <span className={styles.stepDesc}>{selectedPermKeys.size} Permissions Active</span>
            </div>
          </button>

          <div className={styles.stepperLine} />

          <button
            type="button"
            className={`${styles.stepTab} ${currentStep === 'review' ? styles.stepTabActive : ''}`}
            onClick={() => {
              if (name && email) setCurrentStep('review')
            }}
          >
            <div className={styles.stepBadge}>
              <span>3</span>
            </div>
            <div className={styles.stepTabText}>
              <span className={styles.stepTitle}>Review & Save</span>
              <span className={styles.stepDesc}>Final Confirmation</span>
            </div>
          </button>
        </div>
      )}

      {error && <div className={styles.errorBanner}>{error}</div>}

      {tempPassword ? (
        <div className={styles.successArea}>
          <div className={styles.successCard}>
            <div className={styles.successIconWrap}>
              <Icon.CheckCircle width={48} height={48} />
            </div>
            <h2>User Account Created!</h2>
            <p>
              Share this temporary password securely with <strong>{name}</strong> ({email}). It will not be shown again:
            </p>
            <div className={styles.tempPasswordBox}>
              <span className={styles.tempPassLabel}>Temporary Password</span>
              <code>{tempPassword}</code>
            </div>
            <Button variant="primary" onClick={() => navigate('/settings/users')}>
              Return to Users List
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.formBody}>
          {/* STEP 1: Basic Info */}
          {currentStep === 'basic' && (
            <form id="page-basic-form" onSubmit={handleNextFromBasic} className={styles.formSection}>
              <div className={styles.formCard}>
                <h3 className={styles.formCardTitle}>Personal Information</h3>
                <div className={styles.fieldsGrid}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      Full Name <span className={styles.req}>*</span>
                    </label>
                    <div className={styles.inputIconWrap}>
                      <input
                        type="text"
                        required
                        className={styles.inputWithIcon}
                        placeholder="e.g. Uday Chauhan"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <Icon.Users width={18} height={18} className={styles.fieldLeftIcon} />
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      Email Address <span className={styles.req}>*</span>
                    </label>
                    <div className={styles.inputIconWrap}>
                      <input
                        type="email"
                        required
                        className={styles.inputWithIcon}
                        placeholder="e.g. uday@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <Icon.FileText width={18} height={18} className={styles.fieldLeftIcon} />
                    </div>
                  </div>

                  <div className={styles.inputGroupFull}>
                    <label className={styles.label}>Phone Number (Optional)</label>
                    <div className={styles.inputIconWrap}>
                      <input
                        type="tel"
                        className={styles.inputWithIcon}
                        placeholder="e.g. +1 555 0100"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <Icon.Activity width={18} height={18} className={styles.fieldLeftIcon} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formCard}>
                <h3 className={styles.formCardTitle}>Role & Account Status</h3>
                <div className={styles.fieldsGrid}>
                  <div className={styles.inputGroupFull}>
                    <label className={styles.label}>Assigned System Role</label>
                    <select
                      className={styles.select}
                      value={roleId}
                      onChange={(e) => void handleRoleChange(e.target.value)}
                    >
                      <option value="">-- No Role (Inherit Standard Access) --</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name} {role.isAdministrator ? '(Full Administrator)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedRole?.isAdministrator && (
                      <div className={styles.adminRoleNotice}>
                        <Icon.ShieldCheck width={18} height={18} />
                        <span>This user will have full unrestricted Administrator capabilities across all applications.</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.statusToggleCard}>
                    <div className={styles.statusToggleInfo}>
                      <div className={styles.statusToggleHeader}>
                        <span className={isActive ? styles.badgeDotGreen : styles.badgeDotGray} />
                        <span className={styles.statusToggleTitle}>
                          {isActive ? 'Account is Active' : 'Account is Suspended'}
                        </span>
                      </div>
                      <span className={styles.statusToggleDesc}>
                        {isActive
                          ? 'User is permitted to sign in and interact with all granted applications.'
                          : 'User login is blocked until account is reactivated.'}
                      </span>
                    </div>
                    <Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* STEP 2: Extra Permissions */}
          {currentStep === 'permissions' && (
            <div className={styles.formSection}>
              {/* Global Select All Toolbar */}
              <div className={styles.globalSelectToolbar}>
                <label className={styles.globalCheckboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isAllGloballySelected}
                    onChange={(e) => handleToggleGlobalAll(e.target.checked)}
                  />
                  <div className={styles.globalTextGroup}>
                    <span className={styles.globalSelectText}>Select All Permissions Across Platform</span>
                    <span className={styles.globalSelectSub}>Grant all capabilities across host features and remote applications</span>
                  </div>
                </label>
                <div className={styles.toolbarRightMeta}>
                  <span className={styles.selectedCountBadge}>
                    {selectedPermKeys.size} of {allGlobalPermissions.length} selected
                  </span>
                </div>
              </div>

              {/* Filter Search Input */}
              <div className={styles.filterWrap}>
                <input
                  type="text"
                  className={styles.filterInput}
                  placeholder="Filter permissions and applications..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                />
                <Icon.Search width={16} height={16} className={styles.filterIcon} />
              </div>

              <div className={styles.accordionContainer}>
                {/* Host features */}
                {(!permSearch || 'host core platform'.includes(permSearch.toLowerCase())) && (
                  <div className={styles.appAccordion}>
                    <div className={styles.appAccordionHeader} onClick={() => toggleAppAccordion('host')}>
                      <div className={styles.appTitle}>
                        <div className={`${styles.appIcon} ${styles.iconHost}`}>
                          <Icon.ShieldCheck width={20} height={20} />
                        </div>
                        <div>
                          <span className={styles.accordionAppName}>Host Core Features</span>
                          <span className={styles.accordionAppKey}>Platform Administrative Modules</span>
                        </div>
                      </div>
                      <div className={styles.accordionHeaderRight}>
                        <label
                          className={styles.appSelectAllBtn}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isAppFullySelected(hostPermissions)}
                            onChange={(e) => toggleAppAll(hostPermissions, e.target.checked)}
                          />
                          <span>Select All</span>
                        </label>
                        {expandedApps['host'] ? <Icon.ChevronUp width={18} height={18} /> : <Icon.ChevronDown width={18} height={18} />}
                      </div>
                    </div>
                    {expandedApps['host'] && (
                      <div className={styles.appAccordionBody}>
                        <table className={styles.permTable}>
                          <thead>
                            <tr>
                              <th>FEATURE / MODULE</th>
                              <th>VIEW</th>
                              <th>CREATE</th>
                              <th>EDIT</th>
                              <th>DELETE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catalog
                              .filter((f) => f.source === 'Host')
                              .filter(
                                (f) =>
                                  !permSearch ||
                                  f.displayName.toLowerCase().includes(permSearch.toLowerCase()),
                              )
                              .map((f) => {
                                const hasView = f.capabilities.some((c) => c.key === 'View')
                                const hasCreate = f.capabilities.some((c) => c.key === 'Create' || c.key === 'Register')
                                const createCapKey = f.capabilities.find((c) => c.key === 'Create' || c.key === 'Register')?.key || 'Create'
                                const hasEdit = f.capabilities.some((c) => c.key === 'Edit')
                                const hasDelete = f.capabilities.some((c) => c.key === 'Delete' || c.key === 'Disable')
                                const deleteCapKey = f.capabilities.find((c) => c.key === 'Delete' || c.key === 'Disable')?.key || 'Delete'

                                return (
                                  <tr key={f.key}>
                                    <td>
                                      <span className={styles.featureName}>{f.displayName}</span>
                                    </td>
                                    <td>
                                      {hasView ? (
                                        <input
                                          type="checkbox"
                                          checked={isOverrideGranted(f.key, 'View')}
                                          onChange={() => toggleOverride(f.key, 'View')}
                                        />
                                      ) : (
                                        <span style={{ color: '#94a3b8' }}>—</span>
                                      )}
                                    </td>
                                    <td>
                                      {hasCreate ? (
                                        <input
                                          type="checkbox"
                                          checked={isOverrideGranted(f.key, createCapKey)}
                                          onChange={() => toggleOverride(f.key, createCapKey)}
                                        />
                                      ) : (
                                        <span style={{ color: '#94a3b8' }}>—</span>
                                      )}
                                    </td>
                                    <td>
                                      {hasEdit ? (
                                        <input
                                          type="checkbox"
                                          checked={isOverrideGranted(f.key, 'Edit')}
                                          onChange={() => toggleOverride(f.key, 'Edit')}
                                        />
                                      ) : (
                                        <span style={{ color: '#94a3b8' }}>—</span>
                                      )}
                                    </td>
                                    <td>
                                      {hasDelete ? (
                                        <input
                                          type="checkbox"
                                          checked={isOverrideGranted(f.key, deleteCapKey)}
                                          onChange={() => toggleOverride(f.key, deleteCapKey)}
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
                )}

                {/* Remote Apps */}
                {remoteApps
                  .filter((app) => app.status !== 'Disabled')
                  .filter(
                    (app) =>
                      !permSearch ||
                      app.displayName.toLowerCase().includes(permSearch.toLowerCase()) ||
                      app.key.toLowerCase().includes(permSearch.toLowerCase()),
                  )
                  .map((app) => {
                    const featureKey = `remote.${app.key}`
                    const isExpanded = Boolean(expandedApps[app.key])
                    const appPerms = getAppPermissions(app.key)
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
                      <div key={app.id} className={styles.appAccordion}>
                        <div className={styles.appAccordionHeader} onClick={() => toggleAppAccordion(app.key)}>
                          <div className={styles.appTitle}>
                            <div className={`${styles.appIcon} ${styles.iconRemote}`}>
                              <Icon.Users width={20} height={20} />
                            </div>
                            <div>
                              <span className={styles.accordionAppName}>{app.displayName}</span>
                              <span className={styles.accordionAppKey}>{app.key}</span>
                            </div>
                          </div>
                          <div className={styles.accordionHeaderRight}>
                            <label
                              className={styles.appSelectAllBtn}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isAppFullySelected(appPerms)}
                                onChange={(e) => toggleAppAll(appPerms, e.target.checked)}
                              />
                              <span>Select All</span>
                            </label>
                            <span className={styles.activeBadgeSmall}>
                              <span className={styles.badgeDotGreen} />
                              {app.status}
                            </span>
                            {isExpanded ? <Icon.ChevronUp width={18} height={18} /> : <Icon.ChevronDown width={18} height={18} />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className={styles.appAccordionBody}>
                            <table className={styles.permTable}>
                              <thead>
                                <tr>
                                  <th>SUB-MODULE / CAPABILITY</th>
                                  <th>CREATE</th>
                                  <th>VIEW</th>
                                  <th>EDIT</th>
                                  <th>DELETE</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>
                                    <span className={styles.featureName}>{app.displayName} (Base Access)</span>
                                  </td>
                                  <td>
                                    {hasBaseCreate ? (
                                      <input
                                        type="checkbox"
                                        checked={isOverrideGranted(featureKey, 'Create')}
                                        onChange={() => toggleOverride(featureKey, 'Create')}
                                      />
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                  </td>
                                  <td>
                                    {hasBaseView ? (
                                      <input
                                        type="checkbox"
                                        checked={isOverrideGranted(featureKey, 'View')}
                                        onChange={() => toggleOverride(featureKey, 'View')}
                                      />
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                  </td>
                                  <td>
                                    {hasBaseEdit ? (
                                      <input
                                        type="checkbox"
                                        checked={isOverrideGranted(featureKey, 'Edit')}
                                        onChange={() => toggleOverride(featureKey, 'Edit')}
                                      />
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                  </td>
                                  <td>
                                    {hasBaseDelete ? (
                                      <input
                                        type="checkbox"
                                        checked={isOverrideGranted(featureKey, 'Delete')}
                                        onChange={() => toggleOverride(featureKey, 'Delete')}
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
                                      <td>
                                        <span className={styles.featureName}>{sub}</span>
                                      </td>
                                      <td>
                                        {hasSubCreate ? (
                                          <input
                                            type="checkbox"
                                            checked={isOverrideGranted(featureKey, `${sub}:Create`)}
                                            onChange={() => toggleOverride(featureKey, `${sub}:Create`)}
                                          />
                                        ) : (
                                          <span style={{ color: '#94a3b8' }}>—</span>
                                        )}
                                      </td>
                                      <td>
                                        {hasSubView ? (
                                          <input
                                            type="checkbox"
                                            checked={isOverrideGranted(featureKey, `${sub}:View`)}
                                            onChange={() => toggleOverride(featureKey, `${sub}:View`)}
                                          />
                                        ) : (
                                          <span style={{ color: '#94a3b8' }}>—</span>
                                        )}
                                      </td>
                                      <td>
                                        {hasSubEdit ? (
                                          <input
                                            type="checkbox"
                                            checked={isOverrideGranted(featureKey, `${sub}:Edit`)}
                                            onChange={() => toggleOverride(featureKey, `${sub}:Edit`)}
                                          />
                                        ) : (
                                          <span style={{ color: '#94a3b8' }}>—</span>
                                        )}
                                      </td>
                                      <td>
                                        {hasSubDelete ? (
                                          <input
                                            type="checkbox"
                                            checked={isOverrideGranted(featureKey, `${sub}:Delete`)}
                                            onChange={() => toggleOverride(featureKey, `${sub}:Delete`)}
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

          {/* STEP 3: Review & Save */}
          {currentStep === 'review' && (
            <div className={styles.formSection}>
              <div className={styles.reviewCard}>
                <div className={styles.reviewProfileHeader}>
                  <div className={styles.reviewAvatar}>
                    {(name || email).charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.reviewProfileDetails}>
                    <h3 className={styles.reviewProfileName}>{name}</h3>
                    <span className={styles.reviewProfileEmail}>{email}</span>
                    <div className={styles.reviewPillsRow}>
                      <span className={styles.roleBadgePill}>
                        <Icon.ShieldCheck width={14} height={14} />
                        <span>{selectedRole ? selectedRole.name : 'No Role Assigned'}</span>
                      </span>
                      <span className={isActive ? styles.activeBadgeSmall : styles.inactiveBadgeSmall}>
                        <span className={isActive ? styles.badgeDotGreen : styles.badgeDotGray} />
                        <span>{isActive ? 'Active User' : 'Inactive User'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.reviewMetaList}>
                  <div className={styles.reviewMetaItem}>
                    <span className={styles.reviewMetaLabel}>Phone Number</span>
                    <span className={styles.reviewMetaVal}>{phone || 'None provided'}</span>
                  </div>
                  <div className={styles.reviewMetaItem}>
                    <span className={styles.reviewMetaLabel}>Administrator Access</span>
                    <span className={styles.reviewMetaVal}>
                      {selectedRole?.isAdministrator ? 'Yes (Full Admin)' : 'Standard User Access'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.reviewCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <h3 className={styles.reviewCardTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    Effective Capabilities ({selectedPermKeys.size})
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {grantsList.length > 0 && <strong style={{ color: '#059669', marginRight: '8px' }}>+{grantsList.length} Granted</strong>}
                    {revokesList.length > 0 && <strong style={{ color: '#dc2626' }}>-{revokesList.length} Revoked</strong>}
                  </span>
                </div>

                {computedOverrides.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    {grantsList.length > 0 && (
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#065f46', display: 'block', marginBottom: '8px' }}>
                          Extra Granted Overrides ({grantsList.length})
                        </span>
                        <div className={styles.overridesTags}>
                          {grantsList.map((o, idx) => (
                            <span key={idx} className={styles.tagGrant}>
                              <span className={styles.overrideKey}>{o.featureKey}</span>
                              <span className={styles.overrideDivider}>•</span>
                              <strong>+{o.capability}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {revokesList.length > 0 && (
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: '8px' }}>
                          Revoked Role Permissions ({revokesList.length})
                        </span>
                        <div className={styles.overridesTags}>
                          {revokesList.map((o, idx) => (
                            <span key={idx} className={styles.tagRevoke}>
                              <span className={styles.overrideKey}>{o.featureKey}</span>
                              <span className={styles.overrideDivider}>•</span>
                              <strong>-{o.capability}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.noOverridesCard} style={{ marginTop: '12px' }}>
                    <Icon.Info width={20} height={20} className={styles.noOverridesIcon} />
                    <p className={styles.noOverridesText}>
                      No custom overrides added. The user will inherit all {rolePermissions.size} capabilities configured under the <strong>{selectedRole ? selectedRole.name : 'assigned role'}</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className={styles.actions}>
            {currentStep === 'basic' && (
              <Button type="submit" form="page-basic-form" variant="primary">
                <span>Next: Extra Permissions</span>
                <Icon.ChevronRight width={16} height={16} />
              </Button>
            )}

            {currentStep === 'permissions' && (
              <>
                <Button variant="secondary" onClick={() => setCurrentStep('basic')}>
                  <Icon.ChevronLeft width={16} height={16} />
                  <span>Back to Details</span>
                </Button>
                <Button variant="primary" onClick={() => setCurrentStep('review')}>
                  <span>Next: Review &amp; Confirm</span>
                  <Icon.ChevronRight width={16} height={16} />
                </Button>
              </>
            )}

            {currentStep === 'review' && (
              <>
                <Button variant="secondary" onClick={() => setCurrentStep('permissions')}>
                  <Icon.ChevronLeft width={16} height={16} />
                  <span>Back to Permissions</span>
                </Button>
                <Button variant="primary" loading={saving} onClick={() => void handleFinalSubmit()}>
                  <Icon.CheckCircle width={16} height={16} />
                  <span>{isEdit ? 'Save Changes' : 'Create User Account'}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
