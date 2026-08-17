import { useEffect, useRef, useState } from 'react'

/** True when the OS asks for reduced motion. Live — responds if the user changes the setting. */
export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setPrefers(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return prefers
}

/**
 * Animates a number from 0 up to `target` on mount and whenever `target` changes.
 *
 * Returns `target` immediately — no animation at all — when the user prefers reduced motion, so the
 * value is never withheld for the sake of an effect. Uses requestAnimationFrame with an ease-out
 * curve rather than a timer, so it stays in step with the display and pauses in background tabs.
 */
export function useCountUp(target: number | null | undefined, durationMs = 700): number {
  const reducedMotion = usePrefersReducedMotion()
  const [value, setValue] = useState(0)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (target == null) {
      setValue(0)
      return
    }

    if (reducedMotion || target === 0) {
      setValue(target)
      return
    }

    const start = performance.now()
    const from = 0

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / durationMs, 1)
      // easeOutCubic — fast start, gentle settle, so the final number is readable rather than
      // snapping into place.
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
    }
  }, [target, durationMs, reducedMotion])

  return target == null ? 0 : value
}
