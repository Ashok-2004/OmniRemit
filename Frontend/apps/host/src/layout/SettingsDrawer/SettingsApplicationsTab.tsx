import { useEffect, useState } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { remoteAppsApi, type RemoteAppDto, type RemoteAppStatus } from '../../features/settings-applications/api/remoteAppsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { useModuleRegistryStore } from '../../shared/stores/moduleRegistryStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import styles from './SettingsApplicationsTab.module.css'

export function SettingsApplicationsTab() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAdministrator = Boolean(useAuthStore((s) => s.user)?.isAdministrator)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const pushLayer = useSettingsDrawerStore((s) => s.pushLayer)

  const canRegister = isAdministrator || hasCapability('host.settings.applications', 'Register') || hasCapability('host.settings.applications', 'Create')
  const canEdit = isAdministrator || hasCapability('host.settings.applications', 'Edit')
  const canDelete = isAdministrator || hasCapability('host.settings.applications', 'Delete') || hasCapability('host.settings.applications', 'Remove')
  const canResync = isAdministrator || hasCapability('host.settings.applications', 'Edit') || hasCapability('host.settings.applications', 'Resync')

  const [apps, setApps] = useState<RemoteAppDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  // Status Change Modal State
  const [statusTargetApp, setStatusTargetApp] = useState<RemoteAppDto | null>(null)
  const [newStatus, setNewStatus] = useState<RemoteAppStatus>('Active')
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await remoteAppsApi.list(accessToken!, { search: search || undefined })
        if (!cancelled) {
          setApps(res.items)
          setTotal(res.total)
        }
      } catch (err) {
        console.error('Failed to load apps:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, search])

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}"?`)) return
    if (!accessToken) return
    try {
      await remoteAppsApi.remove(accessToken, id)
      const res = await remoteAppsApi.list(accessToken, { search: search || undefined })
      setApps(res.items)
      setTotal(res.total)
      void useModuleRegistryStore.getState().fetchForSidebar(accessToken)
      useSettingsDrawerStore.getState().notifyMutation()
    } catch (err) {
      console.error('Failed to remove app:', err)
      window.alert('Failed to remove app.')
    } finally {
      setActiveMenuId(null)
    }
  }

  const handleResync = async () => {
    if (!accessToken) return
    try {
      const res = await remoteAppsApi.resyncPermissions(accessToken)
      window.alert(`Successfully resynced permissions for ${res.resyncedCount} app(s).`)
    } catch (err) {
      console.error('Failed to resync:', err)
      window.alert('Failed to resync permissions.')
    } finally {
      setActiveMenuId(null)
    }
  }

  const openStatusModal = (app: RemoteAppDto) => {
    setStatusTargetApp(app)
    setNewStatus(app.status)
    setMaintenanceMessage(app.maintenanceMessage || '')
    setActiveMenuId(null)
  }

  const handleSaveStatus = async () => {
    if (!accessToken || !statusTargetApp) return
    setUpdatingStatus(true)
    try {
      await remoteAppsApi.updateStatus(
        accessToken,
        statusTargetApp.id,
        newStatus,
        newStatus === 'Maintenance' ? maintenanceMessage || 'Application is temporarily down for maintenance.' : null
      )
      const res = await remoteAppsApi.list(accessToken, { search: search || undefined })
      setApps(res.items)
      setTotal(res.total)
      setStatusTargetApp(null)
      void useModuleRegistryStore.getState().fetchForSidebar(accessToken)
      useSettingsDrawerStore.getState().notifyMutation()
    } catch (err) {
      console.error('Failed to update app status:', err)
      window.alert('Failed to update application status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Applications</h3>
          <p className={styles.subtitle}>Register and manage federated micro-frontend modules.</p>
        </div>
        {canRegister && (
          <button
            type="button"
            className={styles.createButton}
            onClick={() => pushLayer({ type: 'app-form' })}
          >
            <Icon.Plus width={16} height={16} />
            <span>Add Application</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className={styles.searchWrap}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search applications..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Icon.Search width={16} height={16} className={styles.searchIcon} />
      </div>

      {/* Apps List */}
      <div className={styles.appList}>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <SkeletonBlock height={64} width="100%" />
            </div>
          ))
        ) : apps.length > 0 ? (
          apps.map((app) => {
            const isMaintenance = app.status === 'Maintenance'
            const isDisabled = app.status === 'Disabled'

            return (
              <div key={app.id} className={styles.appCard}>
                {/* App Icon */}
                <div
                  className={styles.appIconWrap}
                  style={{
                    background: isMaintenance ? '#fff7ed' : isDisabled ? '#f1f5f9' : '#ede9fe',
                    color: isMaintenance ? '#f97316' : isDisabled ? '#94a3b8' : '#6366f1',
                  }}
                >
                  <Icon.Users width={20} height={20} />
                </div>

                {/* Info */}
                <div className={styles.appInfo}>
                  <div className={styles.appNameRow}>
                    <span className={styles.appName}>{app.displayName}</span>
                    <span className={styles.appKey}>{app.key}</span>
                  </div>
                  <span className={styles.appDesc}>
                    {isMaintenance && app.maintenanceMessage ? `⚠️ ${app.maintenanceMessage}` : app.manifestUrl}
                  </span>
                </div>

                {/* Status & Quick Actions */}
                <div className={styles.appMeta}>
                  {/* Clickable Status Badge to quickly change status */}
                  <button
                    type="button"
                    className={
                      isMaintenance
                        ? styles.maintenanceBadge
                        : isDisabled
                        ? styles.disabledBadge
                        : styles.activeBadge
                    }
                    onClick={() => canEdit && openStatusModal(app)}
                    title={canEdit ? 'Click to change application status' : undefined}
                    disabled={!canEdit}
                  >
                    <span
                      className={
                        isMaintenance
                          ? styles.badgeDotAmber
                          : isDisabled
                          ? styles.badgeDotGray
                          : styles.badgeDotGreen
                      }
                    />
                    <span>{app.status}</span>
                  </button>

                  {/* Direct Edit Button along with the Status */}
                  {canEdit && (
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => pushLayer({ type: 'app-form', appId: app.id })}
                      title="Edit Application"
                    >
                      <Icon.Edit width={16} height={16} />
                    </button>
                  )}

                  {/* Direct Delete Button */}
                  {canDelete && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => void handleDelete(app.id, app.displayName)}
                      title="Delete Application"
                    >
                      <Icon.Trash width={16} height={16} />
                    </button>
                  )}

                  {/* More Menu for additional actions */}
                  <div className={styles.menuContainer}>
                    <button
                      type="button"
                      className={styles.moreButton}
                      onClick={() => setActiveMenuId(activeMenuId === app.id ? null : app.id)}
                      aria-label="Actions"
                      title="More Options"
                    >
                      <Icon.MoreVertical width={16} height={16} />
                    </button>

                    {activeMenuId === app.id && (
                      <div className={styles.menuDropdown}>
                        {canEdit && (
                          <button
                            type="button"
                            className={styles.menuItem}
                            onClick={() => openStatusModal(app)}
                          >
                            <Icon.Activity width={14} height={14} />
                            <span>Change Status</span>
                          </button>
                        )}
                        {canResync && (
                          <button
                            type="button"
                            className={styles.menuItem}
                            onClick={() => void handleResync()}
                          >
                            <Icon.Activity width={14} height={14} />
                            <span>Resync Permissions</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className={`${styles.menuItem} ${styles.menuItemDelete}`}
                            onClick={() => void handleDelete(app.id, app.displayName)}
                          >
                            <Icon.Trash width={14} height={14} />
                            <span>Remove App</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className={styles.emptyState}>
            <p>No applications registered yet.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerText}>
          Showing 1 to {apps.length} of {total} applications
        </span>
        <div className={styles.pagination}>
          <button type="button" className={styles.pageBtn} disabled>
            &lt;
          </button>
          <span className={styles.pageActive}>1</span>
          <button type="button" className={styles.pageBtn} disabled>
            &gt;
          </button>
        </div>
      </div>

      {/* Status Change Modal Dialog */}
      {statusTargetApp && (
        <div className={styles.statusModalOverlay}>
          <div className={styles.statusModalContent}>
            <div className={styles.statusModalHeader}>
              <div>
                <h4 className={styles.statusModalTitle}>Update Application Status</h4>
                <p className={styles.statusModalSubtitle}>
                  Set runtime accessibility for <strong>{statusTargetApp.displayName}</strong>
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setStatusTargetApp(null)}
              >
                <Icon.X width={18} height={18} />
              </button>
            </div>

            <div className={styles.statusOptionsList}>
              <label
                className={`${styles.statusOptionCard} ${newStatus === 'Active' ? styles.optionActive : ''}`}
                onClick={() => setNewStatus('Active')}
              >
                <input
                  type="radio"
                  name="appStatus"
                  checked={newStatus === 'Active'}
                  onChange={() => setNewStatus('Active')}
                />
                <div className={styles.optionTextWrap}>
                  <div className={styles.optionTitleRow}>
                    <span className={styles.badgeDotGreen} />
                    <span className={styles.optionTitle}>Active</span>
                  </div>
                  <span className={styles.optionDesc}>
                    Application is live and accessible to all authorized users.
                  </span>
                </div>
              </label>

              <label
                className={`${styles.statusOptionCard} ${newStatus === 'Maintenance' ? styles.optionActive : ''}`}
                onClick={() => setNewStatus('Maintenance')}
              >
                <input
                  type="radio"
                  name="appStatus"
                  checked={newStatus === 'Maintenance'}
                  onChange={() => setNewStatus('Maintenance')}
                />
                <div className={styles.optionTextWrap}>
                  <div className={styles.optionTitleRow}>
                    <span className={styles.badgeDotAmber} />
                    <span className={styles.optionTitle}>Maintenance Mode</span>
                  </div>
                  <span className={styles.optionDesc}>
                    Shows a friendly maintenance notice to users while you perform updates.
                  </span>
                </div>
              </label>

              <label
                className={`${styles.statusOptionCard} ${newStatus === 'Disabled' ? styles.optionActive : ''}`}
                onClick={() => setNewStatus('Disabled')}
              >
                <input
                  type="radio"
                  name="appStatus"
                  checked={newStatus === 'Disabled'}
                  onChange={() => setNewStatus('Disabled')}
                />
                <div className={styles.optionTextWrap}>
                  <div className={styles.optionTitleRow}>
                    <span className={styles.badgeDotGray} />
                    <span className={styles.optionTitle}>Disabled</span>
                  </div>
                  <span className={styles.optionDesc}>
                    Hides the application entirely from users and navigation menus.
                  </span>
                </div>
              </label>
            </div>

            {newStatus === 'Maintenance' && (
              <div className={styles.messageGroup}>
                <label className={styles.messageLabel}>Maintenance Notice to Users</label>
                <input
                  type="text"
                  className={styles.messageInput}
                  placeholder="e.g. Upgrading server infrastructure. Expected back in 30 mins."
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                />
              </div>
            )}

            <div className={styles.statusModalActions}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setStatusTargetApp(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.saveModalBtn}
                onClick={() => void handleSaveStatus()}
                disabled={updatingStatus}
              >
                {updatingStatus ? 'Updating...' : 'Apply Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
