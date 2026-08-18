import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, type Location } from 'react-router-dom'
import { AppShell } from './layout/AppShell/AppShell'
import { RequireAuth } from './features/auth/components/RequireAuth'
import { RequireCapability } from './features/auth/components/RequireCapability'
import { useSilentRefresh } from './features/auth/hooks/useSilentRefresh'
import { useAuthStore } from './features/auth/store/authStore'
import { useModuleRegistryStore } from './shared/stores/moduleRegistryStore'
import { useSettingsDrawerStore, type SettingsTab } from './shared/stores/settingsDrawerStore'
import { useAuditLogDrawerStore } from './shared/stores/auditLogDrawerStore'
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
// Preloadable: nearly every sign-in lands here, so the chunk is fetched during idle time on the login
// screen and again the instant the form is submitted, removing the Suspense gap after authentication.
const { Component: DashboardPage, preload: preloadDashboard } = lazyWithPreload(() =>
  import('./pages/DashboardPage/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage').then((m) => ({ default: m.LoginPage })))
const MaintenancePage = lazy(() => import('./pages/MaintenancePage/MaintenancePage').then((m) => ({ default: m.MaintenancePage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const RemoteAppPage = lazy(() => import('./pages/RemoteAppPage/RemoteAppPage').then((m) => ({ default: m.RemoteAppPage })))
const ProfilePage = lazy(() => import('./features/profile/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
// AuditLogsPage itself is now rendered by AuditLogDrawer (AppShell), not routed here — see
// AuditLogDeepLink below, which just opens that drawer and hands the URL back to the dashboard.

const FEATURE_KEYS = {
  users: 'host.settings.users',
  roles: 'host.settings.roles',
  applications: 'host.settings.applications',
  auditLogs: 'host.system.audit-logs',
} as const

/**
 * Opens the settings drawer for a `/settings/...` URL, then returns to the dashboard.
 *
 * Users, Roles and Applications used to exist twice over: once as routed full pages behind SetupPanel,
 * and once as tabs inside the gear drawer. Both were live, so the same CRUD was maintained in two
 * places and they had drifted badly — the routed forms never received the validation or the
 * catalog-driven permission grid, which is why every bug reported against those screens reproduced
 * there and not in the drawer.
 *
 * The URLs are kept rather than deleted so bookmarks keep working AND so global search keeps working:
 * SearchAppService builds routes like "/settings/users/{id}" server-side, and this is what turns one
 * into an open drawer. `replace` is used so the redirect leaves no dead history entry for Back to
 * bounce off.
 */
function SettingsDeepLink({ tab }: { tab: SettingsTab }) {
  const { id } = useParams<{ id: string }>()
  const openTab = useSettingsDrawerStore((s) => s.open)
  const pushLayer = useSettingsDrawerStore((s) => s.pushLayer)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    openTab(tab)

    // A trailing /new or /:id opens the matching form layer straight away, which is what the routed
    // form pages used to do.
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

/**
 * Opens the Audit Log drawer for a `/system/audit-logs` URL, then returns to the dashboard.
 *
 * Same reasoning and pattern as SettingsDeepLink above: Audit Logs used to be a routed full page,
 * now it is a global drawer (AuditLogDrawer, rendered by AppShell). The URL is kept working rather
 * than removed so bookmarks and the sidebar's own history entry still resolve.
 */
function AuditLogDeepLink() {
  const openAuditLog = useAuditLogDrawerStore((s) => s.open)
  const navigate = useNavigate()

  useEffect(() => {
    openAuditLog()
    navigate('/', { replace: true })
  }, [openAuditLog, navigate])

  return <RouteFallback />
}

function LoginRoute() {
  const status = useAuthStore((s) => s.status)
  const login = useAuthStore((s) => s.login)
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const loginLoading = useAuthStore((s) => s.loginLoading)
  const loginError = useAuthStore((s) => s.loginError)
  const location = useLocation()

  // The dashboard is where nearly every sign-in lands, so its chunk is fetched while the user is still
  // typing rather than after they authenticate. The submit handlers below start it again on intent.
  useEffect(() => {
    preloadWhenIdle(preloadDashboard)
  }, [])

  /*
   * Redirect DECLARATIVELY, not from an effect.
   *
   * Redirecting inside useEffect meant that on a successful sign-in React committed one more render of
   * the LOGIN page before the effect ran and changed the route. The error banner from a previous failed
   * attempt lives in that same subtree, so it was painted again — and then the lazy DashboardPage chunk
   * had to download before anything replaced it. That download is what made the stale screen linger
   * long enough to read as "it showed the error, then after some time the success page".
   *
   * Returning <Navigate> means the moment status flips to authenticated this component renders a
   * redirect and nothing else: the login UI cannot repaint.
   */
  if (status === 'authenticated') {
    const from = (location.state as { from?: Pick<Location, 'pathname'> } | null)?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  return (
    <LoginPage
      onSubmit={login}
      onGoogleCredential={loginWithGoogle}
      loading={loginLoading}
      errorMessage={loginError}
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
    /*
     * Fetch ONCE per session, on 'idle' only.
     *
     * Retrying on 'error' here was a retry storm, not resilience. The store sets 'error' with an empty
     * app list when the registry is unreachable; `registryStatus` is an effect dependency, so the
     * effect re-ran, saw `error && apps.length === 0`, and fetched again — which set 'loading', which
     * re-ran the effect, forever. Against a downed ModuleRegistry that is an unbounded request loop
     * (netstat showed three simultaneous connection attempts), and because the sidebar renders
     * skeletons whenever status is 'loading', the APPS section sat on grey placeholders through every
     * cycle instead of showing the error state that was already written for it.
     *
     * Hammering a service that is down is also precisely what stops it coming back up. One attempt,
     * then the error state, whose copy already tells the user to refresh.
     */
    if (registryStatus === 'idle') {
      void ensureFreshAccessToken()
        .then(fetchForSidebar)
        .catch(() => {
          // ensureFreshAccessToken already routes to /login via authStore on failure
        })
    }
  }, [accessToken, registryStatus, ensureFreshAccessToken, fetchForSidebar])

  const isAdministrator = Boolean(user?.isAdministrator)
  const settingsAccess = {
    users: isAdministrator || hasCapability(FEATURE_KEYS.users, 'View'),
    roles: isAdministrator || hasCapability(FEATURE_KEYS.roles, 'View'),
    applications: isAdministrator || hasCapability(FEATURE_KEYS.applications, 'View'),
  }
  const canAccessAuditLogs = isAdministrator || hasCapability(FEATURE_KEYS.auditLogs, 'View')

  return (
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
              <AuditLogDeepLink />
            </RequireCapability>
          }
        />

        {/*
          Settings has no pages of its own — it IS the gear drawer, rendered globally by AppShell.

          These routes exist so every /settings/* URL still resolves: each opens the drawer on the right
          tab and, for /new or /:id, pushes the matching form layer, then hands the URL back to the
          dashboard. That keeps bookmarks, the back button and — importantly — global search working,
          since SearchAppService builds "/settings/users/{id}" style routes server-side.

          The routed page components and SetupPanel are gone. They were a second, older implementation
          of the same CRUD, and every bug reported against these screens came from them rather than the
          drawer: the user form there had no validation at all (so it accepted "989898989sssss" and
          "ashok246@gmail.comsssssssss"), and the role form's permission grid still read capabilities off
          the PARENT feature — which for remote.employee declares none, so every column rendered a dash.
          Deleting them is what fixes those, not patching them twice.
        */}
        <Route path="settings">
          <Route index element={<SettingsDeepLink tab="users" />} />
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
