import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  /** Usually an Icon — rendered in a tinted tile so an empty table doesn't read as a broken one. */
  icon?: ReactNode
  title: string
  description?: string
  /** Primary action, e.g. "Register your first application". */
  action?: ReactNode
}

/**
 * Shown when a list is genuinely empty — as distinct from loading (skeleton) or failed (error).
 *
 * Those three states were previously collapsed into a bare line of muted text, so "nothing here
 * yet", "still loading" and "the request failed" all looked broadly the same. Keeping them visually
 * distinct is what stops a registry outage from reading as "you have no apps".
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
