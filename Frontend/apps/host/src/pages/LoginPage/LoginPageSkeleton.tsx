import { SkeletonBlock } from '../../shared/components/Skeleton'
import styles from './LoginPageSkeleton.module.css'

/**
 * Suspense fallback for the /login route's lazy chunk (see App.tsx's nested Suspense in LoginRoute).
 * On a cold visit — the very first thing loaded this session — RouteFallback's generic header+body
 * shape flashed before the real split-panel login screen, a "wrong page shape" glitch. This mirrors
 * the real layout instead: the hero's gradient background paints immediately (it's CSS), and the
 * white card side shows placeholders shaped like the real brand row, title, two inputs and the button.
 */
export function LoginPageSkeleton() {
  return (
    <div className={styles.page} role="status" aria-live="polite" aria-busy="true">
      <span className="omni-visually-hidden">Loading…</span>

      <div className={styles.hero}>
        <div className={styles.heroBrandRow}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.16)', border: '1.5px solid rgba(255,255,255,0.3)' }} />
          <div style={{ width: 90, height: 15, borderRadius: 4, background: 'rgba(255,255,255,0.25)' }} />
        </div>
        <div className={styles.heroLines}>
          <div style={{ width: '85%', height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.18)' }} />
          <div style={{ width: '55%', height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.18)' }} />
          <div style={{ width: '70%', height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.card}>
          <div className={styles.cardBrandRow}>
            <SkeletonBlock width={40} height={40} radius="8px" />
            <SkeletonBlock width={90} height={16} radius="4px" />
          </div>

          <SkeletonBlock width={160} height={22} radius="5px" />

          <div className={styles.fieldGroup}>
            <SkeletonBlock width={90} height={12} radius="4px" />
            <SkeletonBlock height={48} radius="12px" />
          </div>

          <div className={styles.fieldGroup}>
            <SkeletonBlock width={70} height={12} radius="4px" />
            <SkeletonBlock height={48} radius="12px" />
          </div>

          <SkeletonBlock height={48} radius="12px" />
        </div>
      </div>
    </div>
  )
}
