import { SkeletonBlock, SkeletonText } from '../Skeleton'
import styles from './RouteFallback.module.css'

/**
 * Shown while a code-split route chunk downloads.
 *
 * Shaped like a real page — a heading bar and a content block — rather than a bare spinner, so the
 * layout does not visibly jump when the actual page mounts. On a warm cache this is on screen for a
 * frame or two; on a cold first visit to a route it is what stands in for the chunk fetch.
 */
export function RouteFallback() {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>Loading…</span>
      <div className={styles.header}>
        <SkeletonBlock height={28} width={220} />
        <SkeletonBlock height={36} width={120} />
      </div>
      <div className={styles.body}>
        <SkeletonText lines={5} />
      </div>
    </div>
  )
}
