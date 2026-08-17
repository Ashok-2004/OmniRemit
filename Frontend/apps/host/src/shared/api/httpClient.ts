export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  accessToken?: string
  /** Internal: set when a call is already a post-refresh retry, so a second 401 cannot loop. */
  _isRetry?: boolean
}

/**
 * Hooks the auth layer into this module without importing it.
 *
 * httpClient is the lowest layer and is imported by every API client; authStore imports those
 * clients. Importing authStore here would close that cycle, so authStore registers its handlers at
 * startup instead.
 */
interface AuthHooks {
  /** Force a token refresh. Resolves with a fresh access token, or rejects if the session is gone. */
  refresh: () => Promise<string>
  /** Tear down the session and send the user to /login with a reason. */
  onSessionExpired: (reason: string) => void
}

let authHooks: AuthHooks | null = null

export function registerAuthHooks(hooks: AuthHooks) {
  authHooks = hooks
}

/** Deduped across concurrent 401s so ten parallel requests trigger exactly one refresh, not ten. */
let inFlightRefresh: Promise<string> | null = null

function refreshOnce(): Promise<string> {
  if (!authHooks) {
    return Promise.reject(new ApiError(401, 'Session expired.'))
  }
  inFlightRefresh ??= authHooks.refresh().finally(() => {
    inFlightRefresh = null
  })
  return inFlightRefresh
}

/**
 * Thin fetch wrapper shared by every API client (AuthService, ModuleRegistry). Always sends
 * credentials so the httpOnly refresh cookie travels with same-site requests, JSON-encodes a
 * plain object body, and throws ApiError with the server's ProblemDetails title on non-2xx so
 * callers can branch on `.status` instead of re-parsing responses everywhere.
 *
 * On a 401 it transparently refreshes once and replays the request. Previously there was NO 401
 * handling anywhere in the app: leave a tab open past the access-token lifetime (or sleep the
 * laptop, which throttles the proactive refresh timer) and every subsequent read failed into a
 * generic "Could not load…" banner. The user was never redirected to /login and no amount of
 * clicking Refresh recovered it — only a full browser reload did, because that re-ran hydrate().
 */
export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, accessToken, headers, _isRetry, ...rest } = options

  const response = await fetch(url, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401 && !_isRetry && accessToken && authHooks) {
    try {
      const freshToken = await refreshOnce()
      return await apiFetch<T>(url, { ...options, accessToken: freshToken, _isRetry: true })
    } catch {
      // The refresh token is gone or rejected — this session is genuinely over. Tear it down and
      // route to /login rather than surfacing an unrecoverable error banner on the current page.
      authHooks.onSessionExpired('Your session expired. Please sign in again.')
      throw new ApiError(401, 'Your session expired. Please sign in again.')
    }
  }

  if (!response.ok) {
    const title = await readErrorTitle(response)
    throw new ApiError(response.status, title)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function readErrorTitle(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { title?: string }
    return problem.title ?? response.statusText
  } catch {
    return response.statusText || `Request failed with status ${response.status}`
  }
}
