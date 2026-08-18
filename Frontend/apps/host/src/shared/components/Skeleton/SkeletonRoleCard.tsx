import styles from './Skeleton.module.css'

/**
 * Skeleton for a Settings → Roles list card.
 * Layout matches: rounded-square icon | role name + badge | description | edit button
 */
export function SkeletonRoleCard() {
  return (
    <div className={styles.roleCardSkel} aria-hidden="true">
      {/* Rounded-square icon */}
      <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 36, height: 36 }} />

      {/* Name + description */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 100, height: '0.82em' }} />
          <div className={[styles.shimmer, styles.pill].join(' ')} style={{ width: 52, height: 18 }} />
        </div>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 200, height: '0.82em' }} />
      </div>

      {/* Right: edit icon button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 28, height: 28, borderRadius: 8 }} />
        <div className={[styles.shimmer, styles.square].join(' ')} style={{ width: 28, height: 28, borderRadius: 8 }} />
      </div>
    </div>
  )
}
