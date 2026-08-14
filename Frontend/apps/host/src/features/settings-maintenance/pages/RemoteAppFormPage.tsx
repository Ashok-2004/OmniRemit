import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { SkeletonText } from '../../../shared/components/Skeleton'
import { ApiError } from '../../../shared/api/httpClient'
import { remoteAppsApi } from '../api/remoteAppsApi'
import styles from './RemoteAppFormPage.module.css'

export function RemoteAppFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [key, setKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [iconKey, setIconKey] = useState('')
  const [manifestUrl, setManifestUrl] = useState('')
  const [sidebarOrder, setSidebarOrder] = useState(100)

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
        await remoteAppsApi.update(token, id, { displayName, iconKey: iconKey || null, manifestUrl, sidebarOrder })
      } else {
        await remoteAppsApi.create(token, { key, displayName, iconKey: iconKey || null, manifestUrl, sidebarOrder })
      }
      navigate('/settings/maintenance')
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
      <div className={styles.header}>
        <h1>{isEdit ? 'Edit Remote App' : 'Register Remote App'}</h1>
        <Button variant="ghost" onClick={() => navigate('/settings/maintenance')}>
          Cancel
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form className={styles.panel} onSubmit={(e) => void handleSubmit(e)}>
        {isEdit ? (
          <div className={styles.readonlyField}>
            <label>Key</label>
            <span className={styles.readonlyValue}>{key}</span>
          </div>
        ) : (
          <Input
            label="Key"
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="whatsapp-console"
            helperText="Lowercase letters, digits and hyphens only. Can't be changed after creation."
          />
        )}

        <Input label="Display name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

        <Input
          label="Manifest URL"
          required
          type="url"
          value={manifestUrl}
          onChange={(e) => setManifestUrl(e.target.value)}
          placeholder="https://apps.example.com/whatsapp/mf-manifest.json"
          helperText="The remote's mf-manifest.json URL — the host reads its remoteEntry and exposed modules from it at runtime."
        />

        <Input
          label="Icon key"
          value={iconKey}
          onChange={(e) => setIconKey(e.target.value)}
          placeholder="chat-bubble"
          helperText="Optional — an identifier from the host's built-in icon set."
        />

        <Input
          label="Sidebar order"
          type="number"
          value={sidebarOrder}
          onChange={(e) => setSidebarOrder(Number(e.target.value))}
        />

        <div className={styles.actions}>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Register app'}
          </Button>
        </div>
      </form>
    </div>
  )
}
