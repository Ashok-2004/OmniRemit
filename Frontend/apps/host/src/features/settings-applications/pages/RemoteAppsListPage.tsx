import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Table } from '../../../shared/components/Table/Table'
import { SkeletonTable } from '../../../shared/components/Skeleton'
import { Modal } from '../../../shared/components/Modal/Modal'
import { Badge } from '../../../shared/components/Badge/Badge'
import { ApiError } from '../../../shared/api/httpClient'
import { remoteAppsApi, type RemoteAppDto } from '../api/remoteAppsApi'
import { StatusToggle } from '../components/StatusToggle/StatusToggle'
import styles from './RemoteAppsListPage.module.css'

const FEATURE = 'host.settings.applications'
const PAGE_SIZE = 20

export function RemoteAppsListPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)

  const [apps, setApps] = useState<RemoteAppDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<RemoteAppDto | null>(null)
  const [resyncing, setResyncing] = useState(false)

  const canCreate = hasCapability(FEATURE, 'Create')
  const canEdit = hasCapability(FEATURE, 'Edit')
  const canDelete = hasCapability(FEATURE, 'Delete')

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    try {
      const result = await remoteAppsApi.list(accessToken, { pageSize: PAGE_SIZE, search: search || undefined })
      setApps(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load remote apps.')
    }
  }, [accessToken, search])

  useEffect(() => {
    void load()
  }, [load])

  async function saveStatus(app: RemoteAppDto, status: RemoteAppDto['status'], message: string | null) {
    const token = await ensureFreshAccessToken()
    await remoteAppsApi.updateStatus(token, app.id, status, message)
    void load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const token = await ensureFreshAccessToken()
    await remoteAppsApi.remove(token, pendingDelete.id)
    setPendingDelete(null)
    void load()
  }

  async function handleResync() {
    setResyncing(true)
    setNotice(null)
    setError(null)
    try {
      const token = await ensureFreshAccessToken()
      const result = await remoteAppsApi.resyncPermissions(token)
      setNotice(`Resynced ${result.resyncedCount} app${result.resyncedCount === 1 ? '' : 's'} with AuthService.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resync permissions.')
    } finally {
      setResyncing(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Applications</h1>
        <p>Register remote apps, control what's visible in the sidebar, and set maintenance messages.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarActions}>
          {canCreate && (
            <Link to="/settings/applications/new">
              <Button>+ Register App</Button>
            </Link>
          )}
          {canEdit && (
            <Button variant="secondary" onClick={() => void handleResync()} loading={resyncing}>
              Resync permissions
            </Button>
          )}
        </div>
        <Input
          className={styles.searchInput}
          placeholder="Search apps…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {notice && <div className={styles.successBanner}>{notice}</div>}

      {apps === null ? (
        <SkeletonTable rows={5} columns={5} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>App</th>
              <th>Capabilities</th>
              <th>Order</th>
              <th>Manifest URL</th>
              <th>Status</th>
              {(canEdit || canDelete) && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No remote apps registered yet.
                </td>
              </tr>
            )}
            {apps.map((app) => (
              <tr key={app.id}>
                <td>
                  <div className={styles.nameCell}>
                    <div>
                      {canEdit ? (
                        <Link to={`/settings/applications/${app.id}`} className={styles.nameLink}>
                          {app.displayName}
                        </Link>
                      ) : (
                        <span>{app.displayName}</span>
                      )}
                      <div className={styles.keyText}>{app.key}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {app.capabilities.length === 0 ? (
                    <span className={styles.keyText}>None declared</span>
                  ) : (
                    <div className={styles.capabilityList}>
                      {app.capabilities.map((cap) => (
                        <Badge key={cap.key} tone="info">
                          {cap.displayName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td>{app.sidebarOrder}</td>
                <td className={styles.manifestUrl} title={app.manifestUrl}>
                  {app.manifestUrl}
                </td>
                <td>
                  <StatusToggle app={app} disabled={!canEdit} onSave={(status, message) => saveStatus(app, status, message)} />
                </td>
                {(canEdit || canDelete) && (
                  <td>
                    <div className={styles.actionsCell}>
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => setPendingDelete(app)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {total > 0 && apps && apps.length < total && (
        <p>
          Showing {apps.length} of {total}.
        </p>
      )}

      <Modal
        open={Boolean(pendingDelete)}
        title={`Remove ${pendingDelete?.displayName}?`}
        onClose={() => setPendingDelete(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Remove
            </Button>
          </>
        }
      >
        This removes it from the sidebar for everyone and deactivates its permission in every role.
        It can be re-registered later, but permissions will need to be re-granted.
      </Modal>
    </div>
  )
}
