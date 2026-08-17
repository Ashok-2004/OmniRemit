import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../auth/store/authStore'
import { useAppMutation } from '../../../shared/query/useAppMutation'
import { queryKeys } from '../../../shared/query/queryKeys'
import { Drawer } from '../../../shared/components/Drawer/Drawer'
import { Stepper } from '../../../shared/components/Stepper/Stepper'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Select } from '../../../shared/components/Select/Select'
import { Checkbox } from '../../../shared/components/Checkbox/Checkbox'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { Icon } from '../../../shared/components/Icon/Icon'
import { ApiError } from '../../../shared/api/httpClient'
import { authServiceClient } from '../../../shared/api/authServiceClient'
import { rolesApi } from '../../settings-roles/api/rolesApi'
import { usersApi, type AuthProviderValue } from '../api/usersApi'
import styles from './UserFormPage.module.css'

const STEPS = [
  { key: 'details', label: 'User Details' },
  { key: 'review', label: 'Review' },
]

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * Create and edit a user, in a right-side drawer over the users list.
 *
 * Two steps, not three. The reference design has an "Assign Extra Permissions" step, but this
 * platform's access model is role-only by an explicit earlier decision: a user's permissions come
 * from their role and nowhere else, which keeps "who can do what" answerable from one place. The
 * per-user override entity and endpoints still exist server-side but are deliberately not surfaced.
 */
