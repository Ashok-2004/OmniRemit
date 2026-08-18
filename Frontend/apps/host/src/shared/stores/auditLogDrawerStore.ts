import { create } from 'zustand'

/**
 * Open/closed state for the system Audit Logs drawer.
 *
 * This used to be a routed page (`/system/audit-logs`) — the one screen left over after the earlier
 * "the drawer is the single settings UI" pass, which covered Users/Roles/Applications but not this.
 * Deliberately a separate store from settingsDrawerStore rather than a fourth tab bolted onto it:
 * Audit Logs is a compliance/security view, not a configuration screen, and settingsDrawerStore's
 * layer-stack (root tabs + override form layers) has no natural slot for it. Kept as simple as the
 * concept actually is — open or closed, nothing else — rather than reusing a shape built for a
 * different problem.
 */
interface AuditLogDrawerState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useAuditLogDrawerStore = create<AuditLogDrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
