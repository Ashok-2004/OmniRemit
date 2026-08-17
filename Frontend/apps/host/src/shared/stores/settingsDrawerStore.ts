import { create } from 'zustand'

export type SettingsTab = 'users' | 'roles' | 'applications' | 'departments' | 'general'

export type DrawerLayer =
  | { type: 'root'; tab?: SettingsTab }
  | { type: 'role-form'; roleId?: string; initialTab?: string }
  | { type: 'user-form'; userId?: string }
  | { type: 'app-form'; appId?: string }

interface SettingsDrawerState {
  isOpen: boolean
  activeTab: SettingsTab
  layerStack: DrawerLayer[]
  mutationCount: number
  notifyMutation: () => void
  open: (tab?: SettingsTab) => void
  close: () => void
  setActiveTab: (tab: SettingsTab) => void
  pushLayer: (layer: DrawerLayer) => void
  popLayer: () => void
  resetToRoot: (tab?: SettingsTab) => void
}

export const useSettingsDrawerStore = create<SettingsDrawerState>((set, get) => ({
  isOpen: false,
  activeTab: 'users',
  layerStack: [{ type: 'root', tab: 'users' }],
  mutationCount: 0,

  notifyMutation: () => set((s) => ({ mutationCount: s.mutationCount + 1 })),

  open: (tab = 'users') => {
    set({
      isOpen: true,
      activeTab: tab,
      layerStack: [{ type: 'root', tab }],
    })
  },

  close: () => {
    set({
      isOpen: false,
      layerStack: [{ type: 'root', tab: get().activeTab }],
    })
  },

  setActiveTab: (tab) => {
    set({
      activeTab: tab,
      layerStack: [{ type: 'root', tab }],
    })
  },

  pushLayer: (layer) => {
    set((state) => ({
      isOpen: true,
      layerStack: [...state.layerStack, layer],
    }))
  },

  popLayer: () => {
    set((state) => {
      if (state.layerStack.length <= 1) {
        return { isOpen: false, layerStack: [{ type: 'root', tab: state.activeTab }] }
      }
      const newStack = state.layerStack.slice(0, -1)
      const top = newStack[newStack.length - 1]
      return {
        layerStack: newStack,
        activeTab: top.type === 'root' && top.tab ? top.tab : state.activeTab,
      }
    })
  },

  resetToRoot: (tab) => {
    const targetTab = tab ?? get().activeTab
    set({
      activeTab: targetTab,
      layerStack: [{ type: 'root', tab: targetTab }],
    })
  },
}))
