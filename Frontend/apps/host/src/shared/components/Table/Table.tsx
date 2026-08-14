import type { ReactNode } from 'react'
import styles from './Table.module.css'

export interface TableProps {
  children: ReactNode
}

/** Horizontal-scroll-safe table shell — column markup stays with each feature, this just guarantees consistent chrome and a bounded scroll container (never a page-wide horizontal scroll). */
export function Table({ children }: TableProps) {
  return (
    <div className={styles.scrollRegion}>
      <table className={styles.table}>{children}</table>
    </div>
  )
}

export { styles as tableStyles }
