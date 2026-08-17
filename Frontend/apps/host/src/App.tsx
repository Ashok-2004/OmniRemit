import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, type Location } from 'react-router-dom'
import { AppShell } from './layout/AppShell/AppShell'
import { RequireAuth } from './features/auth/components/RequireAuth'
import { RequireCapability } from './features/auth/components/RequireCapability'
import { useSilentRefresh } from './features/auth/hooks/useSilentRefresh'
import { useIdleTimeout } from './features/auth/hooks/useIdleTimeout'
import { IdleWarningModal } from './features/auth/components/IdleWarningModal'
import { useAuthStore } from './features/auth/store/authStore'
import { useModuleRegistryStore } from './shared/stores/moduleRegistryStore'
import { useSettingsDrawerStore, type SettingsTab } from './shared/stores/settingsDrawerStore'
import { RouteFallback } from './shared/components/RouteFallback/RouteFallback'
import { lazyWithPreload, preloadWhenIdle } from './shared/utils/lazyWithPreload'

/**
 * Every route is code-split.
 *
 * Previously all thirteen pages were imported statically here, which produced a single ~117KB app
 * chunk plus one ~59KB stylesheet, and index.html preloaded all of it. A user sitting on the login
 * screen was downloading and parsing the audit-logs page, the permission matrix, and all three
 * settings CRUD flows before they had typed a password.
 *
 * AppShell and the route guards stay eager: they are the frame around every authenticated
 * route, so splitting them would only add a waterfall.
 */
// The dashboard is preloadable: it is where nearly every sign-in lands, so its chunk is fetched during
// idle time on the login screen and again the instant the form is submitted, rather than after
// authentication succeeds. That removes the Suspense gap between login and dashboard entirely.
const { Component: DashboardPage, preload: preloadDashboard } = lazyWithPreload(() =>
  import('./pages/DashboardPage/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage').then((m) => ({ default: m.LoginPage })))
