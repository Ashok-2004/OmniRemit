import { SkeletonBlock } from '../Skeleton'
import styles from './AppShellSkeleton.module.css'

/**
 * Shown by RequireAuth while hydrate() is resolving the session on a hard refresh — the one moment
 * nothing real (Sidebar, Topbar, AppShell) has mounted yet, so there used to be a single lone
 * skeleton bar floating in an otherwise blank page. This mirrors the real shell's shape (sidebar rail,
 * topbar, hero + stat-card grid — the Dashboard is where almost every session lands) so the real
 * chrome drops in without any visible layout jump a moment later.
 */
export function AppShellSkeleton() {
  return (
    <div className={styles.shell} role="status" aria-live="polite" aria-busy="true">
      <span className="omni-visually-hidden">Loading…</span>

      <aside className={styles.sidebar}>
        <div className={styles.brandRow}>
          <SkeletonBlock width={34} height={34} radius="9px" />
          <SkeletonBlock width={100} height={16} radius="4px" />
        </div>
        <nav className={styles.nav}>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonBlock key={i} height={34} radius="8px" />
          ))}
        </nav>
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <SkeletonBlock width={300} height={38} radius="10px" />
          <div className={styles.topbarActions}>
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonBlock key={i} width={36} height={36} radius="10px" />
            ))}
            <SkeletonBlock width={120} height={38} radius="10px" />
          </div>
        </div>

        <div className={styles.content}>
          <SkeletonBlock height={110} radius="18px" />
          <div className={styles.statGrid}>
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonBlock key={i} height={110} radius="14px" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
