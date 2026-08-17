import { useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon/Icon'
import { useClickOutside } from '../../hooks/useClickOutside'
import styles from './ListToolbar.module.css'

export interface FilterOption {
  value: string
  label: string
}

export interface ListToolbarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /**
   * Omit to hide the Filter button entirely. A visible control that filters nothing is worse than
   * no control — the topbar's fake search box was exactly that problem.
   */
  filter?: {
    label: string
    options: FilterOption[]
    /** Empty string means "no filter applied". */
    value: string
    onChange: (value: string) => void
  }
  /** Extra controls rendered to the right, e.g. Resync. */
  trailing?: ReactNode
}

/** Search + a real filter popover, shared by the three list pages. */
export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filter,
  trailing,
}: ListToolbarProps) {
  const [open, setOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  useClickOutside([filterRef], () => setOpen(false), open)

  const activeLabel = filter?.options.find((o) => o.value === filter.value)?.label

  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <span className={styles.searchIcon} aria-hidden="true">
          <Icon.Search width={16} height={16} />
        </span>
        <input
          type="search"
          className={styles.input}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {filter && (
        <div className={styles.filterWrap} ref={filterRef}>
          <button
            type="button"
            className={filter.value ? styles.filterButtonActive : styles.filterButton}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon.Filter width={16} height={16} />
            <span>{activeLabel ?? filter.label}</span>
          </button>

          {open && (
            <div className={styles.menu} role="menu">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={filter.value === ''}
                className={filter.value === '' ? styles.menuItemActive : styles.menuItem}
                onClick={() => {
                  filter.onChange('')
                  setOpen(false)
                }}
              >
                All
              </button>
              {filter.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={filter.value === option.value}
                  className={filter.value === option.value ? styles.menuItemActive : styles.menuItem}
                  onClick={() => {
                    filter.onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </div>
  )
}
