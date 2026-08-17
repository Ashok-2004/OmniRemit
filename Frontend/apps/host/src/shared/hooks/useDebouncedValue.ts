import { useEffect, useState } from 'react'

/**
 * Returns `value` after it has stopped changing for `delayMs`.
 *
 * Used for search inputs. Every filter box in the app previously fed straight into its fetch
 * dependency, so typing "administrator" fired thirteen uncancelled requests — and because nothing
 * cancelled or sequence-checked them, a slow early response could overwrite a fast later one and
 * leave the table showing results for "admin" while the box read "administrator".
 *
 * The input itself stays controlled by the raw value, so typing never feels laggy — only the query
 * waits.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
