import { useEffect, useState } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore'
import { checkerAssignmentsApi, APPROVAL_MODULES, type CheckerAssignmentDto } from '../../features/approvals/api/checkerAssignmentsApi'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { Modal } from '../../shared/components/Modal/Modal'
import { Button } from '../../shared/components/Button/Button'
import { ApiError } from '../../shared/api/httpClient'
import { toast } from '../../shared/stores/toastStore'
import styles from './SettingsCheckerAssignmentTab.module.css'

/**
 * Admin-only: maps each module to one or more checkers. This is the ONE central configuration
 * surface for the whole Maker-Checker system — every module listed here, whether or not its own
 * mutation endpoints are wired to actually gate on it yet (see APPROVAL_MODULES's `enforced` flag).
 * A module with zero rows below behaves exactly as it always has — nothing is gated until an admin
 * assigns at least one checker.
 */
export function SettingsCheckerAssignmentTab() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAdministrator = Boolean(useAuthStore((s) => s.user)?.isAdministrator)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const pushLayer = useSettingsDrawerStore((s) => s.pushLayer)
  const mutationCount = useSettingsDrawerStore((s) => s.mutationCount)
  const notifyMutation = useSettingsDrawerStore((s) => s.notifyMutation)

  const canManage = isAdministrator || hasCapability('host.system.checker-assignment', 'Manage')

  const [assignments, setAssignments] = useState<CheckerAssignmentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<CheckerAssignmentDto | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await checkerAssignmentsApi.list(accessToken!)
        if (cancelled) return
        setAssignments(res)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load checker assignments.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, mutationCount])

  async function confirmRemove() {
    if (!pendingRemove || !accessToken) return
    setRemoving(true)
    try {
      await checkerAssignmentsApi.remove(accessToken, pendingRemove.id)
      setPendingRemove(null)
      toast.success(`${pendingRemove.checkerName} is no longer a checker for '${pendingRemove.module}'.`)
      notifyMutation()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this checker.')
      setPendingRemove(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Checker Assignment</h3>
          <p className={styles.subtitle}>
            Map each module to one or more checkers. A gated module's sensitive actions become
            approval requests instead of applying directly — see the Approval Center.
          </p>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      <div className={styles.moduleList}>
        {APPROVAL_MODULES.map((mod) => {
          const modAssignments = assignments.filter((a) => a.module === mod.key)
          return (
            <div key={mod.key} className={styles.moduleCard}>
              <div className={styles.moduleHeader}>
                <div className={styles.moduleTitleRow}>
                  <span className={styles.moduleName}>{mod.label}</span>
                  {mod.enforced ? (
                    <span className={styles.enforcedBadge}>Gating active when assigned</span>
                  ) : (
                    <span className={styles.notEnforcedBadge} title="This module's backend isn't wired to gate on assignment yet — planned for a later phase.">
                      Not yet enforced
                    </span>
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => pushLayer({ type: 'checker-assignment-form', module: mod.key })}
                  >
                    <Icon.Plus width={14} height={14} />
                    <span>Add Checker</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className={styles.chipRow}>
                  <span className={styles.mutedText}>Loading…</span>
                </div>
              ) : modAssignments.length === 0 ? (
                <p className={styles.mutedText}>No checkers assigned — this module is not gated.</p>
              ) : (
                <div className={styles.chipRow}>
                  {modAssignments.map((a) => (
                    <span key={a.id} className={styles.checkerChip}>
                      <Icon.UserCheck width={13} height={13} />
                      {a.checkerName}
                      {canManage && (
                        <button
                          type="button"
                          className={styles.chipRemoveBtn}
                          onClick={() => setPendingRemove(a)}
                          aria-label={`Remove ${a.checkerName} as a checker for ${mod.label}`}
                        >
                          <Icon.X width={12} height={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal
        open={Boolean(pendingRemove)}
        title={`Remove ${pendingRemove?.checkerName} as a checker?`}
        onClose={() => setPendingRemove(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingRemove(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={removing} onClick={confirmRemove}>
              Remove
            </Button>
          </>
        }
      >
        {pendingRemove?.checkerName} will no longer be eligible to approve requests for '{pendingRemove?.module}'.
        If they were the only assigned checker, this module becomes ungated — its mutations apply
        directly again, exactly as they did before any checker was assigned.
      </Modal>
    </div>
  )
}
