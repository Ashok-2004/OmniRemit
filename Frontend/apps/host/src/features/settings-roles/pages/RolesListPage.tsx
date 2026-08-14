import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Input } from '../../../shared/components/Input/Input'
import { Badge } from '../../../shared/components/Badge/Badge'
import { Table } from '../../../shared/components/Table/Table'
import { SkeletonTable } from '../../../shared/components/Skeleton'
import { Modal } from '../../../shared/components/Modal/Modal'
import { ApiError } from '../../../shared/api/httpClient'
import { rolesApi, type RoleListItemDto } from '../api/rolesApi'
import styles from './RolesListPage.module.css'

const FEATURE = 'host.settings.roles'
const PAGE_SIZE = 20

export function RolesListPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)

  const [roles, setRoles] = useState<RoleListItemDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<RoleListItemDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canCreate = hasCapability(FEATURE, 'Create')
  const canEdit = hasCapability(FEATURE, 'Edit')
  const canDelete = hasCapability(FEATURE, 'Delete')

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    try {
      const result = await rolesApi.list(accessToken, { pageSize: PAGE_SIZE, search: search || undefined })
      setRoles(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load roles.')
    }
  }, [accessToken, search])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      const token = await ensureFreshAccessToken()
      await rolesApi.remove(token, pendingDelete.id)
      setPendingDelete(null)
      void load()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete this role.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Role</h1>
        <p>Group permissions into roles and assign them to users.</p>
      </div>

      <div className={styles.toolbar}>
        {canCreate && (
          <Link to="/settings/roles/new">
            <Button>+ New Role</Button>
          </Link>
        )}
        <Input
          className={styles.searchInput}
          placeholder="Search roles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {roles === null ? (
        <SkeletonTable rows={6} columns={5} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Users</th>
              <th>Permissions</th>
              {(canEdit || canDelete) && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  No roles found.
                </td>
              </tr>
            )}
            {roles.map((role) => (
              <tr key={role.id}>
                <td>
                  <div className={styles.nameCell}>
                    {canEdit ? (
                      <Link to={`/settings/roles/${role.id}`} className={styles.nameLink}>
                        {role.name}
                      </Link>
                    ) : (
                      <span>{role.name}</span>
                    )}
                    {role.isSystemRole && <Badge tone="neutral">Built-in</Badge>}
                    {role.isAdministrator && <Badge tone="primary">Administrator</Badge>}
                  </div>
                </td>
                <td className={styles.descriptionText} title={role.description ?? undefined}>
                  {role.description ?? '—'}
                </td>
                <td>{role.usersCount}</td>
                <td>{role.isAdministrator ? 'All' : role.permissionsCount}</td>
                {(canEdit || canDelete) && (
                  <td>
                    <div className={styles.actionsCell}>
                      {canDelete && !role.isSystemRole && (
                        <Button size="sm" variant="ghost" onClick={() => setPendingDelete(role)}>
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

      {total > 0 && roles && roles.length < total && (
        <p>
          Showing {roles.length} of {total}.
        </p>
      )}

      <Modal
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name}?`}
        onClose={() => {
          setPendingDelete(null)
          setDeleteError(null)
        }}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </>
        }
      >
        {deleteError ?? "This can't be undone. Roles that are still assigned to users can't be deleted."}
      </Modal>
    </div>
  )
}
