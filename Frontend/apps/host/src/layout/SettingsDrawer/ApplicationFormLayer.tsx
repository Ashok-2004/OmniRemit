import { useEffect, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { remoteAppsApi } from '../../features/settings-applications/api/remoteAppsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import styles from './ApplicationFormLayer.module.css'

interface ApplicationFormLayerProps {
  appId?: string
}

export function ApplicationFormLayer({ appId }: ApplicationFormLayerProps) {
  const isEdit = Boolean(appId)
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const popLayer = useSettingsDrawerStore((s) => s.popLayer)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fields
  const [key, setKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [iconKey, setIconKey] = useState('')
  const [manifestUrl, setManifestUrl] = useState('')
  const [permissionsSourceUrl, setPermissionsSourceUrl] = useState('')
  const [sidebarOrder, setSidebarOrder] = useState<number>(10)

  useEffect(() => {
    if (!accessToken || !appId) return
    let cancelled = false

    async function load() {
      try {
        const app = await remoteAppsApi.get(accessToken!, appId!)
        if (!cancelled) {
          setKey(app.key)
          setDisplayName(app.displayName)
          setIconKey(app.iconKey ?? '')
          setManifestUrl(app.manifestUrl)
          setPermissionsSourceUrl(app.permissionsSourceUrl ?? '')
          setSidebarOrder(app.sidebarOrder)
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load application details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, appId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const token = await ensureFreshAccessToken()
      if (isEdit && appId) {
        await remoteAppsApi.update(token, appId, {
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
      const { useModuleRegistryStore } = await import('../../shared/stores/moduleRegistryStore')
      void useModuleRegistryStore.getState().fetchForSidebar(token)
      useSettingsDrawerStore.getState().notifyMutation()
      popLayer()
    } catch (err: any) {
      setError(err?.message || 'Could not save application.')
    } finally {
      setSaving(false)
    }
  }

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
            <Icon.Grid width={20} height={20} />
          </div>
          <div>
            <h2 className={styles.title}>{isEdit ? 'Edit Application' : 'Register Remote Application'}</h2>
            <p className={styles.subtitle}>Configure Module Federation 2.0 manifest and runtime discovery</p>
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

      {error && <div className={styles.errorAlert}>{error}</div>}

      <form id="app-form" onSubmit={(e) => void handleSubmit(e)} className={styles.form}>
        <div className={styles.contentArea}>
          {/* Card 1: Application Identity */}
          <div className={styles.formCard}>
            <h4 className={styles.formCardTitle}>Application Identity</h4>
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
                  <Icon.Grid width={16} height={16} className={styles.fieldLeftIcon} />
                </div>
                <span className={styles.fieldHint}>
                  Identifier for routing (/apps/{key || '<key>'}) and permission features (remote.{key || '<key>'}).
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
                  <Icon.Layers width={16} height={16} className={styles.fieldLeftIcon} />
                </div>
                <span className={styles.fieldHint}>
                  User-friendly label rendered in navigation menus and permission matrix tables.
                </span>
              </div>

              <div className={styles.inputGroupFull}>
                <label className={styles.label}>Sidebar Sort Order</label>
                <input
                  type="number"
                  className={styles.input}
                  value={sidebarOrder}
                  onChange={(e) => setSidebarOrder(Number(e.target.value) || 0)}
                />
                <span className={styles.fieldHint}>
                  Numerical display priority in the main navigation sidebar (lower numbers appear first).
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Integration & Federation Endpoints */}
          <div className={styles.formCard}>
            <h4 className={styles.formCardTitle}>Integration &amp; Federation Endpoints</h4>
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
                    placeholder="e.g. http://localhost:5001/mf-manifest.json"
                    value={manifestUrl}
                    onChange={(e) => setManifestUrl(e.target.value)}
                  />
                  <Icon.Globe width={16} height={16} className={styles.fieldLeftIcon} />
                </div>
                <span className={styles.fieldHint}>
                  The live URL exposing the remote application&apos;s Module Federation 2.0 manifest.
                </span>
              </div>

              <div className={styles.inputGroupFull}>
                <label className={styles.label}>Permissions Discovery URL (Optional)</label>
                <div className={styles.inputIconWrap}>
                  <input
                    type="url"
                    className={styles.inputWithIcon}
                    placeholder="e.g. http://localhost:5285/api/employee-service/permissions"
                    value={permissionsSourceUrl}
                    onChange={(e) => setPermissionsSourceUrl(e.target.value)}
                  />
                  <Icon.Activity width={16} height={16} className={styles.fieldLeftIcon} />
                </div>
                <span className={styles.fieldHint}>
                  Anonymous REST endpoint returning declared permissions for automatic catalog synchronization.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className={styles.bottomBar}>
          <button type="button" className={styles.cancelBtn} onClick={popLayer}>
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Icon.CheckCircle width={16} height={16} />
                <span>{isEdit ? 'Save Changes' : 'Register Application'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
