import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Checkbox } from '../../../shared/components/Checkbox/Checkbox'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { authServiceClient } from '../../../shared/api/authServiceClient'
import { rolesApi, type RoleListItemDto } from '../../settings-roles/api/rolesApi'
import { usersApi, type AuthProviderValue } from '../api/usersApi'
import styles from './UserFormPage.module.css'

/**
 * Deliberately simple: assign a role and effective permissions come from that role — no per-user
 * permission-override editor on this page. (The override data model/API is still real and intact
 * server-side, see Backend/AuthService's UserPermissionOverride entity; it's just not surfaced here
 * anymore, per the confirmed enterprise RBAC redesign.)
 */
export function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const refreshSession = useAuthStore((s) => s.refreshSession)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [ssoConfig, setSsoConfig] = useState<{ googleEnabled: boolean; allowedDomains: string[] }>({
    googleEnabled: false,
    allowedDomains: [],
  })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [authProvider, setAuthProvider] = useState<AuthProviderValue>('Local')

  useEffect(() => {
    const token = accessToken
    if (!token) return
    let cancelled = false

    async function bootstrap(token: string) {
      try {
        const [roleList, sso] = await Promise.all([
          rolesApi.list(token, { pageSize: 100 }),
          authServiceClient.ssoConfig().catch(() => ({ googleEnabled: false, allowedDomains: [] })),
        ])
        if (cancelled) return
        setRoles(roleList.items)
        setSsoConfig(sso)

        if (id) {
          const user = await usersApi.get(token, id)
          if (cancelled) return
          setName(user.name)
          setEmail(user.email)
          setPhone(user.phoneNumber ?? '')
          setRoleId(user.roleId ?? '')
          setIsActive(user.isActive)
          setAuthProvider(user.authProvider)
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

  const selectedRole = roles.find((r) => r.id === roleId)
  const isGoogle = authProvider === 'Google'
  const emailDomain = email.includes('@') ? email.split('@')[1]?.toLowerCase() : undefined
  const domainAllowed = !emailDomain || ssoConfig.allowedDomains.length === 0 || ssoConfig.allowedDomains.includes(emailDomain)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const token = await ensureFreshAccessToken()

      if (isEdit && id) {
        await usersApi.update(token, id, { name, email, phoneNumber: phone || null, roleId: roleId || null })
      } else {
        const result = await usersApi.create(token, {
          name,
          email,
          phoneNumber: phone || null,
          roleId: roleId || null,
          isActive,
          authProvider,
        })
        setTempPassword(result.temporaryPassword)
      }

      // The acting admin may have just changed their OWN role assignment — force this session's own
      // JWT to refresh so it takes effect immediately (see authStore.refreshSession's doc comment).
      void refreshSession()

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
              helperText={
                isGoogle && emailDomain && !domainAllowed
                  ? `'${emailDomain}' isn't in the allowed Google sign-in domains.`
                  : undefined
              }
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
              <div className={styles.adminNotice}>This role has unrestricted Administrator access to every feature.</div>
            )}
            <p className={styles.hint}>
              This user's effective permissions are determined entirely by the assigned role — grant
              or adjust capabilities in Setup → Role rather than per-user here.
            </p>

            <div className={styles.selectField}>
              <label htmlFor="auth-provider-select">Authentication Method</label>
              {isEdit ? (
                <div className={styles.readonlyField}>
                  <span className={styles.readonlyValue}>{isGoogle ? 'Google SSO' : 'Local Password'}</span>
                </div>
              ) : (
                <select
                  id="auth-provider-select"
                  className={styles.select}
                  value={authProvider}
                  onChange={(e) => setAuthProvider(e.target.value as AuthProviderValue)}
                  disabled={!ssoConfig.googleEnabled}
                >
                  <option value="Local">Local Password</option>
                  <option value="Google">Google SSO</option>
                </select>
              )}
            </div>
            {isEdit && <p className={styles.hint}>Authentication method can't be changed after creation.</p>}
            {!isEdit && !ssoConfig.googleEnabled && (
              <p className={styles.hint}>Google SSO isn't configured for this deployment — see SETUP.md to enable it.</p>
            )}
            {!isEdit && isGoogle && (
              <p className={styles.hint}>
                This user will sign in using Google — no password is created in OmniRemit.
                {ssoConfig.allowedDomains.length > 0 && (
                  <> Allowed domains: {ssoConfig.allowedDomains.join(', ')}.</>
                )}
              </p>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="submit" loading={saving} disabled={isGoogle && !isEdit && Boolean(emailDomain) && !domainAllowed}>
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      </form>
    </div>
  )
}
