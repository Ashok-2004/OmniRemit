import styles from './MaintenancePage.module.css'

export interface MaintenancePageProps {
  appDisplayName: string
  message?: string | null
}

/** Shown instead of loading the remote when an admin has flipped its status to Maintenance in Setup &gt; Maintenance. */
export function MaintenancePage({ appDisplayName, message }: MaintenancePageProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.icon} aria-hidden="true">
        🛠
      </div>
      <h1 className={styles.title}>{appDisplayName} is under maintenance</h1>
      <p className={styles.message}>
        {message?.trim() || 'This app is temporarily unavailable. Please check back shortly.'}
      </p>
    </div>
  )
}
