import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router-dom'
import { AppShell } from './layout/AppShell/AppShell'
import { RequireAuth } from './features/auth/components/RequireAuth'
import { RequireCapability } from './features/auth/components/RequireCapability'
import { useSilentRefresh } from './features/auth/hooks/useSilentRefresh'
import { useAuthStore } from './features/auth/store/authStore'
import { useModuleRegistryStore } from './shared/stores/moduleRegistryStore'
import { SetupPanel } from './layout/SetupPanel/SetupPanel'
import { RouteFallback } from './shared/components/RouteFallback/RouteFallback'

/**
 * Every route is code-split.
 *
 * Previously all thirteen pages were imported statically here, which produced a single ~117KB app
 * chunk plus one ~59KB stylesheet, and index.html preloaded all of it. A user sitting on the login
 * screen was downloading and parsing the audit-logs page, the permission matrix, and all three
 * settings CRUD flows before they had typed a password.
 *
 * AppShell / SetupPanel / the route guards stay eager: they are the frame around every authenticated
 * route, so splitting them would only add a waterfall.
 */
const DashboardPage = lazy(() => import('./pages/DashboardPage/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage').then((m) => ({ default: m.LoginPage })))
const MaintenancePage = lazy(() => import('./pages/MaintenancePage/MaintenancePage').then((m) => ({ default: m.MaintenancePage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const RemoteAppPage = lazy(() => import('./pages/RemoteAppPage/RemoteAppPage').then((m) => ({ default: m.RemoteAppPage })))
const UsersListPage = lazy(() => import('./features/settings-users/pages/UsersListPage').then((m) => ({ default: m.UsersListPage })))
const UserFormPage = lazy(() => import('./features/settings-users/pages/UserFormPage').then((m) => ({ default: m.UserFormPage })))
const RolesListPage = lazy(() => import('./features/settings-roles/pages/RolesListPage').then((m) => ({ default: m.RolesListPage })))
const RoleFormPage = lazy(() => import('./features/settings-roles/pages/RoleFormPage').then((m) => ({ default: m.RoleFormPage })))
const RemoteAppsListPage = lazy(() => import('./features/settings-applications/pages/RemoteAppsListPage').then((m) => ({ default: m.RemoteAppsListPage })))
const RemoteAppFormPage = lazy(() => import('./features/settings-applications/pages/RemoteAppFormPage').then((m) => ({ default: m.RemoteAppFormPage })))
const AuditLogsPage = lazy(() => import('./features/system-audit-logs/pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })))
const ProfilePage = lazy(() => import('./features/profile/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))

const FEATURE_KEYS = {
  users: 'host.settings.users',
  roles: 'host.settings.roles',
  applications: 'host.settings.applications',
  auditLogs: 'host.system.audit-logs',
} as const

function LoginRoute() {
  const status = useAuthStore((s) => s.status)
  const login = useAuthStore((s) => s.login)
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const loginLoading = useAuthStore((s) => s.loginLoading)
  const loginError = useAuthStore((s) => s.loginError)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (status === 'authenticated') {
      const from = (location.state as { from?: Pick<Location, 'pathname'> } | null)?.from?.pathname ?? '/'
      navigate(from, { replace: true })
    }
  }, [status, navigate, location.state])

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
    if (!accessToken || registryStatus !== 'idle') return
    void ensureFreshAccessToken()
      .then(fetchForSidebar)
      .catch(() => {
        // ensureFreshAccessToken already routes to /login via authStore on failure
      })
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
              <AuditLogsPage />
            </RequireCapability>
          }
        />

        <Route path="settings" element={<SetupPanel />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route
            path="users"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.users}>
                <UsersListPage />
              </RequireCapability>
            }
          />
          <Route
            path="users/new"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.users} capability="Create">
                <UserFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="users/:id"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.users} capability="Edit">
                <UserFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="roles"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.roles}>
                <RolesListPage />
              </RequireCapability>
            }
          />
          <Route
            path="roles/new"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.roles} capability="Create">
                <RoleFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="roles/:id"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.roles} capability="Edit">
                <RoleFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="applications"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.applications}>
                <RemoteAppsListPage />
              </RequireCapability>
            }
          />
          <Route
            path="applications/new"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.applications} capability="Create">
                <RemoteAppFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="applications/:id"
            element={
              <RequireCapability featureKey={FEATURE_KEYS.applications} capability="Edit">
                <RemoteAppFormPage />
              </RequireCapability>
            }
          />
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
