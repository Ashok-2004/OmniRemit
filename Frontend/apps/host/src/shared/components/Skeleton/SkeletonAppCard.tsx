import styles from './Skeleton.module.css'

/**
 * Skeleton for a Settings → Applications list card.
 * Layout matches: rounded-square app icon | name + key | description | status badge | action buttons
 */
export function SkeletonAppCard() {
  return (
    <div className={styles.appCardSkel} aria-hidden="true">
      {/* Rounded-square app icon */}
      <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 38, height: 38 }} />

      {/* App info */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 130, height: '0.82em' }} />
          <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 55, height: '0.82em' }} />
        </div>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 200, height: '0.82em' }} />
      </div>

      {/* Right: status badge + action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div className={[styles.shimmer, styles.pill].join(' ')} style={{ width: 70, height: 24 }} />
        <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 28, height: 28, borderRadius: 8 }} />
        <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 28, height: 28, borderRadius: 8 }} />
        <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 28, height: 28, borderRadius: 8 }} />
      </div>
    </div>
  )
}
