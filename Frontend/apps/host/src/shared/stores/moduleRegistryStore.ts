import { create } from 'zustand'
import { moduleRegistryClient, type SidebarAppDto } from '../api/moduleRegistryClient'
import { registerSessionCleanup } from '../../features/auth/store/authStore'

export type ModuleRegistryStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface ModuleRegistryState {
  status: ModuleRegistryStatus
  apps: SidebarAppDto[]
  error: string | null
  fetchForSidebar: (accessToken: string) => Promise<void>
  refetch: () => Promise<void>
  getApp: (key: string) => SidebarAppDto | undefined
  /** Wipes cached apps back to the pre-login state. Registered as a session-cleanup handler below. */
  reset: () => void
}

export const useModuleRegistryStore = create<ModuleRegistryState>((set, get) => ({
  status: 'idle',
  apps: [],
  error: null,

  async fetchForSidebar(accessToken) {
    set({ status: 'loading', error: null })
    try {
      const apps = await moduleRegistryClient.forSidebar(accessToken)
      set({ apps, status: 'loaded', error: null })
    } catch (err: unknown) {
      console.warn('ModuleRegistry fetchForSidebar failed:', err)
      // If we already had cached apps, retain them rather than showing a blank broken state
      if (get().apps.length > 0) {
        set({ status: 'loaded', error: null })
      } else {
        set({ status: 'error', error: 'Could not load apps. Try refreshing the page.' })
      }
    }
  },

  async refetch() {
    try {
      const { useAuthStore } = await import('../../features/auth/store/authStore')
      const token = await useAuthStore.getState().ensureFreshAccessToken()
      if (token) {
        await get().fetchForSidebar(token)
      }
    } catch (err) {
      console.warn('ModuleRegistry refetch failed:', err)
    }
  },

  getApp: (key) => get().apps.find((app) => app.key === key),

  reset: () => set({ status: 'idle', apps: [], error: null }),
}))

// Without this, signing out and signing in as someone else showed the PREVIOUS user's sidebar:
// this store kept status 'loaded' across the logout, and App.tsx only fetches when status is
// 'idle', so it never refetched for the new user.
registerSessionCleanup(() => useModuleRegistryStore.getState().reset())
