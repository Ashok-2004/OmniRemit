import { create } from 'zustand';

export type C360Page = 'individual' | 'non-individual' | 'audit-logs' | 'customer-360' | 'products' | 'interactions';

interface NavigationState {
  activePage: C360Page;
  setActivePage: (page: C360Page) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activePage: 'individual',
  setActivePage: (page: C360Page) => set({ activePage: page }),
}));
