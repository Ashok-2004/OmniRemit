import { env } from '../../config/env'
import { apiFetch } from './httpClient'

const base = env.authServiceUrl

export interface CurrentUserDto {
  id: string
  name: string
  email: string
  phoneNumber: string | null
  roleId: string | null
  roleName: string | null
  isAdministrator: boolean
  mustChangePassword: boolean
  permissions: string[]
}

export interface LoginResponse {
  accessToken: string
  expiresAt: string
  user: CurrentUserDto
}

export type RefreshResponse = LoginResponse

/** Raw calls against AuthService's /api/auth/* surface. No token/refresh orchestration here — see features/auth/store/authStore.ts for that. */
export const authServiceClient = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>(`${base}/api/auth/login`, { method: 'POST', body: { email, password } }),

  refresh: () => apiFetch<RefreshResponse>(`${base}/api/auth/refresh`, { method: 'POST' }),

  logout: () => apiFetch<void>(`${base}/api/auth/logout`, { method: 'POST' }),

  me: (accessToken: string) => apiFetch<CurrentUserDto>(`${base}/api/auth/me`, { accessToken }),
}
