import { create } from 'zustand';
import { LeadFormData, FormValidationErrors, NavigationPage, LeadRecord, DropdownOption, AuditRecord } from '../types/lead';
import {
  apiClient,
  isApprovalPending,
  KpiSummary,
  TimeSeriesPoint,
  ProductDistribution,
  BranchDistribution,
  DashboardFilterParams,
} from '../api/apiClient';

interface ToastState {
  show: boolean;
  title: string;
  message: string;
  errorsList?: string[];
  type: 'success' | 'info' | 'warning' | 'error';
  payload?: any;
}

export interface FilterRule {
  id: string;
  field: string;
  value: string;
}

interface LeadStoreState {
  // Navigation
  activePage: NavigationPage;
  setActivePage: (page: NavigationPage) => void;
  isSidebarExpanded: boolean;
  toggleSidebar: () => void;

  // Master Data Options (Dynamic from Backend API)
  products: DropdownOption[];
  states: DropdownOption[];
  branches: DropdownOption[];
  salesExecutives: DropdownOption[];
  propertyTypes: DropdownOption[];
  propertyStatuses: DropdownOption[];
  entityTypes: DropdownOption[];
  isLoadingMasterData: boolean;

  fetchMasterData: () => Promise<void>;
  fetchBranches: (stateName?: string, query?: string) => Promise<void>;
  fetchSalesExecutives: (query?: string) => Promise<void>;

  // Form State
  formData: LeadFormData;
  setFieldValue: <K extends keyof LeadFormData>(field: K, value: LeadFormData[K]) => void;
  setProduct: (product: string) => void;
  resetForm: () => void;

  // Validation
  errors: FormValidationErrors;
  validateForm: () => boolean;
  validateField: (field: keyof LeadFormData, value?: any) => void;
  clearError: (field: keyof LeadFormData) => void;

  // Lead Submission
  isSubmitting: boolean;
  submitLead: () => Promise<boolean>;

  // Toast Notifications
  toast: ToastState | null;
  showToast: (toast: Omit<ToastState, 'show'>) => void;
  hideToast: () => void;

