import { useCallback, type KeyboardEvent, type RefObject } from 'react'

/**
 * Escape-to-close + Up/Down arrow-key roving focus for a `role="menu"` popover, per the WAI-ARIA
 * menu pattern. Attach the returned handler to the menu container's `onKeyDown` — it walks the
 * container's own `[role="menuitem"]` children, so it works for both `<button>` and `<Link>` items
 * without the caller tracking an index.
 */
export function useMenuKeyboardNav(menuRef: RefObject<HTMLElement | null>, close: () => void, triggerRef?: RefObject<HTMLElement | null>) {
  return useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        triggerRef?.current?.focus()
        return
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return
      }

      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
      if (!items || items.length === 0) {
        return
      }

      event.preventDefault()
      const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement)
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + items.length) % items.length
      items[nextIndex]?.focus()
    },
    [menuRef, close, triggerRef],
  )
}
