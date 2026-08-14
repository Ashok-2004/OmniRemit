import type { ComponentType } from 'react'

/**
 * The contract every remote app must satisfy: expose its root as the default export of `./App`
 * in its Module Federation config (see README's "Contract for future remote apps"). The host
 * always calls loadRemote(`${key}/App`) — no per-app configuration of the exposed path.
 */
export interface RemoteAppModule {
  default: ComponentType
}
