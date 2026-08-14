import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router-dom'
import { AppShell } from './layout/AppShell/AppShell'
import { DashboardPage } from './pages/DashboardPage/DashboardPage'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { MaintenancePage } from './pages/MaintenancePage/MaintenancePage'
import { NotFoundPage } from './pages/NotFoundPage/NotFoundPage'
import { RemoteAppPage } from './pages/RemoteAppPage/RemoteAppPage'
import { RequireAuth } from './features/auth/components/RequireAuth'
import { RequireCapability } from './features/auth/components/RequireCapability'
import { useSilentRefresh } from './features/auth/hooks/useSilentRefresh'
import { useAuthStore } from './features/auth/store/authStore'
import { useModuleRegistryStore } from './shared/stores/moduleRegistryStore'
import { SetupPanel } from './layout/SetupPanel/SetupPanel'
import { UsersListPage } from './features/settings-users/pages/UsersListPage'
import { UserFormPage } from './features/settings-users/pages/UserFormPage'
import { RolesListPage } from './features/settings-roles/pages/RolesListPage'
import { RoleFormPage } from './features/settings-roles/pages/RoleFormPage'
import { RemoteAppsListPage } from './features/settings-maintenance/pages/RemoteAppsListPage'
import { RemoteAppFormPage } from './features/settings-maintenance/pages/RemoteAppFormPage'

const SETTINGS_FEATURES = ['host.settings.users', 'host.settings.roles', 'host.settings.maintenance']

function LoginRoute() {
  const status = useAuthStore((s) => s.status)
  const login = useAuthStore((s) => s.login)
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

  return <LoginPage onSubmit={login} loading={loginLoading} errorMessage={loginError} />
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
  const fetchForSidebar = useModuleRegistryStore((s) => s.fetchForSidebar)

  useEffect(() => {
    if (!accessToken || registryStatus !== 'idle') return
    void ensureFreshAccessToken()
      .then(fetchForSidebar)
      .catch(() => {
        // ensureFreshAccessToken already routes to /login via authStore on failure
      })
  }, [accessToken, registryStatus, ensureFreshAccessToken, fetchForSidebar])

  const canAccessSettings =
    Boolean(user?.isAdministrator) || SETTINGS_FEATURES.some((key) => hasCapability(key, 'View'))

  return (
    <AppShell
      apps={registryStatus === 'idle' || registryStatus === 'loading' ? undefined : registryApps}
      userName={user?.name}
      canAccessSettings={canAccessSettings}
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
        <Route path="apps/:appKey" element={<RemoteAppPage />} />

        <Route path="settings" element={<SetupPanel />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route
            path="users"
            element={
              <RequireCapability featureKey="host.settings.users">
                <UsersListPage />
              </RequireCapability>
            }
          />
          <Route
            path="users/new"
            element={
              <RequireCapability featureKey="host.settings.users" capability="Create">
                <UserFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="users/:id"
            element={
              <RequireCapability featureKey="host.settings.users" capability="Edit">
                <UserFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="roles"
            element={
              <RequireCapability featureKey="host.settings.roles">
                <RolesListPage />
              </RequireCapability>
            }
          />
          <Route
            path="roles/new"
            element={
              <RequireCapability featureKey="host.settings.roles" capability="Create">
                <RoleFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="roles/:id"
            element={
              <RequireCapability featureKey="host.settings.roles" capability="Edit">
                <RoleFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="maintenance"
            element={
              <RequireCapability featureKey="host.settings.maintenance">
                <RemoteAppsListPage />
              </RequireCapability>
            }
          />
          <Route
            path="maintenance/new"
            element={
              <RequireCapability featureKey="host.settings.maintenance" capability="Create">
                <RemoteAppFormPage />
              </RequireCapability>
            }
          />
          <Route
            path="maintenance/:id"
            element={
              <RequireCapability featureKey="host.settings.maintenance" capability="Edit">
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
