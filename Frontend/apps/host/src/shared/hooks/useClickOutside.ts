import { useEffect, type RefObject } from 'react'

/** Calls onOutside when a pointerdown lands outside every given ref — used for dropdown/menu dismissal. */
export function useClickOutside(refs: RefObject<HTMLElement | null>[], onOutside: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      const isInside = refs.some((ref) => ref.current?.contains(target))
      if (!isInside) {
        onOutside()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [refs, onOutside, enabled])
}
