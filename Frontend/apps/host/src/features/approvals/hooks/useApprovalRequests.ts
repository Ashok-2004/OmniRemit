import { useEffect, useState } from 'react'
import { ApiError } from '../../../shared/api/httpClient'
import type { ApprovalRequestListItemDto } from '../api/approvalsApi'

export interface PagedItems {
  items: ApprovalRequestListItemDto[]
  total: number
}

/**
 * Shared fetch/loading/error/cancellation plumbing behind both ApprovalCenterPage and MyRequestsPage —
 * two independent instances (each call site gets its own state), not shared state. Each page supplies
 * its own `fetcher` (which may itself be a multi-call composition, like Approval Center's dual
 * Approved+Rejected merge for its "Processed" tab) and its own `deps` array of whatever filters should
 * trigger a refetch.
 */
export function useApprovalRequests(
  accessToken: string | null | undefined,
  fetcher: (token: string) => Promise<PagedItems>,
  deps: unknown[],
) {
  const [items, setItems] = useState<ApprovalRequestListItemDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setItems(null)
    setError(null)

    fetcher(accessToken)
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load approval requests.')
        setItems([])
        setTotal(0)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, ...deps])

  return { items, total, error }
}
