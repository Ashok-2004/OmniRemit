import type {
  IndividualProfile,
  CorporateProfile,
  ContactDetail,
  CustomerProduct,
  Interaction,
  DepositProduct,
  LoanProduct,
  CardsProduct,
  GoldProduct,
  WmProduct,
  UnitTrustProduct,
  WillWritingProduct,
  LookupOptions,
  AuditLog,
  FieldConfig,
  FieldConfigProfileType,
} from '../types/api';
import { getAccessToken, ensureFreshAccessToken, getCurrentUser, isRunningInHost } from '../api/hostBridge';

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5059';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------
interface ApiEnvelope<T> {
  status: number;
  data: T;
}

interface PaginatedEnvelope<T> extends ApiEnvelope<T[]> {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getLoggedInUser(): string {
  const hostUser = getCurrentUser();
  if (hostUser?.name) return hostUser.name;

  try {
    const rawUser = sessionStorage.getItem('username') || localStorage.getItem('username');
    if (rawUser) return rawUser;
    
    const userObjStr = sessionStorage.getItem('user') || localStorage.getItem('user');
    if (userObjStr) {
      const userObj = JSON.parse(userObjStr);
      if (userObj && userObj.name) return userObj.name;
      if (userObj && userObj.username) return userObj.username;
    }
  } catch (e) {
    // ignore
  }
  return 'Admin User';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;

  if (isRunningInHost()) {
    try {
      token = await ensureFreshAccessToken();
    } catch {
      token = getAccessToken();
    }
  } else {
    token = getAccessToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Staff-User': getLoggedInUser(),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

  // Handle token expiry (401): retry once if running inside host
  if (response.status === 401 && isRunningInHost()) {
    console.warn('[Auth] Token expired in customer360_mf. Requesting fresh token...');
    try {
      token = await ensureFreshAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch (err) {
      console.error('[Auth] Failed to refresh token:', err);
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}) as { detail?: string; message?: string });
    throw new ApiError(errData.detail || errData.message || `HTTP error ${response.status}`, response.status);
  }

