import styles from './Skeleton.module.css'

/**
 * Skeleton for a Dashboard app widget row.
 * Layout matches: rounded-square icon | app name line | URL/key line
 */
export function SkeletonDashboardWidget() {
  return (
    <div className={styles.dashWidgetSkel} aria-hidden="true">
      {/* App icon */}
      <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 36, height: 36 }} />
      {/* Name + key */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '55%' }} />
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '40%' }} />
      </div>
      {/* Status pill */}
      <div className={[styles.shimmer, styles.pill].join(' ')} style={{ width: 58, height: 20, flexShrink: 0 }} />
    </div>
  )
}