  // Lead Directory (Dynamic from Backend API)
  leads: LeadRecord[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  isLoadingLeads: boolean;
  searchQuery: string;
  selectedProductFilter: string;
  selectedStateFilter: string;
  filterRules: FilterRule[];

  addFilterRule: () => void;
  removeFilterRule: (id: string) => void;
  updateFilterRule: (id: string, field: string, value: string) => void;
  applyFilters: () => void;
  clearAllFilters: () => void;

  setSearchQuery: (query: string) => void;
  setSelectedProductFilter: (product: string) => void;
  setSelectedStateFilter: (state: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  clearFilters: () => void;
  fetchLeads: () => Promise<void>;

  // Dashboard State (Dynamic Analytics from Backend API)
  dashboardDatePreset: string;
  dashboardStartDate: string;
  dashboardEndDate: string;
  dashboardProduct: string;
  dashboardBranch: string;
  dashboardGranularity: 'daily' | 'weekly' | 'monthly';

  kpiSummary: KpiSummary;
  leadsOverTime: TimeSeriesPoint[];
  leadsByProduct: ProductDistribution[];
  leadsByBranch: BranchDistribution[];
  recentLeads: LeadRecord[];
  isLoadingDashboard: boolean;

  setDashboardDatePreset: (preset: string) => void;
  setDashboardDateRange: (startDate: string, endDate: string) => void;
  setDashboardProduct: (product: string) => void;
  setDashboardBranch: (branch: string) => void;
  setDashboardGranularity: (granularity: 'daily' | 'weekly' | 'monthly') => void;
  resetDashboardFilters: () => void;
  fetchDashboardData: () => Promise<void>;

  // Lead Drawers
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  selectedLead: LeadRecord | null;
  isDetailsDrawerOpen: boolean;
  openDetailsDrawer: (lead: LeadRecord) => void;
  closeDetailsDrawer: () => void;

  // Edit Lead State
  isEditReasonOpen: boolean;
  isEditLeadOpen: boolean;
  editLeadTarget: LeadRecord | null;
  editReason: string;
  editFormData: LeadFormData;
  editErrors: FormValidationErrors;
  isConfirmingEdit: boolean;

  openEditWorkflow: (lead: LeadRecord) => void;
  closeEditReasonDrawer: () => void;
  proceedToEditLead: (reason: string) => void;
  setEditFieldValue: <K extends keyof LeadFormData>(field: K, value: LeadFormData[K]) => void;
  validateEditForm: () => boolean;
  submitEditLead: (reason: string) => Promise<boolean>;
  closeEditLeadDrawer: () => void;
  setIsConfirmingEdit: (val: boolean) => void;

  // Delete Lead State
  isDeleteReasonOpen: boolean;
  isDeleteConfirmOpen: boolean;
  deleteLeadTarget: LeadRecord | null;
  deleteReason: string;

  openDeleteWorkflow: (lead: LeadRecord) => void;
  closeDeleteReasonDrawer: () => void;
  proceedToDeleteConfirm: (reason: string) => void;
  backToDeleteReason: () => void;
  confirmDeleteLead: () => Promise<boolean>;
  closeDeleteWorkflow: () => void;

  // Audit Logs State
  auditLogs: AuditRecord[];
  totalAuditRecords: number;
  auditPage: number;
  auditPageSize: number;
  auditSearchQuery: string;
  auditActionFilter: string;
  isLoadingAuditLogs: boolean;
  selectedAuditLog: AuditRecord | null;
  isAuditDetailsOpen: boolean;

  fetchAuditLogs: () => Promise<void>;
  openAuditDetails: (log: AuditRecord) => void;
  closeAuditDetails: () => void;
  setAuditPage: (page: number) => void;
  setAuditSearchQuery: (query: string) => void;
  setAuditActionFilter: (action: string) => void;
}

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  product: 'Product',
  customerName: 'Customer Name',
  icNumber: 'IC Number',
  phoneNumber: 'Phone Number',
  email: 'Email',
  state: 'State',
  preferredBranch: 'Preferred Servicing Branch',
  employerName: 'Employer Name',
  appliedAmount: 'Applied Amount',
  preferredSalesExecutive: 'Preferred Sales Executive',
  propertyType: 'Property Type',
  propertyStatus: 'Property Status',
  dateOfIncorporation: 'Date of Incorporation',
  companyName: 'Company Name',
  entityType: 'Entity Type',
  marketingConsent: 'Marketing Consent',
  agreedToPrivacyPolicy: 'Privacy Policy Agreement',
};

export const getEmptyErrorMessage = (field: string): string => {
  const name = FIELD_DISPLAY_NAMES[field] || field;
  return `Please enter the ${name}`;
};

export const getIncorrectErrorMessage = (field: string): string => {
  const name = FIELD_DISPLAY_NAMES[field] || field;
  return `Please enter the ${name} correctly.`;
};

const initialFormData: LeadFormData = {
  product: '',
  customerName: '',
  icNumber: '',
  phoneCountryCode: '+60',
  phoneNumber: '',
  email: '',
  state: '',
  preferredBranch: '',
  employerName: '',
  appliedAmount: '',
  hasPreferredSalesExecutive: false,
  preferredSalesExecutive: '',
  propertyType: '',
  propertyStatus: '',
  dateOfIncorporation: '',
  companyName: '',
  entityType: '',
  marketingConsent: '',
  agreedToPrivacyPolicy: false,
};

const initialKpiSummary: KpiSummary = {
  totalLeads: 0,
  newLeads: 0,
  inProgressLeads: null,
  convertedLeads: 0,
  conversionRate: null,
};

export const useLeadStore = create<LeadStoreState>((set, get) => ({
  activePage: 'dashboard',
  setActivePage: (page) => {
    set({ activePage: page });
    if (page === 'view-lead') {
      get().fetchLeads();
    } else if (page === 'dashboard') {
      get().fetchDashboardData();
    } else if (page === 'audit-logs') {
      get().fetchAuditLogs();
    }
  },
  isSidebarExpanded: true,
  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),

  // Master Data Options
  products: [],
  states: [],
  branches: [],
  salesExecutives: [],
  propertyTypes: [],
  propertyStatuses: [],
  entityTypes: [],
  isLoadingMasterData: false,

  fetchMasterData: async () => {
    set({ isLoadingMasterData: true });
    try {
      const [products, states, referenceData, salesExecs] = await Promise.all([
        apiClient.getProducts(),
        apiClient.getStates(),
        apiClient.getReferenceData(),
        apiClient.getSalesExecutives(),
      ]);

      set({
        products,
        states,
        propertyTypes: referenceData.propertyTypes,
        propertyStatuses: referenceData.propertyStatuses,
        entityTypes: referenceData.entityTypes,
        salesExecutives: salesExecs,
        isLoadingMasterData: false,
      });

      get().fetchBranches();
    } catch (err) {
      console.error('Failed to load master data:', err);
      set({ isLoadingMasterData: false });
    }
  },

  fetchBranches: async (stateName, query) => {
    try {
      const branches = await apiClient.getBranches(stateName, query);
      set({ branches });
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      set({ branches: [] });
    }
  },

  fetchSalesExecutives: async (query) => {
    try {
      const salesExecutives = await apiClient.getSalesExecutives(query);
      set({ salesExecutives });
    } catch (err) {
      console.error('Failed to fetch sales executives:', err);
    }
  },

  // Form State
  formData: initialFormData,

  setFieldValue: (field, value) => {
    set((state) => {
      const updatedErrors = { ...state.errors };
      delete updatedErrors[field];
      const newFormData = { ...state.formData, [field]: value };

      if (field === 'state') {
        newFormData.preferredBranch = '';
        get().fetchBranches(value as string);
      }

      return {
        formData: newFormData,
        errors: updatedErrors,
      };
    });
    get().validateField(field, value);
  },

  setProduct: (product) => {
    set((state) => ({
      formData: {
        ...state.formData,
        product,
        propertyType: '',
        propertyStatus: '',
        dateOfIncorporation: '',
        companyName: '',
        entityType: '',
      },
      errors: {},
    }));
  },

  resetForm: () => set({ formData: initialFormData, errors: {} }),

  // Validation
  errors: {},

  validateField: (field, value) => {
    set((state) => {
      const errors = { ...state.errors };
      const val = value !== undefined ? value : state.formData[field];

      const isValEmpty = val === undefined || val === null || (typeof val === 'string' && !val.trim()) || val === false;

      const requiredFields: (keyof LeadFormData)[] = [
        'product', 'customerName', 'icNumber', 'phoneNumber', 'email', 'state', 'employerName', 'appliedAmount', 'marketingConsent', 'agreedToPrivacyPolicy'
      ];
      if (state.formData.hasPreferredSalesExecutive) requiredFields.push('preferredSalesExecutive');
      if (state.formData.product === 'Home Financing') requiredFields.push('propertyType', 'propertyStatus');
      if (state.formData.product === 'Micro Finance') requiredFields.push('dateOfIncorporation', 'companyName', 'entityType');

      if (isValEmpty && requiredFields.includes(field)) {
        errors[field] = getEmptyErrorMessage(field as string);
        return { errors };
      }

      switch (field) {
        case 'icNumber':
          if (val && typeof val === 'string' && val.trim()) {
            if (!/^\d{6}-\d{2}-\d{4}$/.test(val.trim())) {
              errors.icNumber = getIncorrectErrorMessage('icNumber');
            } else {
              delete errors.icNumber;
            }
          }
          break;
        case 'phoneNumber':
          if (val && typeof val === 'string' && val.trim()) {
            const fullPhone = `${state.formData.phoneCountryCode}${val.trim().replace(/\s|-/g, '')}`;
            if (!/^\+60[1-9]\d{7,9}$/.test(fullPhone)) {
              errors.phoneNumber = getIncorrectErrorMessage('phoneNumber');
            } else {
              delete errors.phoneNumber;
            }
          }
          break;
        case 'email':
          if (val && typeof val === 'string' && val.trim()) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
              errors.email = getIncorrectErrorMessage('email');
            } else {
              delete errors.email;
            }
          }
          break;
        default:
          if (val && typeof val === 'string' && val.trim()) {
            delete errors[field];
          }
          break;
      }

      return { errors };
    });
  },

