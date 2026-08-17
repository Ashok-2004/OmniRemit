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
import { Switch } from '../../../shared/components/Switch/Switch'
import { Badge } from '../../../shared/components/Badge/Badge'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { Icon } from '../../../shared/components/Icon/Icon'
import { ApiError } from '../../../shared/api/httpClient'
import { remoteAppsApi } from '../api/remoteAppsApi'
import styles from './RemoteAppFormPage.module.css'

const STEPS = [
  { key: 'details', label: 'App Details' },
  { key: 'capabilities', label: 'Capabilities' },
  { key: 'review', label: 'Review' },
]

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * Register and edit a remote application, in a right-side drawer over the applications list.
 *
 * Step 2 shows what the app's own discovery endpoint ACTUALLY reports rather than letting an admin
 * type capabilities by hand — the whole point of the dynamic permission system is that a remote
 * declares its own modules and actions, and anything typed here would drift from what the remote
 * really enforces. On create there is nothing to show yet, so the step explains what will happen.
 */
export function RemoteAppFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)

  const [stepIndex, setStepIndex] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)

  const [key, setKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [manifestUrl, setManifestUrl] = useState('')
  const [permissionsSourceUrl, setPermissionsSourceUrl] = useState('')
  const [sidebarOrder, setSidebarOrder] = useState(100)
  const [isActive, setIsActive] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  const appQuery = useQuery({
    queryKey: queryKeys.applications.detail(id ?? ''),
    queryFn: () => remoteAppsApi.get(accessToken!, id!),
    enabled: Boolean(accessToken) && isEdit,
  })

  useEffect(() => {
    if (!appQuery.data || hydrated) return
    setKey(appQuery.data.key)
    setDisplayName(appQuery.data.displayName)
    setManifestUrl(appQuery.data.manifestUrl)
    setPermissionsSourceUrl(appQuery.data.permissionsSourceUrl ?? '')
    setSidebarOrder(appQuery.data.sidebarOrder)
    setIsActive(appQuery.data.status === 'Active')
    setHydrated(true)
  }, [appQuery.data, hydrated])

  const capabilities = appQuery.data?.capabilities ?? []
  const loading = isEdit && appQuery.isPending

  function close() {
    navigate('/settings/applications')
  }

  const saveMutation = useAppMutation<void>({
    mutationFn: async (token) => {
      if (isEdit && id) {
        await remoteAppsApi.update(token, id, {
          displayName,
          manifestUrl,
          permissionsSourceUrl: permissionsSourceUrl || null,
          sidebarOrder,
        })
      } else {
        await remoteAppsApi.create(token, {
          key,
          displayName,
          manifestUrl,
          permissionsSourceUrl: permissionsSourceUrl || null,
          sidebarOrder,
        })
      }
    },
    invalidates: ['applications', 'permissions'],
    refreshSession: true,
    refreshSidebar: true,
    onSuccess: () => close(),
    onError: (err) => setFormError(toMessage(err, 'Could not save this application.')),
  })

  function validateDetails(): string | null {
    if (!displayName.trim()) return 'Application name is required.'
    if (!isEdit && !key.trim()) return 'Application key is required.'
    if (!manifestUrl.trim()) return 'Manifest URL is required.'
    try {
      // Matches the server's own check, so an obvious mistake is caught before the round trip.
      new URL(manifestUrl)
    } catch {
      return 'Manifest URL must be a full absolute URL, e.g. http://localhost:5001/mf-manifest.json'
    }
    if (permissionsSourceUrl.trim()) {
      try {
        new URL(permissionsSourceUrl)
      } catch {
        return 'Permissions source URL must be a full absolute URL.'
      }
    }
    return null
  }

  function submit() {
    const problem = validateDetails()
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
      <h3 className={styles.sectionHeading}>Application Details</h3>

      <Input
        label="Application Name"
        required
        placeholder="e.g. Employee Management"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      {isEdit ? (
        <div className={styles.readonlyField}>
          <span className={styles.readonlyLabel}>Application Key</span>
          <span className={styles.readonlyValue}>{key}</span>
          {/* Immutable by design — the key is the Module Federation registration name and the root of
              this app's permission feature keys. Changing it would orphan every grant made against it. */}
          <span className={styles.hint}>Can&rsquo;t be changed after registration.</span>
        </div>
      ) : (
        <Input
          label="Application Key"
          required
          placeholder="e.g. employee"
          value={key}
          onChange={(e) => setKey(e.target.value.toLowerCase())}
          helperText="Lowercase letters, digits and hyphens. Used to identify the application everywhere in the system."
        />
      )}

      <Input
        label="Display Order"
        type="number"
        required
        value={sidebarOrder}
        onChange={(e) => setSidebarOrder(Number(e.target.value))}
        helperText="Controls where the application appears in the sidebar. Lower numbers come first."
      />

      <Input
        label="Manifest URL"
        required
        placeholder="e.g. http://localhost:5001/mf-manifest.json"
        value={manifestUrl}
        onChange={(e) => setManifestUrl(e.target.value)}
        helperText="URL to the remote application's mf-manifest.json file."
      />

      <Input
        label="Permissions Source URL"
        placeholder="e.g. http://localhost:5285/api/employee-service/permissions"
        value={permissionsSourceUrl}
        onChange={(e) => setPermissionsSourceUrl(e.target.value)}
        helperText="Optional. The endpoint this app uses to declare its own modules and permissions."
      />

      {isEdit && (
        <div className={styles.toggleRow}>
          <div className={styles.toggleLabel}>
            <span className={styles.toggleTitle}>Active</span>
            <span className={styles.toggleHint}>Inactive applications aren&rsquo;t visible in the sidebar.</span>
          </div>
          {/* Read-only here on purpose: status has its own control on the list, which also captures
              a maintenance message. Two places to change it would let them disagree. */}
          <Switch checked={isActive} disabled readOnly />
        </div>
      )}

      <div className={styles.tips}>
        <span className={styles.tipsTitle}>
          <Icon.AlertTriangle width={16} height={16} />
          Tips
        </span>
        <ul className={styles.tipsList}>
          <li>The manifest URL must be reachable from the host — it is checked when you save.</li>
          <li>Two applications cannot share a Module Federation container name.</li>
          <li>Changes to the manifest may require a permissions resync.</li>
        </ul>
      </div>
    </div>
  )

  const capabilitiesStep = (
    <div className={styles.section}>
      <h3 className={styles.sectionHeading}>Capabilities</h3>

      {isEdit ? (
        capabilities.length === 0 ? (
          <p className={styles.hint}>
            This application hasn&rsquo;t declared any capabilities. Set a Permissions Source URL and
            use <strong>Resync permissions</strong> on the list to pull them in.
          </p>
        ) : (
          <>
            <p className={styles.hint}>
              Reported by the application itself. These appear automatically in every role&rsquo;s
              permission editor — nothing is typed here.
            </p>
            <div className={styles.capabilityList}>
              {capabilities.map((cap) => (
                <Badge key={cap.key} tone="info">
                  {cap.displayName}
                </Badge>
              ))}
            </div>
          </>
        )
      ) : (
        <p className={styles.hint}>
          Capabilities are discovered from the application itself, not entered by hand. If you provide
          a Permissions Source URL, its modules and actions are fetched on save and appear in the role
          editor automatically.
        </p>
      )}
    </div>
  )

  const footer = isEdit ? (
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
      {stepIndex < STEPS.length - 1 ? (
        <Button
          onClick={() => {
            if (stepIndex === 0) {
              const problem = validateDetails()
              if (problem) {
                setFormError(problem)
                return
              }
            }
            setFormError(null)
            setStepIndex((i) => i + 1)
          }}
        >
          {stepIndex === 0 ? 'Next: Capabilities' : 'Next: Review'}
        </Button>
      ) : (
        <Button loading={saveMutation.isPending} onClick={submit}>
          Register Application
        </Button>
      )}
    </>
  )

  return (
    <Drawer
      open
      title={isEdit ? 'Edit Application' : 'Add Application'}
      description={isEdit ? 'Update registration details' : 'Register a remote application with the platform'}
      size="md"
      onClose={close}
      footer={footer}
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
          {details}
          {capabilitiesStep}
        </>
      ) : (
        <>
          <Stepper steps={STEPS} currentIndex={stepIndex} onStepSelect={setStepIndex} />

          {stepIndex === 0 && details}
          {stepIndex === 1 && capabilitiesStep}

          {stepIndex === 2 && (
            <div className={styles.section}>
              <h3 className={styles.sectionHeading}>Review</h3>
              <dl className={styles.reviewList}>
                <dt>Name</dt>
                <dd>{displayName || '—'}</dd>
                <dt>Key</dt>
                <dd className={styles.mono}>{key || '—'}</dd>
                <dt>Display order</dt>
                <dd>{sidebarOrder}</dd>
                <dt>Manifest URL</dt>
                <dd className={styles.mono}>{manifestUrl || '—'}</dd>
                <dt>Permissions source</dt>
                <dd className={styles.mono}>{permissionsSourceUrl || 'Not set'}</dd>
              </dl>
              <p className={styles.hint}>
                The manifest is fetched when you register, so an unreachable URL or a duplicate
                container name is reported straight away rather than failing later in the browser.
              </p>
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
