import { useMemo, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../auth/store/authStore'
import { useAppMutation } from '../../../shared/query/useAppMutation'
import { queryKeys } from '../../../shared/query/queryKeys'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { Button } from '../../../shared/components/Button/Button'
import { Modal } from '../../../shared/components/Modal/Modal'
import { Badge } from '../../../shared/components/Badge/Badge'
import { Icon } from '../../../shared/components/Icon/Icon'
import { IconTile } from '../../../shared/components/IconTile/IconTile'
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader'
import { StatCard } from '../../../shared/components/StatCard/StatCard'
import { DataTable, type DataTableColumn } from '../../../shared/components/DataTable/DataTable'
import { ListToolbar } from '../../../shared/components/ListToolbar/ListToolbar'
import { Pagination } from '../../../shared/components/Pagination/Pagination'
import { KebabMenu } from '../../../shared/components/KebabMenu/KebabMenu'
import { ApiError } from '../../../shared/api/httpClient'
import { remoteAppsApi, type RemoteAppDto } from '../api/remoteAppsApi'
import { StatusToggle } from '../components/StatusToggle/StatusToggle'
import styles from './RemoteAppsListPage.module.css'

const FEATURE = 'host.settings.applications'
const PAGE_SIZE = 10
/** How many capability chips fit before collapsing the rest into a "+N" badge. */
const VISIBLE_CAPABILITIES = 3

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function RemoteAppsListPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<RemoteAppDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const canRegister = hasCapability(FEATURE, 'Register')
  const canEdit = hasCapability(FEATURE, 'Edit')
  const canDelete = hasCapability(FEATURE, 'Delete')
  const canDisable = hasCapability(FEATURE, 'Disable')

  const debouncedSearch = useDebouncedValue(search, 300)

  const appsQuery = useQuery({
    queryKey: queryKeys.applications.list({ page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined }),
    queryFn: () => remoteAppsApi.list(accessToken!, { page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined }),
    enabled: Boolean(accessToken),
  })

  const allApps = appsQuery.data?.items
  const total = appsQuery.data?.total ?? 0

  // Status is filtered client-side against the fetched page — the list endpoint has no status
  // parameter, and inventing one would mean a backend change this rebuild does not need.
  const apps = useMemo(
    () => (statusFilter ? allApps?.filter((a) => a.status === statusFilter) : allApps),
    [allApps, statusFilter],
  )

  const stats = useMemo(() => {
    if (!allApps) return null
    return {
      total,
      active: allApps.filter((a) => a.status === 'Active').length,
      inactive: allApps.filter((a) => a.status !== 'Active').length,
      // Replaces the reference's "Total Manifests", which is by definition equal to Total
      // Applications and therefore says nothing. Real reachability from the health probe is useful.
      unreachable: allApps.filter((a) => a.health === 'Unreachable').length,
    }
  }, [allApps, total])

  const error = actionError ?? (appsQuery.isError ? toMessage(appsQuery.error, 'Could not load remote apps.') : null)

  const statusMutation = useAppMutation<{ app: RemoteAppDto; status: RemoteAppDto['status']; message: string | null }>({
    mutationFn: (token, { app, status, message }) => remoteAppsApi.updateStatus(token, app.id, status, message),
    invalidates: ['applications', 'permissions'],
    refreshSession: true,
    refreshSidebar: true,
    onError: (err) => setActionError(toMessage(err, 'Could not update this app.')),
  })

  const deleteMutation = useAppMutation<RemoteAppDto>({
    mutationFn: (token, app) => remoteAppsApi.remove(token, app.id),
    invalidates: ['applications', 'permissions'],
    refreshSidebar: true,
    onSuccess: () => setPendingDelete(null),
    onError: (err) => setActionError(toMessage(err, 'Could not delete this app.')),
  })

  const resyncMutation = useAppMutation<void, { resyncedCount: number }>({
    mutationFn: (token) => remoteAppsApi.resyncPermissions(token),
    invalidates: ['applications', 'permissions'],
    refreshSession: true,
    refreshSidebar: true,
    onSuccess: (result) =>
      setNotice(`Resynced ${result.resyncedCount} app${result.resyncedCount === 1 ? '' : 's'} with AuthService.`),
    onError: (err) => setActionError(toMessage(err, 'Could not resync permissions.')),
  })

  async function copyManifest(app: RemoteAppDto) {
    try {
      await navigator.clipboard.writeText(app.manifestUrl)
      setCopiedId(app.id)
      window.setTimeout(() => setCopiedId((id) => (id === app.id ? null : id)), 1600)
    } catch {
      // Clipboard access can be denied; the URL is still selectable in the cell.
    }
  }

  const columns: DataTableColumn<RemoteAppDto>[] = [
    {
      key: 'app',
      header: 'Application',
      render: (app) => (
        <div className={styles.nameCell}>
          <IconTile tone="primary" size="sm">
            <Icon.Grid width={16} height={16} />
          </IconTile>
          <div className={styles.nameText}>
            {canEdit ? (
              <Link to={`/settings/applications/${app.id}`} className={styles.nameLink}>
                {app.displayName}
              </Link>
            ) : (
              <span className={styles.nameStatic}>{app.displayName}</span>
            )}
            <span className={styles.keyText}>{app.key}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'capabilities',
      header: 'Capabilities',
      hideOnNarrow: true,
      render: (app) =>
        app.capabilities.length === 0 ? (
          <span className={styles.mutedText}>None declared</span>
        ) : (
          <div className={styles.capabilityList}>
            {app.capabilities.slice(0, VISIBLE_CAPABILITIES).map((cap) => (
              <Badge key={cap.key} tone="info">
                {cap.displayName}
              </Badge>
            ))}
            {app.capabilities.length > VISIBLE_CAPABILITIES && (
              <Badge tone="neutral">+{app.capabilities.length - VISIBLE_CAPABILITIES}</Badge>
            )}
          </div>
        ),
    },
    { key: 'order', header: 'Order', align: 'right', width: '80px', hideOnNarrow: true, render: (app) => app.sidebarOrder },
    {
      key: 'manifest',
      header: 'Manifest URL',
      hideOnNarrow: true,
      render: (app) => (
        <div className={styles.manifestCell}>
          <span className={styles.manifestUrl} title={app.manifestUrl}>
            {app.manifestUrl}
          </span>
          <button
            type="button"
            className={styles.copyButton}
            aria-label={`Copy manifest URL for ${app.displayName}`}
            onClick={() => void copyManifest(app)}
          >
            {copiedId === app.id ? <Icon.Check width={14} height={14} /> : <Icon.Copy width={14} height={14} />}
          </button>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      render: (app) => (
        <StatusToggle
          app={app}
          disabled={!canDisable}
          onSave={async (status, message) => {
            await statusMutation.mutateAsync({ app, status, message })
          }}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '108px',
      render: (app) => (
        <div className={styles.actionsCell}>
          {canEdit && (
            <button
              type="button"
              className={styles.iconAction}
              aria-label={`Edit ${app.displayName}`}
              onClick={() => navigate(`/settings/applications/${app.id}`)}
            >
              <Icon.Pencil width={16} height={16} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className={styles.iconActionDanger}
              aria-label={`Remove ${app.displayName}`}
              onClick={() => setPendingDelete(app)}
            >
              <Icon.Trash width={16} height={16} />
            </button>
          )}
          <KebabMenu
            items={[
              ...(canEdit
                ? [{ key: 'resync', label: 'Resync permissions', onSelect: () => resyncMutation.mutate() }]
                : []),
              { key: 'copy', label: 'Copy manifest URL', onSelect: () => void copyManifest(app) },
            ]}
          />
        </div>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <PageHeader
        icon={<Icon.Grid width={24} height={24} />}
        title="Applications"
        description="Register remote applications, manage visibility and system settings."
        actions={
          canRegister && (
            <Link to="/settings/applications/new">
              <Button leadingIcon={<Icon.Plus width={16} height={16} />}>Register Application</Button>
            </Link>
          )
        }
      />

      <div className={styles.statGrid}>
        <StatCard
          index={0}
          label="Total Applications"
          value={stats?.total ?? null}
          caption="All registered apps"
          icon={<Icon.Grid width={20} height={20} />}
          tone="primary"
          loading={!stats}
        />
        <StatCard
          index={1}
          label="Active Applications"
          value={stats?.active ?? null}
          caption="Currently active"
          icon={<Icon.Check width={20} height={20} />}
          tone="success"
          loading={!stats}
        />
        <StatCard
          index={2}
          label="Inactive Applications"
          value={stats?.inactive ?? null}
          caption="Disabled or in maintenance"
          icon={<Icon.AlertTriangle width={20} height={20} />}
          tone="warning"
          loading={!stats}
        />
        <StatCard
          index={3}
          label="Unreachable"
          value={stats?.unreachable ?? null}
          caption="Not responding to health checks"
          icon={<Icon.Activity width={20} height={20} />}
          tone={stats && stats.unreachable > 0 ? 'danger' : 'neutral'}
          loading={!stats}
        />
      </div>

      <ListToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder="Search applications…"
        filter={{
          label: 'Filter',
          value: statusFilter,
          onChange: (value) => {
            setStatusFilter(value)
            setPage(1)
          },
          options: [
            { value: 'Active', label: 'Active' },
            { value: 'Maintenance', label: 'Maintenance' },
            { value: 'Disabled', label: 'Disabled' },
          ],
        }}
        trailing={
          canEdit && (
            <Button variant="secondary" loading={resyncMutation.isPending} onClick={() => resyncMutation.mutate()}>
              Resync permissions
            </Button>
          )
        }
      />

      {notice && <div className={styles.successBanner}>{notice}</div>}

      <DataTable
        columns={columns}
        rows={apps}
        rowKey={(app) => app.id}
        loading={appsQuery.isPending}
        error={error}
        empty={{
          icon: <Icon.Grid width={22} height={22} />,
          title: search || statusFilter ? 'No applications match these filters' : 'No applications registered yet',
          description:
            search || statusFilter
              ? 'Try a different search term or clear the filter.'
              : 'Register a remote application to make it available in the sidebar.',
          action: canRegister && !search && !statusFilter && (
            <Link to="/settings/applications/new">
              <Button leadingIcon={<Icon.Plus width={16} height={16} />}>Register Application</Button>
            </Link>
          ),
        }}
      />

      {total > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="application" />
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
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)}>
              Remove
            </Button>
          </>
        }
      >
        This removes it from the sidebar for everyone and deactivates its permission in every role. It
        can be re-registered later, but permissions will need to be re-granted.
      </Modal>

      {/* Nested route — renders the create/edit drawer on top of this list. */}
      <Outlet />
    </div>
  )
}