  clearError: (field) => {
    set((state) => {
      const updatedErrors = { ...state.errors };
      delete updatedErrors[field];
      return { errors: updatedErrors };
    });
  },

  validateForm: () => {
    const { formData } = get();
    const errors: FormValidationErrors = {};

    if (!formData.product) {
      errors.product = getEmptyErrorMessage('product');
    }

    if (!formData.customerName.trim()) {
      errors.customerName = getEmptyErrorMessage('customerName');
    }

    if (!formData.icNumber.trim()) {
      errors.icNumber = getEmptyErrorMessage('icNumber');
    } else if (!/^\d{6}-\d{2}-\d{4}$/.test(formData.icNumber.trim())) {
      errors.icNumber = getIncorrectErrorMessage('icNumber');
    }

    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = getEmptyErrorMessage('phoneNumber');
    } else {
      const fullPhone = `${formData.phoneCountryCode}${formData.phoneNumber.trim().replace(/\s|-/g, '')}`;
      if (!/^\+60[1-9]\d{7,9}$/.test(fullPhone)) {
        errors.phoneNumber = getIncorrectErrorMessage('phoneNumber');
      }
    }

    if (!formData.email.trim()) {
      errors.email = getEmptyErrorMessage('email');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = getIncorrectErrorMessage('email');
    }

