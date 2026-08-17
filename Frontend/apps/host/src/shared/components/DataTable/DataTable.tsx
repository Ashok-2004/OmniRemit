import type { ReactNode } from 'react'
import { SkeletonTable } from '../Skeleton'
import { EmptyState } from '../EmptyState/EmptyState'
import styles from './DataTable.module.css'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  /** Right-align numeric columns and the trailing actions cell. */
  align?: 'left' | 'right' | 'center'
  /** Fixed width, e.g. '120px'. Left free by default. */
  width?: string
  /** Hidden below ~900px so a wide table degrades by dropping detail rather than scrolling awkwardly. */
  hideOnNarrow?: boolean
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  /** undefined rows = loading. Explicitly separate from empty and error. */
  loading?: boolean
  error?: string | null
  empty?: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }
  onRowClick?: (row: T) => void
}

/**
 * The list table used by Users, Roles and Applications.
 *
 * Exists mainly to make loading / empty / error three visibly distinct states. Each page previously
 * hand-rolled its own `<thead>` and collapsed those states into a single muted line of text, so a
 * registry outage looked identical to "you have no apps" — actively misinforming the reader. Sharing
 * the markup also means the header treatment and row rhythm cannot drift between the three pages.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  empty,
  onRowClick,
}: DataTableProps<T>) {
  if (loading || rows === undefined) {
    return <SkeletonTable rows={6} columns={columns.length} />
  }

  if (error) {
    return (
      <div className={styles.errorState} role="alert">
        {error}
      </div>
    )
  }

  if (rows.length === 0 && empty) {
    return (
      <div className={styles.card}>
        <EmptyState {...empty} />
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`${styles.th} ${styles[column.align ?? 'left']} ${
                    column.hideOnNarrow ? styles.hideOnNarrow : ''
                  }`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? styles.rowClickable : styles.row}
                style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`${styles.td} ${styles[column.align ?? 'left']} ${
                      column.hideOnNarrow ? styles.hideOnNarrow : ''
                    }`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
