import styles from './Skeleton.module.css'

/**
 * Skeleton for a Settings → Users list card.
 * Layout matches: circle avatar | name + email lines | pill badge | 2 icon buttons
 */
export function SkeletonUserCard() {
  return (
    <div className={styles.userCardSkel} aria-hidden="true">
      {/* Circle avatar */}
      <div className={[styles.shimmer, styles.avatar].join(' ')} style={{ width: 40, height: 40, flexShrink: 0 }} />

      {/* Name + email */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 110, height: '0.82em' }} />
          {/* Role pill */}
          <div className={[styles.shimmer, styles.pill].join(' ')} style={{ width: 58, height: 20 }} />
        </div>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 160, height: '0.82em' }} />
      </div>

      {/* Right: status badge + 2 icon buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div className={[styles.shimmer, styles.pill].join(' ')} style={{ width: 70, height: 24 }} />
        <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 28, height: 28, borderRadius: 8 }} />
        <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 28, height: 28, borderRadius: 8 }} />
      </div>
    </div>
  )
}
