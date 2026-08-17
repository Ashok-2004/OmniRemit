import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../auth/store/authStore'
import { useAppMutation } from '../../../shared/query/useAppMutation'
import { queryKeys } from '../../../shared/query/queryKeys'
import { Drawer } from '../../../shared/components/Drawer/Drawer'
import { Stepper } from '../../../shared/components/Stepper/Stepper'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Textarea } from '../../../shared/components/Textarea/Textarea'
import { Switch } from '../../../shared/components/Switch/Switch'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { Tabs, TabPanel } from '../../../shared/components/Tabs/Tabs'
import { Badge } from '../../../shared/components/Badge/Badge'
import { Icon } from '../../../shared/components/Icon/Icon'
import { ApiError } from '../../../shared/api/httpClient'
import { permissionsApi } from '../../../shared/api/permissionsApi'
import { rolesApi, type RolePermissionGrantDto } from '../api/rolesApi'
import { PermissionMatrix } from '../components/PermissionMatrix/PermissionMatrix'
import { UsersUsingRolePanel } from '../components/UsersUsingRolePanel/UsersUsingRolePanel'
import styles from './RoleFormPage.module.css'

const TAB_IDS = {
  basics: 'basics',
  hostPermissions: 'host-permissions',
  applicationAccess: 'application-access',
  assignedUsers: 'assigned-users',
} as const

const CREATE_STEPS = [
  { key: 'details', label: 'Role Details' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'review', label: 'Review' },
]

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * Create and edit a role, in a right-side drawer over the roles list.
 *
 * The routes (/settings/roles/new and /:id) are unchanged, so deep links and the browser back button
 * keep working — closing navigates back to the list rather than unmounting a detached modal.
 *
 * Create is a 3-step wizard; edit is the 4-tab layout, because an existing role is something you dip
 * into to change one thing rather than walk through in order.
 */