    if (!formData.state) {
      errors.state = getEmptyErrorMessage('state');
    }

    if (!formData.employerName.trim()) {
      errors.employerName = getEmptyErrorMessage('employerName');
    }

    if (!formData.appliedAmount.trim()) {
      errors.appliedAmount = getEmptyErrorMessage('appliedAmount');
    }

    if (formData.hasPreferredSalesExecutive && !formData.preferredSalesExecutive.trim()) {
      errors.preferredSalesExecutive = getEmptyErrorMessage('preferredSalesExecutive');
    }

    if (formData.product === 'Home Financing') {
      if (!formData.propertyType) {
        errors.propertyType = getEmptyErrorMessage('propertyType');
      }
      if (!formData.propertyStatus) {
        errors.propertyStatus = getEmptyErrorMessage('propertyStatus');
      }
    }

    if (formData.product === 'Micro Finance') {
      if (!formData.dateOfIncorporation) {
        errors.dateOfIncorporation = getEmptyErrorMessage('dateOfIncorporation');
      }
      if (!formData.companyName.trim()) {
        errors.companyName = getEmptyErrorMessage('companyName');
      }
      if (!formData.entityType) {
        errors.entityType = getEmptyErrorMessage('entityType');
      }
    }

    if (!formData.marketingConsent) {
      errors.marketingConsent = getEmptyErrorMessage('marketingConsent');
    }

    if (!formData.agreedToPrivacyPolicy) {
      errors.agreedToPrivacyPolicy = getEmptyErrorMessage('agreedToPrivacyPolicy');
    }

    set({ errors });

    const isValid = Object.keys(errors).length === 0;
    if (!isValid) {
      const errorList = Object.values(errors).filter(Boolean) as string[];
      get().showToast({
        type: 'error',
        title: 'Please correct the following errors:',
        message: '',
        errorsList: errorList,
      });
    }

