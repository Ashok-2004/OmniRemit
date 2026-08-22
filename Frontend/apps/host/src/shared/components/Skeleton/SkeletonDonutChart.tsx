import styles from './Skeleton.module.css'

/**
 * Skeleton for the Dashboard's "Users by Role" donut chart widget.
 * Layout matches: 148px ring | legend rows (dot | name | count) — see
 * DashboardPage.module.css .donutContainer/.donutSvgWrap/.legendList.
 *
 * The widget previously had no loading branch at all: during the stats fetch
 * roleDistribution is [], so the real chart rendered as a bare gray ring with
 * an empty legend — not a skeleton, just the empty state briefly flashing.
 */
export function SkeletonDonutChart() {
  return (
    <div className={styles.donutSkelContainer} aria-hidden="true">
      <div className={styles.donutSkelRingWrap}>
        <svg width="148" height="148" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="54" fill="transparent" stroke="#eaecf0" strokeWidth="18" />
        </svg>
        <div className={styles.donutSkelCenter}>
          <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 28, height: '1.1em' }} />
        </div>
      </div>

      <div className={styles.legendSkelList}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.legendSkelItem}>
            <div className={[styles.shimmer, styles.avatar].join(' ')} style={{ width: 8, height: 8, flexShrink: 0 }} />
            <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: `${60 - i * 8}%` }} />
            <div className={[styles.shimmer, styles.text].join(' ')} style={{ width: 34, marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
