import { useEffect } from 'react'
import { useAuditLogDrawerStore } from '../../shared/stores/auditLogDrawerStore'
import { RequireCapability } from '../../features/auth/components/RequireCapability'
import { Icon } from '../../shared/components/Icon/Icon'
import { AuditLogsPage } from '../../features/system-audit-logs/pages/AuditLogsPage'
// Reusing the SAME CSS module SettingsDrawer renders from — not a copy, the identical generated
// class names — so this drawer is pixel-for-pixel the same shell (width, animation, gradient header,
// backdrop blur) with zero duplicated CSS to drift out of sync later.
import styles from '../SettingsDrawer/SettingsDrawer.module.css'

const FEATURE = 'host.system.audit-logs'

/**
 * System Audit Logs, as a right-side drawer instead of the routed page it used to be.
 *
 * AuditLogsPage itself is unchanged — its own top-level wrapper (`.page`, a plain flex column with a
 * max-width, no viewport-relative sizing) nests inside this drawer's body exactly as it rendered
 * inside a full route before. Only the surrounding chrome changes.
 */
export function AuditLogDrawer() {
  const isOpen = useAuditLogDrawerStore((s) => s.isOpen)
  const close = useAuditLogDrawerStore((s) => s.close)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close])

  if (!isOpen) return null

  return (
    <div className={styles.overlayRoot}>
      <div className={styles.backdrop} onClick={close} />

      <div className={styles.drawerContainer}>
        <div className={styles.rootPanel}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.headerIcon}>
                <Icon.FileText width={20} height={20} />
              </div>
              <div>
                <h2 className={styles.title}>System Audit Trail</h2>
                <p className={styles.subtitle}>Authentication events, security actions, and platform changes</p>
              </div>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={close}
              aria-label="Close Audit Logs"
            >
              <Icon.X width={20} height={20} />
            </button>
          </div>

          <div className={styles.tabBody}>
            <RequireCapability featureKey={FEATURE}>
              <AuditLogsPage />
            </RequireCapability>
          </div>
        </div>
      </div>
    </div>
  )
}
