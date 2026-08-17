import { Icon } from '../Icon/Icon'
import styles from './Pagination.module.css'

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** Noun for the summary line, e.g. "user" — pluralised automatically. */
  itemLabel?: string
}

/** "Showing X to Y of Z" plus prev/page/next, matching the reference list footers. */
export function Pagination({ page, pageSize, total, onPageChange, itemLabel = 'item' }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Clamped so an empty result reads "Showing 0 to 0 of 0" rather than "1 to 0".
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className={styles.wrapper}>
      <span className={styles.summary}>
        Showing {first} to {last} of {total} {itemLabel}
        {total === 1 ? '' : 's'}
      </span>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.arrow}
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          <Icon.ChevronLeft width={16} height={16} />
        </button>

        <span className={styles.page} aria-current="page">
          {page}
        </span>

        <button
          type="button"
          className={styles.arrow}
          disabled={page >= totalPages}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          <Icon.ChevronRight width={16} height={16} />
        </button>
      </div>
    </div>
  )
}
