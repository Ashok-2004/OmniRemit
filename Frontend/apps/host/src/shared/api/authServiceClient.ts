import { env } from '../../config/env'
import { apiFetch } from './httpClient'

const base = env.authServiceUrl

export type AuthProvider = 'Local' | 'Google'

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
  authProvider: AuthProvider
  isActive: boolean
  lastLoginAt: string | null
}

export interface LoginResponse {
  accessToken: string
  expiresAt: string
  user: CurrentUserDto
}

export type RefreshResponse = LoginResponse

export interface SsoConfigDto {
  googleEnabled: boolean
  allowedDomains: string[]
}

/** Raw calls against AuthService's /api/auth/* surface. No token/refresh orchestration here — see features/auth/store/authStore.ts for that. */
/** Mirrors AuthService's PasswordPolicyDto. `description` is generated server-side from the same
 *  options the server validates against, so it can never disagree with what is enforced. */
export interface PasswordPolicyDto {
  minimumLength: number
  maximumLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireDigit: boolean
  requireNonAlphanumeric: boolean
  description: string
}

export const authServiceClient = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>(`${base}/api/auth/login`, { method: 'POST', body: { email, password } }),

  loginWithGoogle: (idToken: string) =>
    apiFetch<LoginResponse>(`${base}/api/auth/google`, { method: 'POST', body: { idToken } }),

  ssoConfig: () => apiFetch<SsoConfigDto>(`${base}/api/auth/sso-config`),

  refresh: () => apiFetch<RefreshResponse>(`${base}/api/auth/refresh`, { method: 'POST' }),

  logout: () => apiFetch<void>(`${base}/api/auth/logout`, { method: 'POST' }),

  me: (accessToken: string) => apiFetch<CurrentUserDto>(`${base}/api/auth/me`, { accessToken }),

  changePassword: (accessToken: string, body: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ message: string; sessionsEnded: number }>(`${base}/api/auth/change-password`, {
      method: 'POST',
      accessToken,
      body,
    }),

  /**
   * The password rules this deployment enforces. Fetched rather than hardcoded: the form used to
   * assert "at least 6 characters" while the server required twelve, so it accepted input the server
   * then rejected.
   */
  passwordPolicy: (accessToken: string) =>
    apiFetch<PasswordPolicyDto>(`${base}/api/auth/password-policy`, { accessToken }),
}