export function RoleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)

  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.basics)
  const [stepIndex, setStepIndex] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isAdministrator, setIsAdministrator] = useState(false)
  const [isSystemRole, setIsSystemRole] = useState(false)
  const [permissions, setPermissions] = useState<RolePermissionGrantDto[]>([])
  const [hydrated, setHydrated] = useState(false)

  const catalogQuery = useQuery({
    queryKey: queryKeys.permissions.catalog(),
    queryFn: () => permissionsApi.catalog(accessToken!),
    enabled: Boolean(accessToken),
  })

  const roleQuery = useQuery({
    queryKey: queryKeys.roles.detail(id ?? ''),
    queryFn: () => rolesApi.get(accessToken!, id!),
    enabled: Boolean(accessToken) && isEdit,
  })

  const roleUsersQuery = useQuery({
    queryKey: queryKeys.roles.users(id ?? ''),
    queryFn: () => rolesApi.users(accessToken!, id!),
    enabled: Boolean(accessToken) && isEdit,
  })

  // Seed the form once from the fetched role. Guarded so a background refetch cannot overwrite edits
  // already made in the open drawer.
  useEffect(() => {
    if (!roleQuery.data || hydrated) return
    setName(roleQuery.data.name)
    setDescription(roleQuery.data.description ?? '')
    setIsAdministrator(roleQuery.data.isAdministrator)
    setIsSystemRole(roleQuery.data.isSystemRole)
    setPermissions(roleQuery.data.permissions)
    setHydrated(true)
  }, [roleQuery.data, hydrated])

  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data])
  const hostFeatures = useMemo(() => catalog.filter((f) => f.source === 'Host'), [catalog])
  const remoteFeatures = useMemo(() => catalog.filter((f) => f.source === 'RemoteApp'), [catalog])

  const loading = catalogQuery.isPending || (isEdit && roleQuery.isPending)

  function close() {
    navigate('/settings/roles')
  }

  const saveMutation = useAppMutation<void>({
    mutationFn: async (token) => {
      const body = { name, description: description || null, isAdministrator, permissions }
      if (isEdit && id) {
        await rolesApi.update(token, id, body)
      } else {
        await rolesApi.create(token, body)
      }
    },
    invalidates: ['roles', 'users'],
    // A role change can alter the acting admin's OWN effective access, so their token is reissued
    // now rather than at its natural expiry.
    refreshSession: true,
    onSuccess: () => close(),
    onError: (err) => setFormError(toMessage(err, 'Could not save this role.')),
  })

  function submit() {
    if (!name.trim()) {
      setFormError('Role name is required.')
      setStepIndex(0)
      setActiveTab(TAB_IDS.basics)
      return
    }
    setFormError(null)
    saveMutation.mutate()
  }

  const basicDetails = (
    <div className={styles.section}>
      <Input label="Role Name" required placeholder="Enter role name" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea
        label="Description"
        placeholder="What is this role for?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {!isEdit && (
        <div className={styles.roleTypeBlock}>
          <span className={styles.fieldLabel}>Role Type</span>
          <div className={styles.roleTypeCards}>
            <div className={styles.roleTypeCardDisabled} aria-disabled="true">
              <span className={styles.roleTypeName}>Built-in</span>
              <span className={styles.roleTypeHint}>Defined by the platform</span>
            </div>
            <div className={styles.roleTypeCardActive}>
              <span className={styles.roleTypeName}>
                Custom
                <Icon.Check width={14} height={14} />
              </span>
              <span className={styles.roleTypeHint}>Defined by you</span>
            </div>
          </div>
          {/* Built-in roles are seeded by the platform and protected from deletion. Making this
              selectable would let anyone create an undeletable role, so it is shown for orientation
              but is not a control. */}
          <p className={styles.roleTypeNote}>
            Roles you create are always Custom. Built-in roles ship with the platform and cannot be
            created or deleted.
          </p>
        </div>
      )}

      <div className={styles.toggleRow}>
        <div className={styles.toggleLabel}>
          <span className={styles.toggleTitle}>Administrator Access</span>
          <span className={styles.toggleHint}>Grants every permission, including any added in future updates.</span>
        </div>
        <Switch
          checked={isAdministrator}
          disabled={isSystemRole && isAdministrator}
          onChange={(e) => setIsAdministrator(e.target.checked)}
        />
      </div>
    </div>
  )

  const hostPermissions = (
    <div className={styles.section}>
      <p className={styles.sectionHint}>Control what this role can do inside the platform itself.</p>
      <PermissionMatrix
        catalog={hostFeatures}
        permissions={permissions}
        onChange={setPermissions}
        disabled={isAdministrator}
        variant="flat"
        emptyMessage="No host permission features found."
      />
      {isAdministrator && (
        <p className={styles.adminNotice}>
          This role has Administrator Access, so it already holds every permission. Individual
          selections are disabled.
        </p>
      )}
    </div>
  )

  const applicationAccess = (
    <div className={styles.section}>
      <p className={styles.sectionHint}>Control access to applications and what actions can be performed.</p>
      <PermissionMatrix
        catalog={remoteFeatures}
        permissions={permissions}
        onChange={setPermissions}
        disabled={isAdministrator}
        variant="modules"
        emptyMessage="Registered applications will appear here for role-based access assignment."
      />
    </div>
  )

  const drawerFooter = isEdit ? (
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
      <Button variant="secondary" onClick={stepIndex === 0 ? close : () => setStepIndex((i) => i - 1)}>
        {stepIndex === 0 ? 'Cancel' : 'Back'}
      </Button>
      {stepIndex < CREATE_STEPS.length - 1 ? (
        <Button
          onClick={() => {
            if (stepIndex === 0 && !name.trim()) {
              setFormError('Role name is required.')
              return
            }
            setFormError(null)
            setStepIndex((i) => i + 1)
          }}
        >
          {stepIndex === 0 ? 'Next: Permissions' : 'Next: Review'}
        </Button>
      ) : (
        <Button loading={saveMutation.isPending} onClick={submit}>
          Create Role
        </Button>
      )}
    </>
  )

  return (
    <Drawer
      open
      title={isEdit ? 'Edit Role' : 'Add Role'}
      description={isEdit ? 'Update role details and manage permissions' : 'Define a role and choose what it can access'}
      size="lg"
      onClose={close}
      footer={drawerFooter}
      leading={
        !isEdit && stepIndex > 0 ? (
          <button
            type="button"
            className={styles.backButton}
            aria-label="Previous step"
            onClick={() => setStepIndex((i) => i - 1)}
          >
            <Icon.ChevronLeft width={18} height={18} />
          </button>
        ) : undefined
      }
    >
      {formError && <div className={styles.errorBanner}>{formError}</div>}

      {loading ? (
        <SkeletonText lines={8} />
      ) : isEdit ? (
        <>
          <Tabs
            id="role-form-tabs"
            activeKey={activeTab}
            onChange={setActiveTab}
            tabs={[
              { key: TAB_IDS.basics, label: 'Basic Details' },
              { key: TAB_IDS.hostPermissions, label: 'Host Permissions' },
              {
                key: TAB_IDS.applicationAccess,
                label: 'Application Access',
                suffix: remoteFeatures.length > 0 ? <Badge tone="neutral">{remoteFeatures.length}</Badge> : undefined,
              },
              { key: TAB_IDS.assignedUsers, label: 'Assigned Users' },
            ]}
          />

          <TabPanel id="role-form-tabs" tabId={TAB_IDS.basics} active={activeTab === TAB_IDS.basics}>
            {basicDetails}
          </TabPanel>
          <TabPanel id="role-form-tabs" tabId={TAB_IDS.hostPermissions} active={activeTab === TAB_IDS.hostPermissions}>
            {hostPermissions}
          </TabPanel>
          <TabPanel id="role-form-tabs" tabId={TAB_IDS.applicationAccess} active={activeTab === TAB_IDS.applicationAccess}>
            {applicationAccess}
          </TabPanel>
          <TabPanel id="role-form-tabs" tabId={TAB_IDS.assignedUsers} active={activeTab === TAB_IDS.assignedUsers}>
            <UsersUsingRolePanel users={roleUsersQuery.data?.items} total={roleUsersQuery.data?.total} isNewRole={false} />
          </TabPanel>
        </>
      ) : (
        <>
          <Stepper steps={CREATE_STEPS} currentIndex={stepIndex} onStepSelect={setStepIndex} />

          {stepIndex === 0 && basicDetails}

          {stepIndex === 1 && (
            <div className={styles.section}>
              {hostPermissions}
              {applicationAccess}
            </div>
          )}

          {stepIndex === 2 && (
            <div className={styles.section}>
              <h3 className={styles.reviewHeading}>Review</h3>
              <dl className={styles.reviewList}>
                <dt>Role name</dt>
                <dd>{name || '—'}</dd>
                <dt>Description</dt>
                <dd>{description || '—'}</dd>
                <dt>Type</dt>
                <dd>Custom</dd>
                <dt>Administrator access</dt>
                <dd>{isAdministrator ? 'Yes — every permission' : 'No'}</dd>
                <dt>Permissions granted</dt>
                <dd>{isAdministrator ? 'All (administrator)' : `${permissions.length} selected`}</dd>
              </dl>
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
