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

  // Product deep-dives
  getDepositProduct: (id: string): Promise<ApiEnvelope<DepositProduct>> =>
    request(`/v1/depositproduct/${encodeURIComponent(id)}`),

  getLoanProduct: (id: string): Promise<ApiEnvelope<LoanProduct>> =>
    request(`/v1/loanproduct/${encodeURIComponent(id)}`),

  getCardProduct: (id: string): Promise<ApiEnvelope<CardsProduct>> =>
    request(`/v1/cardsproduct/${encodeURIComponent(id)}`),

  getGoldProduct: (id: string): Promise<ApiEnvelope<GoldProduct>> =>
    request(`/v1/goldproduct/${encodeURIComponent(id)}`),

  getWmProduct: (id: string): Promise<ApiEnvelope<WmProduct>> =>
    request(`/v1/wmproduct/${encodeURIComponent(id)}`),

  getUnitTrustProduct: (id: string): Promise<ApiEnvelope<UnitTrustProduct>> =>
    request(`/v1/unittrustproduct/${encodeURIComponent(id)}`),

  getWillWritingProduct: (id: string): Promise<ApiEnvelope<WillWritingProduct>> =>
    request(`/v1/willwritingproduct/${encodeURIComponent(id)}`),

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
};
