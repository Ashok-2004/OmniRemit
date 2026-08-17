import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SkeletonBlock } from '../Skeleton'
import { IconTile, type IconTileTone } from '../IconTile/IconTile'
import { Icon } from '../Icon/Icon'
import { useCountUp } from '../../hooks/useCountUp'
import styles from './StatCard.module.css'

export interface StatTrend {
  /** Percentage change vs the previous period. Negative renders as a decline. */
  percent: number
  /** What the comparison is against, e.g. "vs last 30 days". */
  caption: string
}

export interface StatCardProps {
  label: string
  value: number | null
  /** Static secondary line. Ignored when `trend` is supplied. */
  caption?: string
  /**
   * Real period-over-period change. Deliberately optional and omitted entirely when the backend
   * cannot compute one honestly (no previous-period baseline) — a card with no trend is correct,
   * a card showing a fabricated +100% is not.
   */
  trend?: StatTrend | null
  icon?: ReactNode
  tone?: IconTileTone
  /** Makes the whole card a link into the feature it summarises. */
  to?: string
  loading?: boolean
  /** Staggers the entrance so a row of cards cascades instead of snapping in together. */
  index?: number
}

export function StatCard({
  label,
  value,
  caption,
  trend,
  icon,
  tone = 'primary',
  to,
  loading,
  index = 0,
}: StatCardProps) {
  const animated = useCountUp(value)

  if (loading) {
    return (
      <div className={styles.card} aria-hidden="true">
        <div className={styles.body}>
          <SkeletonBlock height={13} width="55%" />
          <SkeletonBlock height={30} width="35%" />
          <SkeletonBlock height={12} width="70%" />
        </div>
        <SkeletonBlock height={40} width={40} radius="12px" />
      </div>
    )
  }

  const content = (
    <>
      <div className={styles.body}>
        <span className={styles.label}>{label}</span>
        {/* The animated figure is decorative; the accessible name below carries the real number so a
            screen reader never announces a half-counted value. */}
        <span className={styles.value} aria-hidden="true">
          {animated.toLocaleString()}
        </span>
        <span className={styles.srOnly}>
          {label}: {value?.toLocaleString() ?? 'unavailable'}
        </span>

        {trend ? (
          <span className={styles.trendRow}>
            <span className={trend.percent < 0 ? styles.trendDown : styles.trendUp}>
              <Icon.TrendingUp width={14} height={14} />
              {Math.abs(trend.percent)}%
            </span>
            <span className={styles.trendCaption}>{trend.caption}</span>
          </span>
        ) : caption ? (
          <span className={styles.caption}>{caption}</span>
        ) : null}
      </div>

      {icon && (
        <IconTile tone={tone} size="md">
          {icon}
        </IconTile>
      )}
    </>
  )

  const style = { animationDelay: `${index * 70}ms` }

  return to ? (
    <Link to={to} className={`${styles.card} ${styles.interactive}`} style={style}>
      {content}
    </Link>
  ) : (
    <div className={styles.card} style={style}>
      {content}
    </div>
  )
}
