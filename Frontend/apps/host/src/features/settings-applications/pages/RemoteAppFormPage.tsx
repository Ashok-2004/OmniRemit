import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { remoteAppsApi } from '../api/remoteAppsApi'
import { Icon } from '../../../shared/components/Icon/Icon'
import styles from './RemoteAppFormPage.module.css'

export function RemoteAppFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const refreshSession = useAuthStore((s) => s.refreshSession)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [key, setKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [iconKey, setIconKey] = useState('')
  const [manifestUrl, setManifestUrl] = useState('')
  const [permissionsSourceUrl, setPermissionsSourceUrl] = useState('')
  const [sidebarOrder, setSidebarOrder] = useState(10)

  useEffect(() => {
    const token = accessToken
    if (!token || !id) return
    let cancelled = false

    remoteAppsApi
      .get(token, id)
      .then((app) => {
        if (cancelled) return
        setKey(app.key)
        setDisplayName(app.displayName)
        setIconKey(app.iconKey ?? '')
        setManifestUrl(app.manifestUrl)
        setPermissionsSourceUrl(app.permissionsSourceUrl ?? '')
        setSidebarOrder(app.sidebarOrder)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this app.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, id])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const token = await ensureFreshAccessToken()

      if (isEdit && id) {
        await remoteAppsApi.update(token, id, {
          displayName,
          iconKey: iconKey || null,
          manifestUrl,
          permissionsSourceUrl: permissionsSourceUrl || null,
          sidebarOrder,
        })
      } else {
        await remoteAppsApi.create(token, {
          key,
          displayName,
          iconKey: iconKey || null,
          manifestUrl,
          permissionsSourceUrl: permissionsSourceUrl || null,
          sidebarOrder,
        })
      }
      const { useModuleRegistryStore } = await import('../../../shared/stores/moduleRegistryStore')
      const { useSettingsDrawerStore } = await import('../../../shared/stores/settingsDrawerStore')
      void useModuleRegistryStore.getState().fetchForSidebar(token)
      useSettingsDrawerStore.getState().notifyMutation()
      void refreshSession()
      navigate('/settings/applications')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this app.')
    } finally {
      setSaving(false)
    }
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
            <Icon.Grid width={24} height={24} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>{isEdit ? 'Edit Remote Application' : 'Register Remote Application'}</h1>
            <p className={styles.pageSubtitle}>Configure Module Federation 2.0 manifest and runtime discovery endpoints</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => navigate('/settings/applications')}>
          Cancel
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
        {/* Card 1: Identity */}
        <div className={styles.formCard}>
          <h3 className={styles.formCardTitle}>Application Identity</h3>
          <div className={styles.fieldsGrid}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Application Key <span className={styles.req}>*</span>
              </label>
              <div className={styles.inputIconWrap}>
                <input
                  type="text"
                  required
                  disabled={isEdit}
                  className={styles.inputWithIcon}
                  placeholder="e.g. employee"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <Icon.Grid width={18} height={18} className={styles.fieldLeftIcon} />
              </div>
              <span className={styles.fieldHint}>
                Unique identifier used in routes (/apps/{key || '<key>'}) and permission features (remote.{key || '<key>'}).
              </span>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Display Name <span className={styles.req}>*</span>
              </label>
              <div className={styles.inputIconWrap}>
                <input
                  type="text"
                  required
                  className={styles.inputWithIcon}
                  placeholder="e.g. Employee Management"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <Icon.Layers width={18} height={18} className={styles.fieldLeftIcon} />
              </div>
              <span className={styles.fieldHint}>
                User-facing application title rendered in headers and permission tables.
              </span>
            </div>

            <div className={styles.inputGroupFull}>
              <label className={styles.label}>Sidebar Sort Priority</label>
              <input
                type="number"
                className={styles.input}
                value={sidebarOrder}
                onChange={(e) => setSidebarOrder(Number(e.target.value) || 0)}
              />
              <span className={styles.fieldHint}>
                Sort order in the host application navigation bar (lower numbers appear higher).
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Federation & Discovery */}
        <div className={styles.formCard}>
          <h3 className={styles.formCardTitle}>Integration &amp; Federation Endpoints</h3>
          <div className={styles.fieldsGrid}>
            <div className={styles.inputGroupFull}>
              <label className={styles.label}>
                Module Federation Manifest URL <span className={styles.req}>*</span>
              </label>
              <div className={styles.inputIconWrap}>
                <input
                  type="url"
                  required
                  className={styles.inputWithIcon}
                  placeholder="http://localhost:5001/mf-manifest.json"
                  value={manifestUrl}
                  onChange={(e) => setManifestUrl(e.target.value)}
                />
                <Icon.Globe width={18} height={18} className={styles.fieldLeftIcon} />
              </div>
              <span className={styles.fieldHint}>
                The remote&apos;s live mf-manifest.json URL — the host reads its remoteEntry and exposed modules at runtime.
              </span>
            </div>

            <div className={styles.inputGroupFull}>
              <label className={styles.label}>Permissions Source URL (Discovery)</label>
              <div className={styles.inputIconWrap}>
                <input
                  type="url"
                  className={styles.inputWithIcon}
                  placeholder="http://localhost:5285/api/employee-service/permissions"
                  value={permissionsSourceUrl}
                  onChange={(e) => setPermissionsSourceUrl(e.target.value)}
                />
                <Icon.Activity width={18} height={18} className={styles.fieldLeftIcon} />
              </div>
              <span className={styles.fieldHint}>
                Discovery endpoint declaring this application&apos;s permissions for automatic catalog synchronization.
              </span>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/settings/applications')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            <Icon.CheckCircle width={16} height={16} />
            <span>{isEdit ? 'Save Changes' : 'Register Application'}</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
