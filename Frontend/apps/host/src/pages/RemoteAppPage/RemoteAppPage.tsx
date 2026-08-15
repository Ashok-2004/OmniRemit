import { lazy, Suspense, useState, type ComponentType, type LazyExoticComponent } from 'react'
import { useParams } from 'react-router-dom'
import type { SidebarAppDto } from '../../shared/api/moduleRegistryClient'
import { useModuleRegistryStore } from '../../shared/stores/moduleRegistryStore'
import { registerSessionCleanup } from '../../features/auth/store/authStore'
import { loadRemoteAppModule } from '../../shared/federation/remoteLoader'
import { FederationErrorBoundary } from '../../shared/components/ErrorBoundary/FederationErrorBoundary'
import { SkeletonBlock } from '../../shared/components/Skeleton'
import { MaintenancePage } from '../MaintenancePage/MaintenancePage'
import { NotFoundPage } from '../NotFoundPage/NotFoundPage'
import styles from './RemoteAppPage.module.css'

// React.lazy() must return the same component reference across renders or it re-suspends forever
// — cache one lazy-wrapped loader per remote app key for the life of the tab.
const lazyComponentCache = new Map<string, LazyExoticComponent<ComponentType>>()

// Module-level and therefore shared across sign-ins. Evict on logout so the next user does not
// inherit federated components loaded under the previous user's session.
registerSessionCleanup(() => lazyComponentCache.clear())

function getLazyComponent(app: SidebarAppDto) {
  let cached = lazyComponentCache.get(app.key)
  if (!cached) {
    cached = lazy(async () => {
      const mod = await loadRemoteAppModule(app)
      return { default: mod.default }
    })
    lazyComponentCache.set(app.key, cached)
  }
  return cached
}

function LoadingFrame() {
  return (
    <div className={styles.wrapper}>
      <SkeletonBlock height={480} radius="var(--omni-radius-lg)" />
    </div>
  )
}

/**
 * Renders a registered remote app by federation key: Active loads it via Module Federation
 * (registerRemotes/loadRemote against its manifest URL, see shared/federation/remoteLoader.ts),
 * Maintenance shows the admin-authored message instead, and a key the registry doesn't recognize
 * (removed, or never existed) falls through to NotFoundPage.
 */
export function RemoteAppPage() {
  const { appKey } = useParams<{ appKey: string }>()
  const status = useModuleRegistryStore((s) => s.status)
  const app = useModuleRegistryStore((s) => (appKey ? s.getApp(appKey) : undefined))

  if (status === 'idle' || status === 'loading') {
    return <LoadingFrame />
  }

  if (!app) {
    return <NotFoundPage />
  }

  if (app.status === 'Maintenance') {
    return <MaintenancePage appDisplayName={app.displayName} message={app.maintenanceMessage} />
  }

  return <ActiveRemoteApp app={app} />
}

/**
 * Split out so "Try again" can force a real re-render: React.lazy()'s promise is cached forever
 * once it rejects, so retrying has to evict lazyComponentCache's entry AND bump this local key —
 * bumping alone wouldn't help if the cache still held the failed lazy wrapper, and evicting alone
 * wouldn't re-render without something changing.
 */
function ActiveRemoteApp({ app }: { app: SidebarAppDto }) {
  const [attempt, setAttempt] = useState(0)
  const LazyRemote = getLazyComponent(app)

  return (
    <FederationErrorBoundary
      key={attempt}
      appDisplayName={app.displayName}
      onRetry={() => {
        lazyComponentCache.delete(app.key)
        setAttempt((n) => n + 1)
      }}
    >
      <Suspense fallback={<LoadingFrame />}>
        <LazyRemote />
      </Suspense>
    </FederationErrorBoundary>
  )
}