  return response.json();
}

export const api = {
  // Search dropdown options config
  getSearchOptions: (): Promise<ApiEnvelope<LookupOptions>> => request('/v1/lookups'),

  // Field-visibility/masking config the detail pages render from — see FieldConfig.cs
  getFieldConfig: (profileType: FieldConfigProfileType): Promise<ApiEnvelope<FieldConfig[]>> =>
    request(`/v1/field-config/${profileType.toLowerCase()}`),

  updateFieldConfig: (
    profileType: FieldConfigProfileType,
    fields: FieldConfig[]
  ): Promise<ApiEnvelope<FieldConfig[]>> =>
    request(`/v1/field-config/${profileType.toLowerCase()}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    }),

  // Individual profile
  getIndividualProfile: (
    id: string,
    type = 'NRIC',
    subtype = ''
  ): Promise<ApiEnvelope<IndividualProfile[]>> =>
    request(
      `/v1/indprofile?type=${type}&id=${encodeURIComponent(id)}${subtype ? `&subtype=${encodeURIComponent(subtype)}` : ''}`
    ),

  // Corporate profile
  getCorporateProfile: (id: string, type = 'BRN'): Promise<ApiEnvelope<CorporateProfile[]>> =>
    request(`/v1/corpprofile?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`),
  getAllCorporateProfiles: (): Promise<ApiEnvelope<CorporateProfile[]>> => request('/v1/corpprofile'),

  // Contact info
  getContactInfo: (id: string, type = ''): Promise<ApiEnvelope<ContactDetail>> =>
    request(`/v1/contactinfo?id=${encodeURIComponent(id)}${type ? `&type=${encodeURIComponent(type)}` : ''}`),

  // Customer products (holdings)
  getCustomerProducts: (
    id: string,
    page = 1,
    size = 10,
    type = ''
  ): Promise<PaginatedEnvelope<CustomerProduct>> =>
    request(
      `/v1/customerproduct?id=${encodeURIComponent(id)}&pageNumber=${page}&pageSize=${size}${type ? `&type=${encodeURIComponent(type)}` : ''}`
    ),

  // Interactions (Cases)
  getCustomerInteractions: (
    id: string,
    page = 1,
    size = 10
  ): Promise<PaginatedEnvelope<Interaction>> =>
    request(`/v1/interactions/${encodeURIComponent(id)}?pageNumber=${page}&pageSize=${size}`),

  // Product deep-dives.
  //
  // Every one of these previously pointed at a URL that does not exist on this backend at all — e.g.
  // `/v1/loanproduct/{id}` — a leftover from an earlier draft that was never reconciled against the
  // real controller (Backend/Customer360Service/Controllers/ProductController.cs). Every real route
  // is `/v1/product/<kind>`, a query string (not a path segment), and needs BOTH the customer's id
  // and the specific product's account/policy number — a customer can hold more than one of a given
  // product type, so the id alone can't identify which one. Confirmed against the controller's own
  // route comments and parameter lists, not guessed.
  getDepositProduct: (id: string, accountNo: string): Promise<ApiEnvelope<DepositProduct>> =>
    request(`/v1/product/deposit?id=${encodeURIComponent(id)}&accountNo=${encodeURIComponent(accountNo)}`),

  getLoanProduct: (id: string, accountNo: string): Promise<ApiEnvelope<LoanProduct>> =>
    request(`/v1/product/loan?id=${encodeURIComponent(id)}&accountNo=${encodeURIComponent(accountNo)}`),

  getCardProduct: (id: string, accountNo: string, cardType: string): Promise<ApiEnvelope<CardsProduct>> =>
    request(
      `/v1/product/cards?id=${encodeURIComponent(id)}&accountNo=${encodeURIComponent(accountNo)}&type=${encodeURIComponent(cardType)}`
    ),

  getGoldProduct: (id: string, accountNo: string): Promise<ApiEnvelope<GoldProduct>> =>
    request(`/v1/product/gold?id=${encodeURIComponent(id)}&accountNo=${encodeURIComponent(accountNo)}`),

  getWmProduct: (id: string, policyNo: string): Promise<ApiEnvelope<WmProduct>> =>
    request(`/v1/product/wm?id=${encodeURIComponent(id)}&policyNo=${encodeURIComponent(policyNo)}`),

  // Unlike the five above, unittrust/willwriting return a LIST (`data: [...]`), not a single object —
  // matches the controller, which calls MapList rather than Map for these two. They also key on
  // `nric`, not `id`.
  getUnitTrustProduct: (nric: string, accountNo: string): Promise<ApiEnvelope<UnitTrustProduct[]>> =>
    request(`/v1/product/unittrust?nric=${encodeURIComponent(nric)}&accountNo=${encodeURIComponent(accountNo)}`),

  getWillWritingProduct: (nric: string, accountNo: string): Promise<ApiEnvelope<WillWritingProduct[]>> =>
    request(`/v1/product/willwriting?nric=${encodeURIComponent(nric)}&accountNo=${encodeURIComponent(accountNo)}`),

  // Audit Logs
  getAuditLogs: (params: { search?: string; action?: string; pageNumber?: number; pageSize?: number } = {}): Promise<PaginatedEnvelope<AuditLog>> => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.action) query.append('action', params.action);
    if (params.pageNumber) query.append('pageNumber', params.pageNumber.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    return request(`/v1/audit?${query.toString()}`);
  },

  createAuditLog: (data: Partial<AuditLog>): Promise<ApiEnvelope<void>> =>
    request('/v1/audit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Alias — several call sites across this app were written against `logAudit`, a method that has
  // never existed on this object. Every one of those calls threw `TypeError: api.logAudit is not a
  // function`, silently (they're all wrapped in try/catch that only logs to the console), so every
  // "viewed sensitive data" / "searched" audit entry for this app has never actually been written.
  // Aliasing here fixes every call site in one place instead of renaming each one individually.
  logAudit(data: Partial<AuditLog>): Promise<ApiEnvelope<void>> {
    return this.createAuditLog(data);
  },
};