const MaintenancePage = lazy(() => import('./pages/MaintenancePage/MaintenancePage').then((m) => ({ default: m.MaintenancePage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const RemoteAppPage = lazy(() => import('./pages/RemoteAppPage/RemoteAppPage').then((m) => ({ default: m.RemoteAppPage })))
const AuditLogsPage = lazy(() => import('./features/system-audit-logs/pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })))
const ProfilePage = lazy(() => import('./features/profile/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))

const FEATURE_KEYS = {
  users: 'host.settings.users',
  roles: 'host.settings.roles',
  applications: 'host.settings.applications',
  auditLogs: 'host.system.audit-logs',
} as const

/**
 * Opens the settings drawer for a `/settings/...` URL, then returns to the dashboard.
 *
 * Users, Roles and Applications used to exist twice over: once as routed full pages and once as tabs
 * inside the gear drawer. Both were live, so the same CRUD was implemented and maintained twice and
 * the two were free to disagree. The drawer is now the only settings UI.
 *
 * These routes are kept rather than deleted so existing bookmarks and links keep working: the URL
 * resolves to the same destination it always did, just rendered as a drawer layer. `replace` is used
 * so the redirect doesn't leave a dead entry that Back would bounce off.
 */
function SettingsDeepLink({ tab }: { tab: SettingsTab }) {
  const { id } = useParams<{ id: string }>()
  const openTab = useSettingsDrawerStore((s) => s.open)
  const pushLayer = useSettingsDrawerStore((s) => s.pushLayer)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    openTab(tab)

    // A trailing /new or /:id opens the corresponding form layer straight away, matching what the
    // old routed form pages did.
    const isNew = location.pathname.endsWith('/new')
    if (isNew || id) {
      const entityId = isNew ? undefined : id
      if (tab === 'users') pushLayer({ type: 'user-form', userId: entityId })
      else if (tab === 'roles') pushLayer({ type: 'role-form', roleId: entityId })
      else if (tab === 'applications') pushLayer({ type: 'app-form', appId: entityId })
    }

    navigate('/', { replace: true })
  }, [tab, id, location.pathname, openTab, pushLayer, navigate])

  return <RouteFallback />
}

function LoginRoute() {
  const status = useAuthStore((s) => s.status)
  const login = useAuthStore((s) => s.login)
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const loginLoading = useAuthStore((s) => s.loginLoading)
  const loginError = useAuthStore((s) => s.loginError)
  // Why the previous session ended (idle timeout, expiry, another tab signing out) — shown so the
  // user isn't dumped on the login screen with no explanation. A real login error takes precedence.
  const sessionExpiredReason = useAuthStore((s) => s.sessionExpiredReason)
  const location = useLocation()

  // The dashboard is the destination in almost every case, so its chunk is fetched while the user is
  // still typing rather than after they authenticate. See the submit handler below for the other half.
  useEffect(() => {
    preloadWhenIdle(preloadDashboard)
  }, [])

  /*
   * Redirect DECLARATIVELY, not from an effect.
   *
   * This previously navigated inside a useEffect, which meant that on a successful sign-in React
   * committed one more render of the login page BEFORE the effect ran and changed the route. The user
   * saw the login screen again — including the error banner from a previous failed attempt, since that
   * banner is part of the same subtree — and only then the dashboard, once its lazy chunk had
   * downloaded. That download is what made the stale screen linger long enough to notice.
   *
   * Returning <Navigate> instead means the moment status flips to authenticated this component
   * renders a redirect and nothing else: the login UI is never painted again.
   */
  if (status === 'authenticated') {
    const from = (location.state as { from?: Pick<Location, 'pathname'> } | null)?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  return (
    <LoginPage
      onSubmit={async (email, password) => {
        // Start the dashboard chunk download in parallel with the login request instead of after it.
        // Both are in flight at once, so the chunk is usually parsed before the token comes back and
        // the post-login Suspense fallback never appears.
        void preloadDashboard()
        await login(email, password)
      }}
      onGoogleCredential={async (idToken) => {
        void preloadDashboard()
        await loginWithGoogle(idToken)
      }}
      loading={loginLoading}
      errorMessage={loginError ?? sessionExpiredReason}
    />
  )
}

function AuthenticatedShell() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasCapability = useAuthStore((s) => s.hasCapability)
  const logout = useAuthStore((s) => s.logout)
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const navigate = useNavigate()

  const registryStatus = useModuleRegistryStore((s) => s.status)
  const registryApps = useModuleRegistryStore((s) => s.apps)
  const registryError = useModuleRegistryStore((s) => s.error)
  const fetchForSidebar = useModuleRegistryStore((s) => s.fetchForSidebar)

  useEffect(() => {
    if (!accessToken) return
    if (registryStatus === 'idle' || (registryStatus === 'error' && registryApps.length === 0)) {
      void ensureFreshAccessToken()
        .then(fetchForSidebar)
        .catch(() => {
          // ensureFreshAccessToken already routes to /login via authStore on failure
        })
    }
  }, [accessToken, registryStatus, registryApps.length, ensureFreshAccessToken, fetchForSidebar])

  // 30 minutes of genuine inactivity, then a 60-second countdown before sign-out. An unattended
  // workstation previously stayed signed in indefinitely — the refresh timer renewed the session
  // forever as long as the tab stayed open.
  const idle = useIdleTimeout({
    enabled: true,
    idleMs: 30 * 60_000,
    warningMs: 60_000,
    onTimeout: () => {
      void logout('You were signed out after a period of inactivity.').then(() =>
        navigate('/login', { replace: true }),
      )
    },
  })

  const isAdministrator = Boolean(user?.isAdministrator)
  const settingsAccess = {
    users: isAdministrator || hasCapability(FEATURE_KEYS.users, 'View'),
    roles: isAdministrator || hasCapability(FEATURE_KEYS.roles, 'View'),
    applications: isAdministrator || hasCapability(FEATURE_KEYS.applications, 'View'),
  }
  const canAccessAuditLogs = isAdministrator || hasCapability(FEATURE_KEYS.auditLogs, 'View')

  return (
    <>
      <AppShell
        apps={registryStatus === 'idle' || registryStatus === 'loading' ? undefined : registryApps}
        appsError={registryError}
        userName={user?.name}
        settingsAccess={settingsAccess}
        canAccessAuditLogs={canAccessAuditLogs}
        onLogout={() => {
          void logout().then(() => navigate('/login', { replace: true }))
        }}
      />
      <IdleWarningModal
        open={idle.warning}
        secondsRemaining={idle.secondsRemaining}
        onStaySignedIn={idle.stayActive}
        onSignOut={() => {
          void logout().then(() => navigate('/login', { replace: true }))
        }}
      />
    </>
  )
}

function AppRoutes() {
  const hydrate = useAuthStore((s) => s.hydrate)
  useSilentRefresh()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />

      <Route
        element={
          <RequireAuth>
            <AuthenticatedShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="apps/:appKey" element={<RemoteAppPage />} />

        <Route
          path="system/audit-logs"
          element={
            <RequireCapability featureKey={FEATURE_KEYS.auditLogs}>
              <AuditLogsPage />
            </RequireCapability>
          }
        />

        {/*
          Settings has no pages of its own — it is the gear drawer, rendered globally by AppShell.
          These routes exist only so old /settings/* links resolve: each opens the drawer on the
          right tab (and the right form layer) and then hands the URL back to the dashboard.

          The capability guards are kept here so an unauthorised deep link is refused at the route,
          exactly as before, rather than opening a drawer that then renders an error inside itself.
        */}
        <Route path="settings">
          <Route index element={<SettingsDeepLink tab="overview" />} />
          {(
            [
              ['users', FEATURE_KEYS.users, 'Create'],
              ['roles', FEATURE_KEYS.roles, 'Create'],
              ['applications', FEATURE_KEYS.applications, 'Register'],
            ] as const
          ).map(([tab, featureKey, createCapability]) => (
            <Route key={tab} path={tab}>
              <Route
                index
                element={
                  <RequireCapability featureKey={featureKey}>
                    <SettingsDeepLink tab={tab} />
                  </RequireCapability>
                }
              />
              <Route
                path="new"
                element={
                  <RequireCapability featureKey={featureKey} capability={createCapability}>
                    <SettingsDeepLink tab={tab} />
                  </RequireCapability>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireCapability featureKey={featureKey} capability="Edit">
                    <SettingsDeepLink tab={tab} />
                  </RequireCapability>
                }
              />
            </Route>
          ))}
        </Route>
      </Route>

        <Route path="/maintenance-preview" element={<MaintenancePage appDisplayName="Example App" />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
