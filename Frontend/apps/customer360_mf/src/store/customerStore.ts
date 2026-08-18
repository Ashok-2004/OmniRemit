import { create } from 'zustand';
import { api, ApiError } from '../services/api';
import type { CorporateProfile, CustomerProfile, CustomerType, IndividualProfile, ContactDetail } from '../types/api';

// ---------------------------------------------------------------------------
// Request version counter for stale-response prevention.
//
// Race condition scenario (without this fix):
//   1. User searches Customer A  → request #1 starts
//   2. User immediately searches Customer B → request #2 starts
//   3. Request #1 arrives late (network delay)
//   4. Customer A data OVERWRITES Customer B in state ← BUG
//
// Fix: each search increments a version counter. A response is only committed
// to state if the version it captured is still the current version.
// ---------------------------------------------------------------------------
let _searchVersion = 0;

// ---------------------------------------------------------------------------
// Active-customer identifier persistence (sessionStorage).
//
// This store (and this module) is exposed as-is to the Host App via Module
// Federation, so this is the one place a fix here benefits both the
// standalone dev shell and the production, host-embedded module.
//
// Root-cause note: profile/product/interaction state lives only in-memory
// (Zustand). A browser refresh re-initializes the JS heap, so `profile`
// resets to null — pages that gate on `profile` then render an empty/"No
// products found" state even though the CRM still has the data. That is NOT
// fixed by caching the old profile (that would show stale data); instead we
// persist only the resolved CRM identifier (NRIC or BRN) — never profile
// fields — and re-fetch fresh data from the CRM on the next mount.
// ---------------------------------------------------------------------------
const ACTIVE_CUSTOMER_STORAGE_KEY = 'omni_c360_active_customer';

export interface SavedCustomer {
  customerType: CustomerType;
  id: string;
}

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Some embedding contexts (sandboxed iframes) throw on storage access.
    return null;
  }
}

// Persists only the CRM identifier needed to re-fetch — never cached profile data.
export function saveActiveCustomer(customerType: CustomerType, id: string | null | undefined): void {
  const storage = getSessionStorage();
  if (!storage || !id) return;
  try {
    storage.setItem(ACTIVE_CUSTOMER_STORAGE_KEY, JSON.stringify({ customerType, id }));
  } catch {
    // Storage may be full/unavailable — persistence is best-effort only.
  }
}

export function readSavedCustomer(): SavedCustomer | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_CUSTOMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedCustomer> | null;
    if (!parsed || !parsed.id || !parsed.customerType) return null;
    return parsed as SavedCustomer;
  } catch {
    return null;
  }
}

export function clearSavedCustomer(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(ACTIVE_CUSTOMER_STORAGE_KEY);
  } catch {
    // Ignore — nothing meaningful to recover from here.
  }
}

interface CustomerStoreState {
  customerType: CustomerType;
  activeIndividualId: string;
  activeCorporateId: string;

  profile: CustomerProfile | null;
  contactInfo: ContactDetail | null;
  loading: boolean;
  error: string | null;
  /** HTTP status behind `error`, if any — used to classify the message shown to the user */
  errorStatus: number | undefined | null;

  setCustomerType: (type: CustomerType) => void;
  loadActiveProfile: () => Promise<void>;
  loadProfileById: (id: string, type: string, subtype?: string) => Promise<IndividualProfile | null>;
  loadCorporateProfileById: (id: string, type: string) => Promise<CorporateProfile | null>;
}

export const useCustomerStore = create<CustomerStoreState>((set, get) => ({
  customerType: 'individual', // 'individual' or 'corporate'
  activeIndividualId: '',
  activeCorporateId: '',

  profile: null, // Holds active profile details
  contactInfo: null, // Holds contact details
  loading: false,
  error: null,
  errorStatus: null,

  setCustomerType: (type) => {
    set({ customerType: type, profile: null, contactInfo: null, error: null });
    // Only re-fetch if there is actually an id to look up — calling with an
    // empty id previously fired a guaranteed-to-fail request (and set
    // `error`) on every sidebar Individual/Non-Individual toggle.
    const { activeIndividualId, activeCorporateId } = get();
    const hasId = type === 'individual' ? !!activeIndividualId : !!activeCorporateId;
    if (hasId) {
      get().loadActiveProfile();
    }
  },

  loadActiveProfile: async () => {
    const { customerType, activeIndividualId, activeCorporateId } = get();
    const hasId = customerType === 'individual' ? !!activeIndividualId : !!activeCorporateId;
    if (!hasId) {
      // Nothing to load yet — wait for user search or saved session restore
      return;
    }
    const version = ++_searchVersion;
    set({ loading: true, error: null });

    try {
      let profileData: CustomerProfile | null = null;
      let contactData: ContactDetail | null = null;

      if (customerType === 'individual') {
        const profileRes = await api.getIndividualProfile(activeIndividualId);
        profileData = (profileRes.data && profileRes.data[0]) || null;
        contactData = (await api.getContactInfo(activeIndividualId)).data;
      } else {
        const profileRes = await api.getCorporateProfile(activeCorporateId);
        profileData = (profileRes.data && profileRes.data[0]) || null;
        const brn = (profileData as CorporateProfile | null)?.brn || activeCorporateId;
        contactData = (await api.getContactInfo(brn, 'CORPORATE')).data;
      }

      // Discard if a newer search was started while this one was in-flight
      if (version !== _searchVersion) return;

      set({ profile: profileData, contactInfo: contactData, loading: false });
      if (profileData) {
        const savedId =
          customerType === 'individual'
            ? (profileData as IndividualProfile).nationalId
            : (profileData as CorporateProfile).brn;
        saveActiveCustomer(customerType, savedId);
      }
    } catch (err) {
      if (version !== _searchVersion) return;
      const error = err as ApiError;
      set({ error: error.message, errorStatus: error.status, loading: false });
      console.error('Error loading customer profile:', err);
    }
  },

  loadProfileById: async (id, type, subtype = '') => {
    const version = ++_searchVersion;
    set({ loading: true, error: null });
    try {
      const profileRes = await api.getIndividualProfile(id, type, subtype);
      const profileData = (profileRes.data && profileRes.data[0]) || null;
      if (!profileData) {
        throw new Error('No customer found with that search value.');
      }
      const contactRes = await api.getContactInfo(profileData.nationalId as string);
      const contactData = contactRes.data;

      // Discard stale response — user may have triggered another search
      if (version !== _searchVersion) return null;

      set({
        profile: profileData,
        contactInfo: contactData,
        activeIndividualId: profileData.nationalId as string,
        loading: false,
      });
      saveActiveCustomer('individual', profileData.nationalId);
      return profileData;
    } catch (err) {
      if (version !== _searchVersion) return null;
      const error = err as ApiError;
      set({ error: error.message, loading: false });
      throw err;
    }
  },

  loadCorporateProfileById: async (id, type) => {
    const version = ++_searchVersion;
    set({ loading: true, error: null });
    try {
      const profileRes = await api.getCorporateProfile(id, type);
      const profileData = (profileRes.data && profileRes.data[0]) || null;
      if (!profileData) {
        throw new Error('No company found with that search value.');
      }
      const contactRes = await api.getContactInfo(profileData.brn as string, 'CORPORATE');
      const contactData = contactRes.data;

      // Discard stale response
      if (version !== _searchVersion) return null;

      set({
        profile: profileData,
        contactInfo: contactData,
        activeCorporateId: profileData.brn as string,
        loading: false,
      });
      saveActiveCustomer('corporate', profileData.brn);
      return profileData;
    } catch (err) {
      if (version !== _searchVersion) return null;
      const error = err as ApiError;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
}));
