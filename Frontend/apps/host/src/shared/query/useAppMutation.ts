import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { useAuthStore } from '../../features/auth/store/authStore'
import { useModuleRegistryStore } from '../stores/moduleRegistryStore'
import { queryKeys } from './queryKeys'

/** Which caches a mutation invalidates. Named rather than raw keys so call sites stay readable. */
export type InvalidationTarget = 'users' | 'roles' | 'applications' | 'auditLogs' | 'permissions'

export interface AppMutationOptions<TArgs, TResult>
  extends Omit<UseMutationOptions<TResult, unknown, TArgs>, 'mutationFn'> {
  /** Receives a guaranteed-fresh access token, so call sites never touch ensureFreshAccessToken. */
  mutationFn: (token: string, args: TArgs) => Promise<TResult>
  invalidates?: InvalidationTarget[]
  /**
   * Set when the mutation can change what the CURRENT user is allowed to do (their own role, or an
   * application's availability). Forces this session's JWT to be reissued so the change applies
   * immediately instead of after the token's natural expiry.
   */
  refreshSession?: boolean
  /**
   * Set when the mutation can change which apps appear in the sidebar. The sidebar is a Zustand
   * store, not a query, so invalidation alone will not touch it.
   */
  refreshSidebar?: boolean
}

/**
 * The app's standard mutation.
 *
 * Exists because none of the CRUD pages had cache invalidation at all — `useMutation` and
 * `invalidateQueries` appeared ZERO times in this codebase. Every page hand-rolled
 * `await api.doThing(); void load()`, which refreshed that one page's own list and nothing else. The
 * visible symptoms were exactly what you'd predict:
 *
 *  - Setting an application to Maintenance updated the table but left the SIDEBAR showing it as
 *    normal until a hard reload, because the sidebar reads a separate store.
 *  - Toggling a user's status refreshed the table but not that page's own Active/Inactive stat
 *    cards, which were loaded by a different effect.
 *  - Creating anything left the dashboard counts stale for the full 30s staleTime.
 *  - "Resync permissions" showed a success banner and refreshed nothing whatsoever.
 *
 * Centralising it means a new mutation gets all of this by declaring what it touches.
 */
export function useAppMutation<TArgs = void, TResult = unknown>({
  mutationFn,
  invalidates = [],
  refreshSession = false,
  refreshSidebar = false,
  onSuccess,
  ...rest
}: AppMutationOptions<TArgs, TResult>) {
  const queryClient = useQueryClient()
  const ensureFreshAccessToken = useAuthStore((s) => s.ensureFreshAccessToken)
  const doRefreshSession = useAuthStore((s) => s.refreshSession)
  const fetchForSidebar = useModuleRegistryStore((s) => s.fetchForSidebar)

  return useMutation<TResult, unknown, TArgs>({
    ...rest,
    mutationFn: async (args: TArgs) => {
      const token = await ensureFreshAccessToken()
      return mutationFn(token, args)
    },
    onSuccess: async (data, variables, context) => {
      const roots: Record<InvalidationTarget, readonly unknown[]> = {
        users: queryKeys.users.all(),
        roles: queryKeys.roles.all(),
        applications: queryKeys.applications.all(),
        auditLogs: queryKeys.auditLogs.all(),
        permissions: queryKeys.permissions.catalog(),
      }

      await Promise.all([
        ...invalidates.map((target) => queryClient.invalidateQueries({ queryKey: roots[target] })),
        // Any create/delete moves a dashboard count, so the dashboard is always invalidated. It is
        // cheap (one aggregate endpoint) and stops the counts silently disagreeing with the lists.
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() }),
      ])

      if (refreshSession) {
        void doRefreshSession()
      }

      if (refreshSidebar) {
        try {
          const token = await ensureFreshAccessToken()
          await fetchForSidebar(token)
        } catch {
          // The mutation itself succeeded; a stale sidebar is not worth surfacing an error for.
        }
      }

      await onSuccess?.(data, variables, context, { client: queryClient, meta: undefined })
    },
  })
}
