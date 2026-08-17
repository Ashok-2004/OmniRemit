import type { ReactNode } from 'react'
import styles from './BarList.module.css'

export interface BarListItem {
  id: string
  label: string
  value: number
  icon?: ReactNode
}

export interface BarListProps {
  items: BarListItem[]
  emptyMessage?: string
}

/**
 * Ranked horizontal bars — icon, name, proportional bar, right-aligned value.
 *
 * Bars are scaled against the largest value rather than the total, so the leader always fills the
 * track and the comparison between rows stays legible even when one item dominates.
 */
export function BarList({ items, emptyMessage = 'Nothing to show yet.' }: BarListProps) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>
  }

  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li className={styles.row} key={item.id} style={{ animationDelay: `${index * 60}ms` }}>
          {item.icon && <span className={styles.icon}>{item.icon}</span>}

          <div className={styles.content}>
            <span className={styles.label}>{item.label}</span>
            <div
              className={styles.track}
              role="meter"
              aria-valuenow={item.value}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={item.label}
            >
              <span className={styles.fill} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>

          <span className={styles.value}>{item.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  )
}
