import type { ReactNode } from 'react'
import { classNames } from '../../utils/classNames'
import styles from './Badge.module.css'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

export interface BadgeProps {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
}

export function Badge({ tone = 'neutral', dot, children }: BadgeProps) {
  return (
    <span className={classNames(styles.badge, styles[tone])}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  )
}
