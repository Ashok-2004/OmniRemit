import { create } from 'zustand'
import { moduleRegistryClient, type SidebarAppDto } from '../api/moduleRegistryClient'

export type ModuleRegistryStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface ModuleRegistryState {
  status: ModuleRegistryStatus
  apps: SidebarAppDto[]
  error: string | null
  fetchForSidebar: (accessToken: string) => Promise<void>
  getApp: (key: string) => SidebarAppDto | undefined
}

export const useModuleRegistryStore = create<ModuleRegistryState>((set, get) => ({
  status: 'idle',
  apps: [],
  error: null,

  async fetchForSidebar(accessToken) {
    set({ status: 'loading', error: null })
    try {
      const apps = await moduleRegistryClient.forSidebar(accessToken)
      set({ apps, status: 'loaded' })
    } catch {
      // A registry outage shouldn't lock the user out of the whole host — just show an empty
      // sidebar with an inline error rather than blocking the dashboard/settings.
      set({ status: 'error', error: 'Could not load apps. Try refreshing the page.' })
    }
  },

  getApp: (key) => get().apps.find((app) => app.key === key),
}))
