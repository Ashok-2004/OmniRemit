import styles from './Skeleton.module.css'

/**
 * Skeleton for an audit log table row.
 * Layout matches: circle actor avatar | actor name | entity type | action badge | timestamp
 */
export function SkeletonAuditRow() {
  return (
    <div className={styles.auditRowSkel} aria-hidden="true">
      {/* Actor circle avatar */}
      <div className={[styles.shimmer, styles.avatar].join(' ')} style={{ width: 32, height: 32, flexShrink: 0 }} />

      {/* Actor name + email */}
      <div style={{ flex: '0 0 140px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '80%' }} />
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '60%' }} />
      </div>

      {/* Entity type column */}
      <div style={{ flex: '0 0 100px' }}>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '70%' }} />
      </div>

      {/* Action badge — pill shape */}
      <div style={{ flex: '0 0 110px' }}>
        <div className={[styles.shimmer, styles.pill].join(' ')} style={{ width: 90, height: 22 }} />
      </div>

      {/* Timestamp */}
      <div style={{ flex: '0 0 90px', marginLeft: 'auto' }}>
        <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: '80%' }} />
      </div>
    </div>
  )
}
