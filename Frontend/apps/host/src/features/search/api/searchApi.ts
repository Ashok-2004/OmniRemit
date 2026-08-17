import { env } from '../../../config/env'
import { apiFetch } from '../../../shared/api/httpClient'

const base = env.authServiceUrl

export interface SearchResultDto {
  type: string
  id: string
  title: string
  subtitle: string | null
  /** Host-relative route to open. Built server-side so the client never reconstructs URLs per type. */
  route: string
}

export const searchApi = {
  /** Results are permission-filtered server-side per entity type — never post-filtered on the client. */
  query: (accessToken: string, q: string) =>
    apiFetch<SearchResultDto[]>(`${base}/api/search?q=${encodeURIComponent(q)}`, { accessToken }),
}
