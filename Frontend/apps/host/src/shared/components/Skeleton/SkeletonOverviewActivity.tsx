import styles from './Skeleton.module.css'

/**
 * Skeleton for a Settings Overview activity list item.
 * Layout matches: colored dot | activity text line | time line
 */
export function SkeletonOverviewActivity() {
  return (
    <div className={styles.activityItemSkel} aria-hidden="true">
      {/* Dot indicator */}
      <div
        className={styles.shimmer}
        style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5 }}
      />
      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '75%' }} />
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '35%' }} />
      </div>
    </div>
  )
}