    return isValid;
  },

  // Submit Lead
  isSubmitting: false,
  submitLead: async () => {
    const isValid = get().validateForm();
    if (!isValid) return false;

    set({ isSubmitting: true });
    try {
      const response = await apiClient.createLead(get().formData);
      set({ isSubmitting: false });

      if (response.success) {
        if (isApprovalPending(response.data)) {
          // Nothing was actually created — the "Lead" module has a checker assigned, so this
          // submission is queued instead of applied. No list/dashboard refresh: nothing changed yet.
          get().showToast({
            type: 'info',
            title: 'Submitted for Approval',
            message: response.data.message || 'This lead requires approval before it is created.',
          });
          get().resetForm();
          return true;
        }
        get().showToast({
          type: 'success',
          title: 'Success',
          message: 'Lead submitted successfully',
        });
        get().resetForm();
        get().fetchLeads();
        get().fetchDashboardData();
        return true;
      } else {
        get().showToast({
          type: 'error',
          title: 'Submission Failed',
          message: response.message || 'Failed to submit lead.',
        });
        if (response.errors) {
          set({ errors: response.errors as FormValidationErrors });
        }
        return false;
      }
    } catch (err: any) {
      set({ isSubmitting: false });
      get().showToast({
        type: 'error',
        title: 'System Error',
        message: err?.message || 'Could not connect to backend server.',
      });
      return false;
    }
  },

  // Toast Notifications
  toast: null,
  showToast: (toast) => set({ toast: { ...toast, show: true } }),
  hideToast: () => set({ toast: null }),

  // Lead Directory
  leads: [],
  totalRecords: 0,
  totalPages: 1,
  currentPage: 1,
  pageSize: 10,
  isLoadingLeads: false,
  searchQuery: '',
  selectedProductFilter: '',
  selectedStateFilter: '',
  filterRules: [{ id: '1', field: 'product', value: '' }],

  addFilterRule: () => {
    set((state) => ({
      filterRules: [
        ...state.filterRules,
        { id: Date.now().toString(), field: 'salesExecutive', value: '' },
      ],
    }));
  },

  removeFilterRule: (id) => {
    set((state) => {
      const updated = state.filterRules.filter((r) => r.id !== id);
      return { filterRules: updated.length > 0 ? updated : [{ id: Date.now().toString(), field: 'product', value: '' }] };
    });
  },

  updateFilterRule: (id, field, value) => {
    set((state) => ({
      filterRules: state.filterRules.map((r) =>
        r.id === id ? { ...r, field, value } : r
      ),
    }));
  },

  applyFilters: () => {
    set({ currentPage: 1 });
    get().fetchLeads();
  },

  clearAllFilters: () => {
    set({
      searchQuery: '',
      selectedProductFilter: '',
      selectedStateFilter: '',
      filterRules: [{ id: '1', field: 'product', value: '' }],
      currentPage: 1,
    });
    get().fetchLeads();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query, currentPage: 1 });
    get().fetchLeads();
  },

  setSelectedProductFilter: (product) => {
    set({ selectedProductFilter: product, currentPage: 1 });
    get().fetchLeads();
  },

  setSelectedStateFilter: (stateFilter) => {
    set({ selectedStateFilter: stateFilter, currentPage: 1 });
    get().fetchLeads();
  },

  setPage: (page) => {
    set({ currentPage: page });
    get().fetchLeads();
  },

  setPageSize: (size) => {
    set({ pageSize: size, currentPage: 1 });
    get().fetchLeads();
  },

  clearFilters: () => {
    get().clearAllFilters();
  },

  fetchLeads: async () => {
    set({ isLoadingLeads: true });
    try {
      const state = get();

      let product = state.selectedProductFilter;
      let branch = '';
      let stateFilter = state.selectedStateFilter;
      let salesExecutive = '';
      let month = '';
      let createdDate = '';
      let createdFrom = '';
      let createdTo = '';
      let name = '';
      let icNumber = '';
      let phone = '';
      let status = '';

      state.filterRules.forEach((rule) => {
        if (!rule.value || !rule.value.trim()) return;
        switch (rule.field) {
          case 'product':
            product = rule.value;
            break;
          case 'branch':
            branch = rule.value;
            break;
          case 'state':
            stateFilter = rule.value;
            break;
          case 'salesExecutive':
            salesExecutive = rule.value;
            break;
          case 'month':
            month = rule.value;
            break;
          case 'createdDate':
            createdDate = rule.value;
            break;
          case 'createdFrom':
            createdFrom = rule.value;
            break;
          case 'createdTo':
            createdTo = rule.value;
            break;
          case 'name':
            name = rule.value;
            break;
          case 'icNumber':
            icNumber = rule.value;
            break;
          case 'phone':
            phone = rule.value;
            break;
          case 'status':
            status = rule.value;
            break;
        }
      });

      const pagedResult = await apiClient.getLeads({
        page: state.currentPage,
        pageSize: state.pageSize,
        search: state.searchQuery,
        product,
        branch,
        state: stateFilter,
        salesExecutive,
        month,
        createdDate,
        createdFrom,
        createdTo,
        name,
        icNumber,
        phone,
        status,
      });

      set({
        leads: pagedResult.items,
        totalRecords: pagedResult.totalRecords,
        totalPages: pagedResult.totalPages,
        currentPage: pagedResult.page,
        isLoadingLeads: false,
      });
    } catch (err) {
      console.error('Failed to fetch leads:', err);
      set({ leads: [], totalRecords: 0, totalPages: 1, isLoadingLeads: false });
    }
  },

  // Dashboard Analytics State
  dashboardDatePreset: 'all',
  dashboardStartDate: '',
  dashboardEndDate: '',
  dashboardProduct: '',
  dashboardBranch: '',
  dashboardGranularity: 'daily',

  kpiSummary: initialKpiSummary,
  leadsOverTime: [],
  leadsByProduct: [],
  leadsByBranch: [],
  recentLeads: [],
  isLoadingDashboard: false,

  setDashboardDatePreset: (preset) => {
    let startDate = '';
    let endDate = '';
    const now = new Date();

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'today') {
      startDate = formatDate(now);
      endDate = formatDate(now);
    } else if (preset === 'this_week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      startDate = formatDate(monday);
      endDate = formatDate(now);
    } else if (preset === 'last_week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() + diffToMonday - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      startDate = formatDate(lastMonday);
      endDate = formatDate(lastSunday);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = formatDate(firstDay);
      endDate = formatDate(now);
    } else if (preset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = formatDate(firstDayLastMonth);
      endDate = formatDate(lastDayLastMonth);
    } else if (preset === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstDayQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      startDate = formatDate(firstDayQuarter);
      endDate = formatDate(now);
    } else if (preset === 'this_year') {
      const jan1 = new Date(now.getFullYear(), 0, 1);
      startDate = formatDate(jan1);
      endDate = formatDate(now);
    } else if (preset === 'all_time') {
      startDate = '';
      endDate = '';
    }

    set({
      dashboardDatePreset: preset,
      dashboardStartDate: startDate,
      dashboardEndDate: endDate,
    });
    get().fetchDashboardData();
  },

  setDashboardDateRange: (startDate, endDate) => {
    set({
      dashboardDatePreset: 'custom',
      dashboardStartDate: startDate,
      dashboardEndDate: endDate,
    });
    get().fetchDashboardData();
  },

  setDashboardProduct: (product) => {
    set({ dashboardProduct: product });
    get().fetchDashboardData();
  },

  setDashboardBranch: (branch) => {
    set({ dashboardBranch: branch });
    get().fetchDashboardData();
  },

  setDashboardGranularity: (granularity) => {
    set({ dashboardGranularity: granularity });
    get().fetchDashboardData();
  },

  resetDashboardFilters: () => {
    set({
      dashboardDatePreset: 'all',
      dashboardStartDate: '',
      dashboardEndDate: '',
      dashboardProduct: '',
      dashboardBranch: '',
      dashboardGranularity: 'daily',
    });
    get().fetchDashboardData();
  },

  fetchDashboardData: async () => {
    set({ isLoadingDashboard: true });
    try {
      const s = get();
      const params: DashboardFilterParams = {
        startDate: s.dashboardStartDate || undefined,
        endDate: s.dashboardEndDate || undefined,
        product: s.dashboardProduct || undefined,
        branch: s.dashboardBranch || undefined,
        granularity: s.dashboardGranularity,
      };

      const [kpiSummary, leadsOverTime, leadsByProduct, leadsByBranch, recentLeads] =
        await Promise.all([
          apiClient.getDashboardKpis(params),
          apiClient.getLeadsOverTime(params),
          apiClient.getLeadsByProduct(params),
          apiClient.getLeadsByBranch(params),
          apiClient.getRecentLeads(params, 5),
        ]);

      set({
        kpiSummary,
        leadsOverTime,
        leadsByProduct,
        leadsByBranch,
        recentLeads,
        isLoadingDashboard: false,
      });
    } catch (err) {
      console.error('Failed to fetch dashboard analytics:', err);
      set({
        kpiSummary: initialKpiSummary,
        leadsOverTime: [],
        leadsByProduct: [],
        leadsByBranch: [],
        recentLeads: [],
        isLoadingDashboard: false,
      });
    }
  },

  // Create Lead Drawer
  isDrawerOpen: false,
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  // Lead Details Drawer
  selectedLead: null,
  isDetailsDrawerOpen: false,
  openDetailsDrawer: (lead) => {
    set({ selectedLead: lead, isDetailsDrawerOpen: true });
    if (lead?.id) {
      apiClient.logLeadView(lead.id);
    }
  },
  closeDetailsDrawer: () => set({ selectedLead: null, isDetailsDrawerOpen: false }),

  // Edit Lead Workflow State
  isEditReasonOpen: false,
  isEditLeadOpen: false,
  editLeadTarget: null,
  editReason: '',
  editFormData: initialFormData,
  editErrors: {},
  isConfirmingEdit: false,

  openEditWorkflow: (lead) => {
    // Populate form data from lead
    const phoneNo = lead.phone ? lead.phone.replace(/^\+60\s?/, '') : '';
    set({
      editLeadTarget: lead,
      isEditReasonOpen: true,
      editReason: '',
      isConfirmingEdit: false,
      editErrors: {},
      editFormData: {
        product: lead.product || '',
        customerName: lead.name || '',
        icNumber: lead.icNumber || '',
        phoneCountryCode: '+60',
        phoneNumber: phoneNo,
        email: lead.email || '',
        state: lead.state || '',
        preferredBranch: lead.branch && lead.branch !== 'Not Assigned' ? lead.branch : '',
        employerName: lead.employerName || '',
        appliedAmount: lead.appliedAmount || '',
        hasPreferredSalesExecutive: !!lead.preferredSalesExecutive,
        preferredSalesExecutive: lead.preferredSalesExecutive || '',
        propertyType: lead.propertyType || '',
        propertyStatus: lead.propertyStatus || '',
        dateOfIncorporation: lead.dateOfIncorporation || '',
        companyName: lead.companyName || '',
        entityType: lead.entityType || '',
        marketingConsent: (lead.marketingConsent as any) || 'CONSENT',
        agreedToPrivacyPolicy: true,
      },
    });
  },

  closeEditReasonDrawer: () => set({ isEditReasonOpen: false, editLeadTarget: null, editReason: '' }),

  proceedToEditLead: (reason) => {
    set({ editReason: reason, isEditLeadOpen: true });
  },

  setEditFieldValue: (field, value) => {
    set((state) => {
      const newErrors = { ...state.editErrors };
      delete newErrors[field];
      const newForm = { ...state.editFormData, [field]: value };
      if (field === 'state') {
        newForm.preferredBranch = '';
        get().fetchBranches(value as string);
      }
      if (field === 'product') {
        newForm.propertyType = '';
        newForm.propertyStatus = '';
        newForm.dateOfIncorporation = '';
        newForm.companyName = '';
        newForm.entityType = '';
      }
      return { editFormData: newForm, editErrors: newErrors };
    });
  },

  validateEditForm: () => {
    const { editFormData } = get();
    const errors: FormValidationErrors = {};

    if (!editFormData.product) errors.product = getEmptyErrorMessage('product');
    if (!editFormData.customerName.trim()) errors.customerName = getEmptyErrorMessage('customerName');
    if (!editFormData.icNumber.trim()) errors.icNumber = getEmptyErrorMessage('icNumber');
    else if (!/^\d{6}-\d{2}-\d{4}$/.test(editFormData.icNumber.trim())) errors.icNumber = getIncorrectErrorMessage('icNumber');

    if (!editFormData.phoneNumber.trim()) errors.phoneNumber = getEmptyErrorMessage('phoneNumber');
    else {
      const fullPhone = `${editFormData.phoneCountryCode}${editFormData.phoneNumber.trim().replace(/\s|-/g, '')}`;
      if (!/^\+60[1-9]\d{7,9}$/.test(fullPhone)) errors.phoneNumber = getIncorrectErrorMessage('phoneNumber');
    }

    if (!editFormData.email.trim()) errors.email = getEmptyErrorMessage('email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email.trim())) errors.email = getIncorrectErrorMessage('email');

    if (!editFormData.state) errors.state = getEmptyErrorMessage('state');
    if (!editFormData.employerName.trim()) errors.employerName = getEmptyErrorMessage('employerName');
    if (!editFormData.appliedAmount.trim()) errors.appliedAmount = getEmptyErrorMessage('appliedAmount');

    if (editFormData.hasPreferredSalesExecutive && !editFormData.preferredSalesExecutive.trim()) {
      errors.preferredSalesExecutive = getEmptyErrorMessage('preferredSalesExecutive');
    }

    if (editFormData.product === 'Home Financing') {
      if (!editFormData.propertyType) errors.propertyType = getEmptyErrorMessage('propertyType');
      if (!editFormData.propertyStatus) errors.propertyStatus = getEmptyErrorMessage('propertyStatus');
    } else if (editFormData.product === 'Micro Finance') {
      if (!editFormData.dateOfIncorporation) errors.dateOfIncorporation = getEmptyErrorMessage('dateOfIncorporation');
      if (!editFormData.companyName.trim()) errors.companyName = getEmptyErrorMessage('companyName');
      if (!editFormData.entityType) errors.entityType = getEmptyErrorMessage('entityType');
    }

    if (!editFormData.marketingConsent) errors.marketingConsent = getEmptyErrorMessage('marketingConsent');

    set({ editErrors: errors });
    const isValid = Object.keys(errors).length === 0;
    if (!isValid) {
      const errList = Object.values(errors).filter(Boolean) as string[];
      get().showToast({
        type: 'error',
        title: 'Please correct the following errors:',
        message: '',
        errorsList: errList,
      });
    }
    return isValid;
  },

  submitEditLead: async (reason) => {
    const { editLeadTarget, editFormData } = get();
    if (!editLeadTarget) return false;

    set({ isSubmitting: true });
    try {
      const updatePayload = {
        ...editFormData,
        editReason: reason,
      };

      const res = await apiClient.updateLead(editLeadTarget.id, updatePayload);
      set({ isSubmitting: false });

      if (res.success) {
        const closeState = {
          isEditLeadOpen: false,
          isEditReasonOpen: false,
          isConfirmingEdit: false,
          editLeadTarget: null,
          editReason: '',
        };

        if (isApprovalPending(res.data)) {
          // Nothing was actually changed yet — no list/dashboard refresh.
          get().showToast({
            type: 'info',
            title: 'Submitted for Approval',
            message: res.data.message || 'This change requires approval before it is applied.',
          });
          set(closeState);
          return true;
        }

        get().showToast({
          type: 'success',
          title: 'Success',
          message: 'Changes saved successfully',
        });
        set(closeState);
        get().fetchLeads();
        get().fetchDashboardData();
        return true;
      } else {
        get().showToast({
          type: 'error',
          title: 'Update Failed',
          message: res.message || 'Failed to update lead.',
        });
        return false;
      }
    } catch (err: any) {
      set({ isSubmitting: false });
      get().showToast({
        type: 'error',
        title: 'System Error',
        message: err?.message || 'Failed to update lead.',
      });
      return false;
    }
  },

  closeEditLeadDrawer: () => set({ isEditLeadOpen: false, isEditReasonOpen: false, isConfirmingEdit: false, editLeadTarget: null, editReason: '' }),
  setIsConfirmingEdit: (val) => set({ isConfirmingEdit: val }),

  // Delete Lead Workflow State
  isDeleteReasonOpen: false,
  isDeleteConfirmOpen: false,
  deleteLeadTarget: null,
  deleteReason: '',

  openDeleteWorkflow: (lead) => {
    set({
      deleteLeadTarget: lead,
      isDeleteReasonOpen: true,
      deleteReason: '',
      isDeleteConfirmOpen: false,
    });
  },

  closeDeleteReasonDrawer: () => set({ isDeleteReasonOpen: false, deleteLeadTarget: null, deleteReason: '' }),

  proceedToDeleteConfirm: (reason) => {
    set({ deleteReason: reason, isDeleteConfirmOpen: true });
  },

  backToDeleteReason: () => set({ isDeleteConfirmOpen: false }),

  confirmDeleteLead: async () => {
    const { deleteLeadTarget, deleteReason } = get();
    if (!deleteLeadTarget) return false;

    set({ isSubmitting: true });
    try {
      const res = await apiClient.deleteLead(deleteLeadTarget.id, deleteReason);
      set({ isSubmitting: false });

      if (res.success) {
        const closeState = {
          isDeleteConfirmOpen: false,
          isDeleteReasonOpen: false,
          deleteLeadTarget: null,
          deleteReason: '',
        };

        if (isApprovalPending(res.data)) {
          // Nothing was actually deleted yet — no list/dashboard refresh.
          get().showToast({
            type: 'info',
            title: 'Submitted for Approval',
            message: res.data.message || 'This deletion requires approval before it is applied.',
          });
          set(closeState);
          return true;
        }

        get().showToast({
          type: 'success',
          title: 'Deleted',
          message: 'This lead has been deleted',
        });
        set(closeState);
        get().fetchLeads();
        get().fetchDashboardData();
        return true;
      } else {
        get().showToast({
          type: 'error',
          title: 'Delete Failed',
          message: res.message || 'Failed to delete lead.',
        });
        return false;
      }
    } catch (err: any) {
      set({ isSubmitting: false });
      get().showToast({
        type: 'error',
        title: 'System Error',
        message: err?.message || 'Failed to delete lead.',
      });
      return false;
    }
  },

  closeDeleteWorkflow: () => set({ isDeleteConfirmOpen: false, isDeleteReasonOpen: false, deleteLeadTarget: null, deleteReason: '' }),

  // Audit Logs State
  auditLogs: [],
  totalAuditRecords: 0,
  auditPage: 1,
  auditPageSize: 10,
  auditSearchQuery: '',
  auditActionFilter: '',
  isLoadingAuditLogs: false,
  selectedAuditLog: null,
  isAuditDetailsOpen: false,

  fetchAuditLogs: async () => {
    set({ isLoadingAuditLogs: true });
    try {
      const state = get();
      const pagedResult = await apiClient.getAuditLogs({
        page: state.auditPage,
        pageSize: state.auditPageSize,
        search: state.auditSearchQuery,
        actionType: state.auditActionFilter,
      });

      set({
        auditLogs: pagedResult.items,
        totalAuditRecords: pagedResult.totalRecords,
        isLoadingAuditLogs: false,
      });
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      set({ auditLogs: [], totalAuditRecords: 0, isLoadingAuditLogs: false });
    }
  },

  openAuditDetails: (log) => set({ selectedAuditLog: log, isAuditDetailsOpen: true }),
  closeAuditDetails: () => set({ selectedAuditLog: null, isAuditDetailsOpen: false }),

  setAuditPage: (page) => {
    set({ auditPage: page });
    get().fetchAuditLogs();
  },

  setAuditSearchQuery: (query) => {
    set({ auditSearchQuery: query, auditPage: 1 });
    get().fetchAuditLogs();
  },

  setAuditActionFilter: (action) => {
    set({ auditActionFilter: action, auditPage: 1 });
    get().fetchAuditLogs();
  },
}));
