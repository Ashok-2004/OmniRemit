import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../Icon/Icon'
import styles from './Drawer.module.css'

export type DrawerSize = 'sm' | 'md' | 'lg'

export interface DrawerProps {
  open: boolean
  title: string
  /** Sub-line under the title, e.g. "Update role details and manage permissions". */
  description?: string
  size?: DrawerSize
  children?: ReactNode
  /** Pinned to the bottom of the panel and always visible, however long the body scrolls. */
  footer?: ReactNode
  /** Rendered left of the title — used for the wizard back arrow. */
  leading?: ReactNode
  onClose: () => void
}

/** Everything focusable, in DOM order. Queried live so it stays correct as the panel's content changes. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Right-anchored slide-over panel.
 *
 * Built rather than extending `Modal`, which is centred-only, hard-capped at 420px with no way to
 * override, unanimated, un-portaled, and — the part that matters most — has **no focus trap**, so
 * tabbing out of it lands silently on the page behind. A drawer hosts whole multi-step forms, so
 * getting focus, scroll locking and Escape right is the difference between usable and hostile.
 */
export function Drawer({
  open,
  title,
  description,
  size = 'md',
  children,
  footer,
  leading,
  onClose,
}: DrawerProps) {
  // useId, not a literal — `Modal` hardcodes id="modal-title", so two mounted at once produce
  // duplicate ids and every aria-labelledby resolves to whichever won.
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Remember the trigger and restore focus to it on close, so keyboard users are returned to where
  // they were rather than dumped at the top of the document.
  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    // Focus the first real control, falling back to the panel itself so focus is never left outside.
    const focusFirst = () => {
      const target =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current
      target?.focus()
    }
    const raf = requestAnimationFrame(focusFirst)

    return () => {
      cancelAnimationFrame(raf)
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  // Lock background scroll. Without this the page behind scrolls under the panel whenever the
  // pointer leaves it, which reads as the app losing its place.
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        // offsetParent is null for anything display:none — a hidden wizard step must not be a tab stop.
        .filter((el) => el.offsetParent !== null || el === document.activeElement)

      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      // Wrap at both ends, which is what makes this a trap rather than a suggestion.
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  if (!open) return null

  // Portaled to body so the panel is never clipped by an ancestor's overflow or stacking context —
  // a drawer rendered inside the scrolling content region would be trapped by it.
  return createPortal(
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`${styles.panel} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            {leading}
            <div>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && <p className={styles.description}>{description}</p>}
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <Icon.X width={18} height={18} />
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
