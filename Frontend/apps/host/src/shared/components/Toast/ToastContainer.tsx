import { useToastStore, type ToastType } from '../../stores/toastStore'
import { Icon } from '../Icon/Icon'
import styles from './ToastContainer.module.css'

function getToastIcon(type: ToastType) {
  switch (type) {
    case 'success':
      return <Icon.CheckCircle width={18} height={18} />
    case 'error':
      return <Icon.AlertCircle width={18} height={18} />
    case 'warning':
      return <Icon.AlertTriangle width={18} height={18} />
    case 'info':
    default:
      return <Icon.Info width={18} height={18} />
  }
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className={styles.toastContainer} role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => {
        const typeClass =
          t.type === 'success'
            ? styles.toastSuccess
            : t.type === 'error'
              ? styles.toastError
              : t.type === 'warning'
                ? styles.toastWarning
                : styles.toastInfo

        const iconClass =
          t.type === 'success'
            ? styles.iconSuccess
            : t.type === 'error'
              ? styles.iconError
              : t.type === 'warning'
                ? styles.iconWarning
                : styles.iconInfo

        return (
          <div key={t.id} className={`${styles.toastItem} ${typeClass}`}>
            <div className={`${styles.iconWrap} ${iconClass}`}>{getToastIcon(t.type)}</div>
            <div className={styles.contentWrap}>
              {t.title && <h4 className={styles.toastTitle}>{t.title}</h4>}
              <p className={styles.toastMessage}>{t.message}</p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
            >
              <Icon.X width={16} height={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
