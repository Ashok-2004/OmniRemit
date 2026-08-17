import { useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon/Icon'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useMenuKeyboardNav } from '../../hooks/useMenuKeyboardNav'
import styles from './KebabMenu.module.css'

export interface KebabMenuItem {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  /** Renders in the danger colour — used for destructive actions. */
  danger?: boolean
  disabled?: boolean
}

export interface KebabMenuProps {
  items: KebabMenuItem[]
  label?: string
}

/**
 * Row overflow menu.
 *
 * Reuses the existing click-outside and roving-focus hooks the topbar menus already use, so keyboard
 * behaviour (Escape to close, arrows to move, focus returned to the trigger) is identical across
 * every menu in the app rather than reimplemented per surface.
 */
export function KebabMenu({ items, label = 'More actions' }: KebabMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useClickOutside([wrapperRef], () => setOpen(false), open)
  const handleKeyDown = useMenuKeyboardNav(wrapperRef, () => setOpen(false), triggerRef)

  if (items.length === 0) return null

  return (
    <div className={styles.wrapper} ref={wrapperRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon.MoreHorizontal width={18} height={18} />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={item.danger ? styles.itemDanger : styles.item}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
