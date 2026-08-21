import { useEffect, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { usersApi, type UserListItemDto } from '../../features/settings-users/api/usersApi'
import { checkerAssignmentsApi, type AssignableModuleDto } from '../../features/approvals/api/checkerAssignmentsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { ApiError } from '../../shared/api/httpClient'
import { toast } from '../../shared/stores/toastStore'
import styles from './CheckerAssignmentFormLayer.module.css'

interface CheckerAssignmentFormLayerProps {
  /** Pre-selected module, when opened via a specific module card's "Add Checker" button. */
  module?: string
}

/**
 * Assigns one checker to one module. Deliberately a single simple form, not a wizard — there's only
 * two fields — but follows the same header/popLayer/notifyMutation shape every other form layer here
 * uses (UserFormLayer, RoleFormLayer, ApplicationFormLayer) so it reads as the same system.
 */
export function CheckerAssignmentFormLayer({ module: initialModule }: CheckerAssignmentFormLayerProps) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const popLayer = useSettingsDrawerStore((s) => s.popLayer)
  const notifyMutation = useSettingsDrawerStore((s) => s.notifyMutation)

  const [module, setModule] = useState(initialModule ?? '')
  const [modules, setModules] = useState<AssignableModuleDto[]>([])
  const [checkerUserId, setCheckerUserId] = useState('')
  const [users, setUsers] = useState<UserListItemDto[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function loadUsers() {
      try {
        const res = await usersApi.list(accessToken!, { pageSize: 100, isActive: true })
        if (!cancelled) setUsers(res.items.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)))
      } catch (err) {
        console.error('Failed to load users for checker picker:', err)
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    checkerAssignmentsApi
      .listModules(accessToken)
      .then((res) => {
        if (cancelled) return
        setModules(res)
        setModule((current) => current || res[0]?.key || '')
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load assignable modules:', err)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || !checkerUserId) return
    setSaving(true)
    setError(null)
    try {
      const result = await checkerAssignmentsApi.upsert(accessToken, { module, checkerUserId })
      toast.success(`${result.checkerName} is now a checker for '${module}'.`)
      notifyMutation()
      popLayer()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign this checker.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.layer}>
      <div className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <div className={styles.headerIconBox}>
            <Icon.UserCheck width={20} height={20} />
          </div>
          <div>
            <h2 className={styles.title}>Assign Checker</h2>
            <p className={styles.subtitle}>Map a module to an eligible approver</p>
          </div>
        </div>
        <button type="button" className={styles.closeBtn} onClick={popLayer} aria-label="Close">
          <Icon.X width={20} height={20} />
        </button>
      </div>

      {error && <div className={styles.errorAlert}>{error}</div>}

      <form id="checker-assignment-form" onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.contentArea}>
          <div className={styles.formCard}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Module <span className={styles.req}>*</span>
              </label>
              <select className={styles.select} value={module} onChange={(e) => setModule(e.target.value)}>
                {modules.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Checker <span className={styles.req}>*</span>
              </label>
              <select
                className={styles.select}
                value={checkerUserId}
                onChange={(e) => setCheckerUserId(e.target.value)}
                disabled={loadingUsers}
              >
                <option value="">-- Select a user --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <button type="button" className={styles.cancelBtn} onClick={popLayer}>
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn} disabled={saving || !checkerUserId}>
            {saving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Icon.CheckCircle width={16} height={16} />
                <span>Assign Checker</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
