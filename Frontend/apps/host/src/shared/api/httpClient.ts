export class ApiError extends Error {
  status: number

  /**
   * Per-field validation errors from an ASP.NET Core ProblemDetails 400, keyed by field name as the
   * server spells it (PascalCase, e.g. "Email").
   *
   * Without this the UI could only show the response's `title`, which for a validation failure is the
   * generic "One or more validation errors occurred." — it tells the user nothing about which field or
   * what rule. The server already sends the detail; it was simply being discarded here.
   */
  fieldErrors?: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  /**
   * The first message for a field, matched case-insensitively so a caller can ask for `email` and
   * still find the server's `Email`.
   */
  errorFor(field: string): string | undefined {
    if (!this.fieldErrors) return undefined
    const key = Object.keys(this.fieldErrors).find((k) => k.toLowerCase() === field.toLowerCase())
    return key ? this.fieldErrors[key]?.[0] : undefined
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
    const { title, fieldErrors } = await readErrorDetail(response)
    throw new ApiError(response.status, title, fieldErrors)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

/**
 * Reads an ASP.NET Core ProblemDetails body.
 *
 * For a validation failure the useful content is in `errors`, not `title` — the title is always the
 * generic "One or more validation errors occurred.". So when `errors` is present the message is built
 * from the actual field messages, which is what a user needs to see, and the raw map is passed along so
 * a form can attach each message to its own field.
 */
async function readErrorDetail(
  response: Response,
): Promise<{ title: string; fieldErrors?: Record<string, string[]> }> {
  try {
    const problem = (await response.json()) as {
      title?: string
      detail?: string
      errors?: Record<string, string[]>
    }

    const fieldErrors =
      problem.errors && Object.keys(problem.errors).length > 0 ? problem.errors : undefined

    if (fieldErrors) {
      // Deduplicated and joined: several fields failing produces one readable sentence rather than a
      // repeated generic title.
      const messages = [...new Set(Object.values(fieldErrors).flat())]
      return { title: messages.join(' '), fieldErrors }
    }

    return { title: problem.title ?? problem.detail ?? response.statusText }
  } catch {
    return { title: response.statusText || `Request failed with status ${response.status}` }
  }
}
