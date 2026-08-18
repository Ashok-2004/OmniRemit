import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import {
  usersApi,
  type CreateUserResponse,
  type PermissionOverrideDto,
} from '../../features/settings-users/api/usersApi'
import { rolesApi, type RoleListItemDto } from '../../features/settings-roles/api/rolesApi'
import { remoteAppsApi, type RemoteAppDto } from '../../features/settings-applications/api/remoteAppsApi'
import { permissionsApi, type PermissionFeatureDto } from '../../shared/api/permissionsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { Switch } from '../../shared/components/Switch/Switch'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import { resolveIcon } from '../../shared/components/Icon/resolveIcon'
import { toast } from '../../shared/stores/toastStore'
import {
  LIMITS,
  required,
  maxLength,
  email as emailRule,
  phone as phoneRule,
  firstError,
  isValid,
  type FieldErrors,
} from '../../shared/validation/rules'
import {
  groupsFromCatalog,
  columnsForRows,
  allGrantablePairs,
  pairId,
} from '../../shared/permissions/catalog'
import styles from './UserFormLayer.module.css'

interface UserFormLayerProps {
  userId?: string
}

type Step = 'basic' | 'permissions' | 'review'

export function UserFormLayer({ userId }: UserFormLayerProps) {
  const isEdit = Boolean(userId)
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const refreshSession = useAuthStore((s) => s.refreshSession)
  const popLayer = useSettingsDrawerStore((s) => s.popLayer)
  const notifyMutation = useSettingsDrawerStore((s) => s.notifyMutation)

  const [currentStep, setCurrentStep] = useState<Step>('basic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdResult, setCreatedResult] = useState<CreateUserResponse | null>(null)

  // Step 1: Basic Fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [roleId, setRoleId] = useState<string>('')
  const [isActive, setIsActive] = useState(true)

  // Step 2: Permissions state
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set())
  const [selectedPermKeys, setSelectedPermKeys] = useState<Set<string>>(new Set())
  const [catalog, setCatalog] = useState<PermissionFeatureDto[]>([])
  const [remoteApps, setRemoteApps] = useState<RemoteAppDto[]>([])
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({})
  const [permSearch, setPermSearch] = useState('')

  // Permissions calculation for Global and App-wise Select All directly from catalog
  /*
   * Grid shape from the catalog, exactly as in the role editor — see shared/permissions/catalog.ts for
   * why parent keys must never be granted directly.
   */
  const hostGroups = useMemo(() => groupsFromCatalog(catalog, 'Host'), [catalog])
  const hostColumns = useMemo(() => columnsForRows(hostGroups.flatMap((g) => g.rows)), [hostGroups])

  const appGroups = useMemo(
    () =>
      groupsFromCatalog(catalog, 'RemoteApp').map((group) => ({
        ...group,
        app: remoteApps.find((a) => `remote.${a.key}` === group.feature.key),
      })),
    [catalog, remoteApps],
  )

  const hostPermissions = useMemo(
    () =>
      hostGroups.flatMap((g) =>
        g.rows.flatMap((row) => row.capabilities.map((c) => ({ featureKey: row.key, capability: c.key }))),
      ),
    [hostGroups],
  )

  /**
   * Every grantable pair for one application, sub-modules included.
   *
   * Keyed by FEATURE key now, not app key. It previously rebuilt `remote.${appKey}` and read only the
   * parent's own capabilities — falling back to the registry's flat capability list when the parent
   * declared none. That fallback is what manufactured `remote.employee:View`.
   */
  const getAppPermissions = (featureKey: string) => {
    const group = appGroups.find((g) => g.feature.key === featureKey)
    if (!group) return []
    return group.rows.flatMap((row) =>
      row.capabilities.map((c) => ({ featureKey: row.key, capability: c.key })),
    )
  }

  /**
   * The universe this editor diffs against to derive Grant/Revoke overrides.
   *
   * MUST include sub-modules. `replaceOverrides` reconciles against exactly this list, so a pair that
   * never appears here is dropped by any unrelated edit — changing a user's phone number silently
   * removed their department permissions. The second pass over the registry's flat capability list is
   * gone: the catalog is the single authority, and reading the registry again risked disagreeing
   * with it.
   */
  const allGlobalPermissions = useMemo(() => allGrantablePairs(catalog), [catalog])

  /**
   * The set of permissions a role confers, as `featureKey:capability` ids.
   *
   * For an administrator role this is "everything in the catalog", enumerated the same recursive way —
   * the old version walked only top-level capabilities, so every sub-module looked UNGRANTED for an
   * administrator and a later save wrote a pile of spurious Revoke overrides against that account.
   */
  const fetchRolePermSet = async (
    targetRoleId: string,
    catalogData: PermissionFeatureDto[],
  ): Promise<Set<string>> => {
    if (!accessToken || !targetRoleId) return new Set()
    try {
      const roleDetail = await rolesApi.get(accessToken, targetRoleId)
      if (roleDetail.isAdministrator) {
        return new Set(allGrantablePairs(catalogData).map((p) => pairId(p.featureKey, p.capability)))
      }
      return new Set((roleDetail.permissions ?? []).map((p) => pairId(p.featureKey, p.capability)))
    } catch (err) {
      console.warn('Could not fetch role permissions', err)
      return new Set()
    }
  }

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function loadData() {
      try {
        const [rolesRes, catalogRes, appsRes] = await Promise.all([
          rolesApi.list(accessToken!, { pageSize: 100 }),
          permissionsApi.catalog(accessToken!),
          remoteAppsApi.list(accessToken!, { pageSize: 100 }),
        ])

        if (cancelled) return
        setRoles(rolesRes.items)
        setCatalog(catalogRes)
        setRemoteApps(appsRes.items)

        // Expand first remote app by default
        if (appsRes.items.length > 0) {
          setExpandedApps({ [`remote.${appsRes.items[0].key}`]: true, host: true })
        }

        if (userId) {
          const [userRes, overridesRes] = await Promise.all([
            usersApi.get(accessToken!, userId),
            usersApi.getOverrides(accessToken!, userId).catch(() => []),
          ])

          if (cancelled) return
          setName(userRes.name)
          setEmail(userRes.email)
          setPhoneNumber(userRes.phoneNumber ?? '')
          setRoleId(userRes.roleId ?? '')
          setIsActive(userRes.isActive)

          let rolePermSet = new Set<string>()
          if (userRes.roleId) {
            rolePermSet = await fetchRolePermSet(userRes.roleId, catalogRes)
          }
          setRolePermissions(rolePermSet)

          // Effective checked = (Role permissions + Grants) - Revokes
          const effective = new Set(rolePermSet)
          overridesRes.forEach((o) => {
            const id = `${o.featureKey}:${o.capability}`
            if (o.effect === 'Grant') {
              effective.add(id)
            } else if (o.effect === 'Revoke') {
              effective.delete(id)
            }
          })
          setSelectedPermKeys(effective)
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load user data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [accessToken, userId])

  const selectedRole = useMemo(() => {
    return roles.find((r) => r.id === roleId)
  }, [roles, roleId])

  // When changing role, pre-populate with the newly selected role's permissions
  const handleRoleChange = async (newRoleId: string) => {
    setRoleId(newRoleId)
    if (!accessToken || !newRoleId) {
      setRolePermissions(new Set())
      setSelectedPermKeys(new Set())
      return
    }

    try {
      const rolePermSet = await fetchRolePermSet(newRoleId, catalog)
      setRolePermissions(rolePermSet)
      // When role changes, pre-check all permissions of that role by default!
      setSelectedPermKeys(new Set(rolePermSet))
    } catch (err) {
      console.warn('Failed to load role permissions on role change', err)
    }
  }

  const toggleAppAccordion = (key: string) => {
    setExpandedApps((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
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

  /**
   * Per-field validation mirroring the server's annotations on CreateUserRequest.
   *
   * Replaces a single check that only asked whether name and email were non-empty and reported one
   * combined sentence above the form. The deleted routed form had no validation at all, which is why
   * it accepted "989898989sssss" as a phone number and "ashok246@gmail.comsssssssss" as an email.
   *
   * The server validates independently; these exist so a problem is attached to the field that caused
   * it while the cursor is still in it.
   */
  const fieldErrors: FieldErrors<'name' | 'email' | 'phoneNumber'> = {
    name: firstError(required(name, 'Name'), maxLength(name, LIMITS.userName, 'Name')),
    email: firstError(required(email, 'Email'), emailRule(email), maxLength(email, LIMITS.email, 'Email')),
    phoneNumber: firstError(phoneRule(phoneNumber), maxLength(phoneNumber, LIMITS.phone, 'Phone number')),
  }

  // Shown once a field is visited or a submit attempted, so the form does not greet the user in red.
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const showError = (field: keyof typeof fieldErrors) =>
    touched[field] || submitAttempted ? fieldErrors[field] : undefined

  const handleNextFromBasic = (e: FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!isValid(fieldErrors)) {
      setError(null)
      return
    }
    setError(null)
    setCurrentStep('permissions')
  }

  const handleSubmit = async () => {
    setError(null)
    setSaving(true)

    try {
      const token = await ensureFreshAccessToken()
      if (isEdit && userId) {
        await usersApi.update(token, userId, {
          name,
          email,
          phoneNumber: phoneNumber || null,
          roleId: roleId || null,
          // The toggle's value now actually reaches the server; it was previously dropped here.
          isActive,
        })
        await usersApi.replaceOverrides(token, userId, computedOverrides)
        // The acting admin may have just changed their own role or permissions, and the list behind
        // the drawer is now stale — without these the drawer closed onto old rows and only a full page
        // reload would show the change.
        void refreshSession()
        notifyMutation()
        toast.success(`User '${name}' updated successfully.`)
        useSettingsDrawerStore.getState().resetToRoot('users')
      } else {
        const res = await usersApi.create(token, {
          name,
          email,
          phoneNumber: phoneNumber || null,
          roleId: roleId || null,
          isActive,
        })

        if (computedOverrides.length > 0) {
          await usersApi.replaceOverrides(token, res.user.id, computedOverrides)
        }

        notifyMutation()
        toast.success(`User '${res.user.name}' created successfully.`)
        setCreatedResult(res)
      }
    } catch (err: any) {
      setError(err?.message || 'Could not save user.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.layer}>
        {/* Skeleton Header — mirrors real gradient header */}
        <div className={styles.header} style={{ pointerEvents: 'none' }}>
          <div className={styles.headerTitleWrap}>
            <div className={styles.headerIconBox} style={{ opacity: 0.55 }}>
              <SkeletonBlock width={22} height={22} radius="6px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock width={160} height={16} radius="5px" />
              <SkeletonBlock width={230} height={12} radius="4px" />
            </div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Step badges skeleton */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 24px 0', alignItems: 'center' }}>
          {[120, 140, 100].map((w, i) => (
            <SkeletonBlock key={i} width={w} height={32} radius="9px" />
          ))}
        </div>

        {/* Form card skeleton */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Card 1 — Basic details */}
          <div style={{ background: '#fff', border: '1px solid #eaecf0', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SkeletonBlock width={130} height={13} radius="4px" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Name + Email row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <SkeletonBlock width="40%" height={11} radius="3px" />
                  <SkeletonBlock width="100%" height={38} radius="9px" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <SkeletonBlock width="40%" height={11} radius="3px" />
                  <SkeletonBlock width="100%" height={38} radius="9px" />
                </div>
              </div>
              {/* Phone + Role row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <SkeletonBlock width="40%" height={11} radius="3px" />
                  <SkeletonBlock width="100%" height={38} radius="9px" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <SkeletonBlock width="35%" height={11} radius="3px" />
                  <SkeletonBlock width="100%" height={38} radius="9px" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 — Account status */}
          <div style={{ background: '#fff', border: '1px solid #eaecf0', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <SkeletonBlock width={110} height={13} radius="4px" />
              <SkeletonBlock width={200} height={11} radius="3px" />
            </div>
            <SkeletonBlock width={44} height={24} radius="999px" />
          </div>
        </div>

        {/* Bottom bar skeleton */}
        <div className={styles.bottomBar} style={{ pointerEvents: 'none' }}>
          <SkeletonBlock width={90} height={36} radius="9px" />
          <SkeletonBlock width={100} height={36} radius="9px" />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.layer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <div className={styles.headerIconBox}>
            <Icon.Users width={20} height={20} />
          </div>
          <div>
            <h2 className={styles.title}>{isEdit ? 'Edit User Account' : 'Create New User'}</h2>
            <p className={styles.subtitle}>
              {currentStep === 'basic' && 'Step 1 of 3: Account information & assigned role'}
              {currentStep === 'permissions' && 'Step 2 of 3: Granular application & module access'}
              {currentStep === 'review' && 'Step 3 of 3: Final confirmation & save'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={popLayer}
          aria-label="Close"
        >
          <Icon.X width={20} height={20} />
        </button>
      </div>

      {/* Modern Stepper Progress Navigation */}
      {!createdResult && (
        <div className={styles.stepperContainer}>
          <button
            type="button"
            className={`${styles.stepTab} ${currentStep === 'basic' ? styles.stepTabActive : ''} ${name && email ? styles.stepTabDone : ''}`}
            onClick={() => setCurrentStep('basic')}
          >
            <div className={styles.stepBadge}>
              {name && email && currentStep !== 'basic' ? (
                <Icon.CheckCircle width={14} height={14} className={styles.stepCheckIcon} />
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

      {error && <div className={styles.errorAlert}>{error}</div>}

      {createdResult ? (
        <div className={styles.successArea}>
          <div className={styles.successCard}>
            <div className={styles.successIconWrap}>
              <Icon.CheckCircle width={42} height={42} />
            </div>
            <h3 className={styles.successTitle}>User Account Created!</h3>
            <p className={styles.successText}>
              Share this temporary password securely with <strong>{createdResult.user.name}</strong> ({createdResult.user.email}). It will not be visible again once closed.
            </p>
            <div className={styles.tempPassBox}>
              <span className={styles.tempPassLabel}>Temporary Password</span>
              <code>{createdResult.temporaryPassword}</code>
            </div>
            <button
              type="button"
              className={styles.doneBtn}
              onClick={() => useSettingsDrawerStore.getState().resetToRoot('users')}
            >
              Done & Return to Users List
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.formContainer}>
          <div className={styles.contentArea}>
            {/* STEP 1: Basic Info */}
            {currentStep === 'basic' && (
              <form id="basic-form" onSubmit={handleNextFromBasic} className={styles.formSection}>
                <div className={styles.formCard}>
                  <h4 className={styles.formCardTitle}>Personal Information</h4>
                  <div className={styles.fieldsGrid}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>
                        Full Name <span className={styles.req}>*</span>
                      </label>
                      <div className={styles.inputIconWrap}>
                        <input
                          type="text"
                          className={`${styles.inputWithIcon} ${showError('name') ? styles.inputInvalid : ''}`}
                          placeholder="e.g. Uday Chauhan"
                          value={name}
                          maxLength={LIMITS.userName}
                          aria-invalid={Boolean(showError('name'))}
                          aria-describedby={showError('name') ? 'user-name-error' : undefined}
                          onChange={(e) => setName(e.target.value)}
                          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                        />
                        <Icon.Users width={16} height={16} className={styles.fieldLeftIcon} />
                      </div>
                      {showError('name') && (
                        <span id="user-name-error" className={styles.fieldError} role="alert">
                          {showError('name')}
                        </span>
                      )}
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>
                        Email Address <span className={styles.req}>*</span>
                      </label>
                      <div className={styles.inputIconWrap}>
                        <input
                          type="email"
                          className={`${styles.inputWithIcon} ${showError('email') ? styles.inputInvalid : ''}`}
                          placeholder="e.g. uday@example.com"
                          value={email}
                          maxLength={LIMITS.email}
                          aria-invalid={Boolean(showError('email'))}
                          aria-describedby={showError('email') ? 'user-email-error' : undefined}
                          onChange={(e) => setEmail(e.target.value)}
                          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        />
                        <Icon.FileText width={16} height={16} className={styles.fieldLeftIcon} />
                      </div>
                      {showError('email') && (
                        <span id="user-email-error" className={styles.fieldError} role="alert">
                          {showError('email')}
                        </span>
                      )}
                    </div>

                    <div className={styles.inputGroupFull}>
                      <label className={styles.label}>
                        Phone Number <span className={styles.req}>*</span>
                      </label>
                      <div className={styles.inputIconWrap}>
                        <input
                          type="tel"
                          className={`${styles.inputWithIcon} ${showError('phoneNumber') ? styles.inputInvalid : ''}`}
                          placeholder="e.g. +91 98765 43210"
                          value={phoneNumber}
                          maxLength={LIMITS.phone}
                          aria-invalid={Boolean(showError('phoneNumber'))}
                          aria-describedby={showError('phoneNumber') ? 'user-phone-error' : undefined}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          onBlur={() => setTouched((t) => ({ ...t, phoneNumber: true }))}
                        />
                        <Icon.Activity width={16} height={16} className={styles.fieldLeftIcon} />
                      </div>
                      {showError('phoneNumber') && (
                        <span id="user-phone-error" className={styles.fieldError} role="alert">
                          {showError('phoneNumber')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.formCard}>
                  <h4 className={styles.formCardTitle}>Role & Account Status</h4>
                  <div className={styles.fieldsGrid}>
                    <div className={styles.inputGroupFull}>
                      <label className={styles.label}>Assigned System Role</label>
                      <select
                        className={styles.select}
                        value={roleId}
                        onChange={(e) => void handleRoleChange(e.target.value)}
                      >
                        <option value="">-- No Role (Inherit Standard Access) --</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} {r.isAdministrator ? '(Full Administrator)' : ''}
                          </option>
                        ))}
                      </select>
                      {selectedRole?.isAdministrator && (
                        <div className={styles.adminRoleNotice}>
                          <Icon.ShieldCheck width={16} height={16} />
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
                      <span className={styles.globalSelectText}>
                        Select All Permissions Across Platform
                      </span>
                      <span className={styles.globalSelectSub}>
                        Grant all capabilities across host features and remote applications
                      </span>
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
                  <Icon.Search width={15} height={15} className={styles.filterIcon} />
                </div>

                <div className={styles.accordionList}>
                  {/* Host Core Permissions Accordion */}
                  {(!permSearch || 'host core platform'.includes(permSearch.toLowerCase())) && (
                    <div className={styles.accordionCard}>
                      <div
                        className={styles.accordionHeader}
                        onClick={() => toggleAppAccordion('host')}
                      >
                        <div className={styles.appTitleGroup}>
                          <div className={`${styles.appIconSmall} ${styles.iconHost}`}>
                            <Icon.ShieldCheck width={18} height={18} />
                          </div>
                          <div>
                            <span className={styles.accordionAppName}>Host Core Features</span>
                            <span className={styles.accordionAppKey}>Platform Administrative Modules</span>
                          </div>
                        </div>
                        <div className={styles.accordionRightMeta}>
                          {/* App-wise Select All */}
                          <label
                            className={styles.appSelectAllLabel}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={isAppFullySelected(hostPermissions)}
                              onChange={(e) => toggleAppAll(hostPermissions, e.target.checked)}
                            />
                            <span>Select All</span>
                          </label>
                          {expandedApps['host'] ? (
                            <Icon.ChevronUp width={18} height={18} className={styles.chevron} />
                          ) : (
                            <Icon.ChevronDown width={18} height={18} className={styles.chevron} />
                          )}
                        </div>
                      </div>

                      {expandedApps['host'] && (
                        <div className={styles.accordionBody}>
                          <table className={styles.matrixTable}>
                            <thead>
                              <tr>
                                <th>FEATURE / MODULE</th>
                                {hostColumns.map((col) => (
                                  <th key={col.key} title={col.displayName}>
                                    {col.displayName.toUpperCase()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {hostGroups
                                .flatMap((group) => group.rows)
                                .filter(
                                  (row) =>
                                    !permSearch ||
                                    row.label.toLowerCase().includes(permSearch.toLowerCase()) ||
                                    row.key.toLowerCase().includes(permSearch.toLowerCase()),
                                )
                                .map((row) => (
                                  <tr key={row.key}>
                                    <td>
                                      <span className={styles.featureName}>{row.label}</span>
                                    </td>
                                    {hostColumns.map((col) => {
                                      const declaredCap = row.capabilities.find(
                                        (c) => c.key.toLowerCase() === col.key.toLowerCase(),
                                      )
                                      return (
                                        <td key={col.key}>
                                          {declaredCap ? (
                                            <input
                                              type="checkbox"
                                              className={styles.checkbox}
                                              checked={isOverrideGranted(row.key, declaredCap.key)}
                                              aria-label={`${col.displayName} on ${row.label}`}
                                              onChange={() => toggleOverride(row.key, declaredCap.key)}
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
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Remote Apps Accordions — rows and columns come from the catalog */}
                  {appGroups
                    .filter(({ app }) => !app || app.status !== 'Disabled')
                    .filter(
                      ({ feature }) =>
                        !permSearch ||
                        feature.displayName.toLowerCase().includes(permSearch.toLowerCase()) ||
                        feature.key.toLowerCase().includes(permSearch.toLowerCase()),
                    )
                    .map(({ feature, rows, columns, app }) => {
                      const isExpanded = Boolean(expandedApps[feature.key])
                      const appPerms = getAppPermissions(feature.key)
                      const AppIcon = resolveIcon(app?.iconKey)

                      return (
                        <div key={feature.key} className={styles.accordionCard}>
                          <div
                            className={styles.accordionHeader}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => toggleAppAccordion(feature.key)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggleAppAccordion(feature.key)
                              }
                            }}
                          >
                            <div className={styles.appTitleGroup}>
                              <div className={`${styles.appIconSmall} ${styles.iconRemote}`}>
                                <AppIcon width={18} height={18} />
                              </div>
                              <div>
                                <span className={styles.accordionAppName}>{feature.displayName}</span>
                                <span className={styles.accordionAppKey}>{feature.key}</span>
                              </div>
                            </div>
                            <div className={styles.accordionRightMeta}>
                              <label
                                className={styles.appSelectAllLabel}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  className={styles.checkbox}
                                  checked={isAppFullySelected(appPerms)}
                                  onChange={(e) => toggleAppAll(appPerms, e.target.checked)}
                                />
                                <span>Select All</span>
                              </label>
                              {app && (
                                <span className={styles.activeBadgeSmall}>
                                  <span className={styles.badgeDotGreen} />
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
                              {columns.length === 0 ? (
                                <p className={styles.sectionHint}>
                                  This application hasn&rsquo;t declared any capabilities yet.
                                </p>
                              ) : (
                                <table className={styles.matrixTable}>
                                  <thead>
                                    <tr>
                                      <th>SUB-MODULE / CAPABILITY</th>
                                      {columns.map((col) => (
                                        <th key={col.key} title={col.displayName}>
                                          {col.displayName.toUpperCase()}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((row) => (
                                      <tr key={row.key}>
                                        <td>
                                          <span className={styles.featureName}>{row.label}</span>
                                        </td>
                                        {columns.map((col) => {
                                          const declaredCap = row.capabilities.find(
                                            (c) => c.key.toLowerCase() === col.key.toLowerCase(),
                                          )
                                          return (
                                            <td key={col.key}>
                                              {declaredCap ? (
                                                <input
                                                  type="checkbox"
                                                  className={styles.checkbox}
                                                  checked={isOverrideGranted(row.key, declaredCap.key)}
                                                  aria-label={`${col.displayName} on ${row.label}`}
                                                  onChange={() => toggleOverride(row.key, declaredCap.key)}
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
                              )}
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
                      <h4 className={styles.reviewProfileName}>{name}</h4>
                      <span className={styles.reviewProfileEmail}>{email}</span>
                      <div className={styles.reviewPillsRow}>
                        <span className={styles.roleBadgePill}>
                          <Icon.ShieldCheck width={13} height={13} />
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
                      <span className={styles.reviewMetaVal}>{phoneNumber || 'None provided'}</span>
                    </div>
                    <div className={styles.reviewMetaItem}>
                      <span className={styles.reviewMetaLabel}>Administrator Privileges</span>
                      <span className={styles.reviewMetaVal}>
                        {selectedRole?.isAdministrator ? 'Yes (Full Platform Admin)' : 'Standard User'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.reviewCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <h4 className={styles.reviewCardTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                      Effective Capabilities ({selectedPermKeys.size})
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {grantsList.length > 0 && <strong style={{ color: '#059669', marginRight: '8px' }}>+{grantsList.length} Granted</strong>}
                      {revokesList.length > 0 && <strong style={{ color: '#dc2626' }}>-{revokesList.length} Revoked</strong>}
                    </span>
                  </div>

                  {computedOverrides.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                      {grantsList.length > 0 && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#065f46', display: 'block', marginBottom: '6px' }}>
                            Extra Granted Overrides ({grantsList.length})
                          </span>
                          <div className={styles.overridesList}>
                            {grantsList.map((o, idx) => (
                              <div key={idx} className={styles.overrideTagGrant}>
                                <span className={styles.overrideKey}>{o.featureKey}</span>
                                <span className={styles.overrideDivider}>•</span>
                                <span className={styles.overrideCap}>+{o.capability}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {revokesList.length > 0 && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: '6px' }}>
                            Revoked Role Permissions ({revokesList.length})
                          </span>
                          <div className={styles.overridesList}>
                            {revokesList.map((o, idx) => (
                              <div key={idx} className={styles.overrideTagRevoke}>
                                <span className={styles.overrideKey}>{o.featureKey}</span>
                                <span className={styles.overrideDivider}>•</span>
                                <span className={styles.overrideCap}>-{o.capability}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.noOverridesCard} style={{ marginTop: '10px' }}>
                      <Icon.Info width={18} height={18} className={styles.noOverridesIcon} />
                      <p className={styles.noOverridesText}>
                        No custom overrides added. The user will inherit all {rolePermissions.size} permissions dynamically configured under the <strong>{selectedRole ? selectedRole.name : 'assigned role'}</strong>.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Wizard Sticky Bottom Action Bar */}
          <div className={styles.bottomBar}>
            {currentStep === 'basic' && (
              <>
                <button type="button" className={styles.cancelBtn} onClick={popLayer}>
                  Cancel
                </button>
                <button
                  type="submit"
                  form="basic-form"
                  className={styles.primaryNextBtn}
                >
                  <span>Next: Permissions</span>
                  <Icon.ChevronRight width={16} height={16} />
                </button>
              </>
            )}

            {currentStep === 'permissions' && (
              <>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setCurrentStep('basic')}
                >
                  <Icon.ChevronLeft width={16} height={16} />
                  <span>Back to Details</span>
                </button>
                <button
                  type="button"
                  className={styles.primaryNextBtn}
                  onClick={() => setCurrentStep('review')}
                >
                  <span>Next: Review & Confirm</span>
                  <Icon.ChevronRight width={16} height={16} />
                </button>
              </>
            )}

            {currentStep === 'review' && (
              <>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setCurrentStep('permissions')}
                >
                  <Icon.ChevronLeft width={16} height={16} />
                  <span>Back to Permissions</span>
                </button>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                >
                  {saving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Icon.CheckCircle width={16} height={16} />
                      <span>{isEdit ? 'Save Changes' : 'Create User Account'}</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
