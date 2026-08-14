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
}

/**
 * Thin fetch wrapper shared by every API client (AuthService, ModuleRegistry). Always sends
 * credentials so the httpOnly refresh cookie travels with same-site requests, JSON-encodes a
 * plain object body, and throws ApiError with the server's ProblemDetails title on non-2xx so
 * callers can branch on `.status` instead of re-parsing responses everywhere.
 */
export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, accessToken, headers, ...rest } = options

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
