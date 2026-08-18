import styles from './Skeleton.module.css'

/**
 * Skeleton for a stat/metric card (Dashboard + Settings Overview).
 * Layout matches: rounded-square icon | label text | value text
 * Includes a 3px top accent bar matching the real card style.
 */
export function SkeletonStatCard() {
  return (
    <div className={styles.statCardSkel} aria-hidden="true">
      {/* Icon */}
      <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 36, height: 36 }} />

      {/* Label + value */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '65%', height: '0.75em' }} />
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '45%', height: '1.2em', borderRadius: 5 }} />
      </div>
    </div>
  )
}
