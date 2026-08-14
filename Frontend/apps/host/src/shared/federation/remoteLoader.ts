import { loadRemote, registerRemotes } from '@module-federation/runtime'
import type { SidebarAppDto } from '../api/moduleRegistryClient'
import type { RemoteAppModule } from './types'

// The host's ModuleFederation instance (name: "omniremit_host") is auto-initialized by the
// @module-federation/vite plugin as part of the app's bootstrap (see vite.config.ts) — we never
// call init() ourselves, only register/load against the instance that's already there.

const registeredKeys = new Set<string>()

/** Registers a remote's manifest URL with the runtime at most once per session — safe to call on every navigation. */
function registerRemoteApp(app: SidebarAppDto) {
  if (registeredKeys.has(app.key)) {
    return
  }

  registerRemotes([{ name: app.key, entry: app.manifestUrl }])
  registeredKeys.add(app.key)
}

/** Registers (if needed) then loads a remote's exposed ./App module. Only call this for Active apps — Maintenance/Disabled never reach this. */
export async function loadRemoteAppModule(app: SidebarAppDto): Promise<RemoteAppModule> {
  registerRemoteApp(app)

  const mod = await loadRemote<RemoteAppModule>(`${app.key}/App`)
  if (!mod?.default) {
    throw new Error(
      `Failed to load "${app.displayName}". Its manifest may be unreachable, or it doesn't expose "./App" as required.`,
    )
  }

  return mod
}