export function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)

  const [stepIndex, setStepIndex] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [authProvider, setAuthProvider] = useState<AuthProviderValue>('Local')
  const [hydrated, setHydrated] = useState(false)

  const rolesQuery = useQuery({
    queryKey: [...queryKeys.roles.all(), 'options'],
    queryFn: () => rolesApi.list(accessToken!, { pageSize: 100 }),
    enabled: Boolean(accessToken),
  })

  const ssoQuery = useQuery({
    queryKey: queryKeys.sso.config(),
    // SSO being unconfigured is the normal case, not an error — fall back rather than surfacing it.
    queryFn: () =>
      authServiceClient.ssoConfig().catch(() => ({ googleEnabled: false, allowedDomains: [] as string[] })),
    enabled: Boolean(accessToken),
  })

  const userQuery = useQuery({
    queryKey: queryKeys.users.detail(id ?? ''),
    queryFn: () => usersApi.get(accessToken!, id!),
    enabled: Boolean(accessToken) && isEdit,
  })

  // Seeded once, so a background refetch cannot discard edits already typed into the open drawer.
  useEffect(() => {
    if (!userQuery.data || hydrated) return
    setName(userQuery.data.name)
    setEmail(userQuery.data.email)
    setPhone(userQuery.data.phoneNumber ?? '')
    setRoleId(userQuery.data.roleId ?? '')
    setIsActive(userQuery.data.isActive)
    setAuthProvider(userQuery.data.authProvider)
    setHydrated(true)
  }, [userQuery.data, hydrated])

  const roles = rolesQuery.data?.items ?? []
  // Typed explicitly — an inline `[]` literal infers never[], which makes .includes() reject strings.
  const ssoConfig: { googleEnabled: boolean; allowedDomains: string[] } = ssoQuery.data ?? {
    googleEnabled: false,
    allowedDomains: [],
  }
  const selectedRole = roles.find((r) => r.id === roleId)
  const isGoogle = authProvider === 'Google'
  const emailDomain = email.includes('@') ? email.split('@')[1]?.toLowerCase() : undefined
  const domainAllowed =
    !emailDomain || ssoConfig.allowedDomains.length === 0 || ssoConfig.allowedDomains.includes(emailDomain)

  const loading = rolesQuery.isPending || (isEdit && userQuery.isPending)

  function close() {
    navigate('/settings/users')
  }

  const saveMutation = useAppMutation<void, string | null>({
    mutationFn: async (token) => {
      if (isEdit && id) {
        await usersApi.update(token, id, { name, email, phoneNumber: phone || null, roleId: roleId || null })
        return null
      }

      const result = await usersApi.create(token, {
        name,
        email,
        phoneNumber: phone || null,
        roleId: roleId || null,
        isActive,
        authProvider,
      })
      return result.temporaryPassword
    },
    invalidates: ['users', 'roles'],
    // The acting admin may have just changed their OWN role assignment.
    refreshSession: true,
    onSuccess: (password) => {
      // On create, stay open to show the one-time password — closing would destroy the only copy.
      if (password) {
        setTempPassword(password)
      } else {
        close()
      }
    },
    onError: (err) => setFormError(toMessage(err, 'Could not save this user.')),
  })

  function validate(): string | null {
    if (!name.trim()) return 'Name is required.'
    if (!email.trim()) return 'Email is required.'
    if (isGoogle && emailDomain && !domainAllowed) {
      return `'${emailDomain}' isn't in the allowed Google sign-in domains.`
    }
    return null
  }

  function submit() {
    const problem = validate()
    if (problem) {
      setFormError(problem)
      setStepIndex(0)
      return
    }
    setFormError(null)
    saveMutation.mutate()
  }

  const details = (
    <div className={styles.section}>
      <h3 className={styles.sectionHeading}>Personal Information</h3>

      <Input label="Name" required placeholder="Enter full name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        label="Email"
        type="email"
        required
        placeholder="Enter email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={Boolean(tempPassword)}
        errorText={isGoogle && emailDomain && !domainAllowed ? `'${emailDomain}' isn't an allowed Google domain.` : undefined}
      />
      <Input label="Phone" placeholder="Enter phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />

      {!isEdit && (
        <Checkbox
          label="Active — user can sign in immediately"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      )}

      <Select label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
        <option value="">Select role</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </Select>

      {selectedRole?.isAdministrator && (
        <p className={styles.adminNotice}>This role has unrestricted Administrator access to every feature.</p>
      )}

      <p className={styles.hint}>
        This user&rsquo;s permissions come entirely from the assigned role — adjust them in Roles
        rather than per user.
      </p>

      {!isEdit && (
        <Select
          label="Authentication Method"
          value={authProvider}
          onChange={(e) => setAuthProvider(e.target.value as AuthProviderValue)}
          disabled={!ssoConfig.googleEnabled}
          helperText={
            ssoConfig.googleEnabled
              ? isGoogle
                ? 'This user signs in with Google — no password is created in OmniRemit.'
                : 'A temporary password will be generated once the user is created.'
              : "Google SSO isn't configured for this deployment — see SETUP.md to enable it."
          }
        >
          <option value="Local">Local Password</option>
          <option value="Google">Google SSO</option>
        </Select>
      )}

      {isEdit && (
        <div className={styles.readonlyField}>
          <span className={styles.readonlyLabel}>Authentication Method</span>
          <span className={styles.readonlyValue}>{isGoogle ? 'Google SSO' : 'Local Password'}</span>
          <span className={styles.hint}>Can&rsquo;t be changed after the account is created.</span>
        </div>
      )}
    </div>
  )

  const footer = tempPassword ? (
    <Button fullWidth onClick={close}>
      Done
    </Button>
  ) : isEdit ? (
    <>
      <Button variant="secondary" onClick={close}>
        Cancel
      </Button>
      <Button loading={saveMutation.isPending} onClick={submit}>
        Save Changes
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={stepIndex === 0 ? close : () => setStepIndex(0)}>
        {stepIndex === 0 ? 'Cancel' : 'Back'}
      </Button>
      {stepIndex === 0 ? (
        <Button
          onClick={() => {
            const problem = validate()
            if (problem) {
              setFormError(problem)
              return
            }
            setFormError(null)
            setStepIndex(1)
          }}
        >
          Next: Review
        </Button>
      ) : (
        <Button loading={saveMutation.isPending} onClick={submit}>
          Create User
        </Button>
      )}
    </>
  )

  return (
    <Drawer
      open
      title={isEdit ? 'Edit User' : 'Add User'}
      description={isEdit ? 'Update account details and role' : 'Create an account and assign its role'}
      size="md"
      onClose={close}
      footer={footer}
      leading={
        !isEdit && stepIndex > 0 && !tempPassword ? (
          <button type="button" className={styles.backButton} aria-label="Previous step" onClick={() => setStepIndex(0)}>
            <Icon.ChevronLeft width={18} height={18} />
          </button>
        ) : undefined
      }
    >
      {formError && <div className={styles.errorBanner}>{formError}</div>}

      {tempPassword ? (
        <div className={styles.section}>
          <div className={styles.passwordBanner}>
            <span className={styles.passwordTitle}>User created</span>
            <span className={styles.passwordHint}>
              Share this temporary password securely. It is shown once and cannot be retrieved later.
            </span>
            <code className={styles.passwordValue}>{tempPassword}</code>
          </div>
        </div>
      ) : loading ? (
        <SkeletonText lines={7} />
      ) : isEdit ? (
        details
      ) : (
        <>
          <Stepper steps={STEPS} currentIndex={stepIndex} onStepSelect={setStepIndex} />

          {stepIndex === 0 && details}

          {stepIndex === 1 && (
            <div className={styles.section}>
              <h3 className={styles.sectionHeading}>Review</h3>
              <dl className={styles.reviewList}>
                <dt>Name</dt>
                <dd>{name || '—'}</dd>
                <dt>Email</dt>
                <dd>{email || '—'}</dd>
                <dt>Phone</dt>
                <dd>{phone || '—'}</dd>
                <dt>Role</dt>
                <dd>{selectedRole?.name ?? 'No role'}</dd>
                <dt>Status</dt>
                <dd>{isActive ? 'Active — can sign in immediately' : 'Inactive'}</dd>
                <dt>Sign-in method</dt>
                <dd>{isGoogle ? 'Google SSO' : 'Local password'}</dd>
              </dl>

              {!isGoogle && (
                <p className={styles.hint}>
                  A one-time temporary password will be generated when you create this user.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
