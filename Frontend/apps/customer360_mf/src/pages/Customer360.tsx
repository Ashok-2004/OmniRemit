import React, { useEffect, useState, useRef } from 'react';
import { useCustomerStore, readSavedCustomer, clearSavedCustomer } from '../store/customerStore';
import { useInteractionStore } from '../store/interactionStore';
import { useProductStore } from '../store/productStore';
import { api, ApiError } from '../services/api';
import { getFriendlyErrorMessage, idTypeToFriendlyLabel } from '../utils/errorMessages';
import { maskPhone, maskNRIC, maskTIN } from '../utils/masking';
import CustomerHeader from '../components/CustomerHeader';
import IndividualDetails from '../components/IndividualDetails';
import CompanyOverview from '../components/CompanyOverview';
import SectionContainer from '../components/SectionContainer';
import CaseDetailsModal from '../components/CaseDetailsModal';
import ProductDetailsModal from '../components/ProductDetailsModal';
import { Eye, EyeOff, ChevronRight, ChevronDown, SlidersHorizontal, Building2, Layers, User, Briefcase, Globe, Shield, FileText, Calendar, DollarSign, MapPin, Mail, Phone, TrendingUp, ArrowLeft, Search, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigationStore } from '../store/navigationStore';
import type {
  IndividualProfile,
  CorporateProfile,
  CustomerProduct,
  Interaction,
  LookupOptions,
} from '../types/api';

export default function Customer360() {
  const { customerType, profile, contactInfo, loading, error, errorStatus, loadActiveProfile } = useCustomerStore();
  const {
    interactions,
    loading: loadingInteractions,
    error: interactionsError,
    loadInteractions,
    openCaseModal
  } = useInteractionStore();
  const {
    products,
    loading: loadingProducts,
    error: productsError,
    loadProducts,
    openProductModal,
    pageNumber,
    pageSize,
    totalCount,
    totalPages,
    setPageNumber,
    setPageSize
  } = useProductStore();

  const { setActivePage } = useNavigationStore();

  // Adjust tabs based on customerType
  const isIndividual = customerType === 'individual';

  // Tab states
  const [activeTab, setActiveTab] = useState('personal_details'); // 'personal_details' for Individual; 'overview' for Corporate
  const [activeSubTab, setActiveSubTab] = useState(''); // no longer used for Individual details
  const [viewMode, setViewMode] = useState('details'); // 'details' or 'list'
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);
  const [productsTab, setProductsTab] = useState('held'); // 'held' or 'interested' for Individual
  const [companies, setCompanies] = useState<CorporateProfile[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // ---------------------------------------------------------------------------
  // Bootstrap state — avoids the "flash of the search form" on refresh.
  // ---------------------------------------------------------------------------
  const [bootstrapping, setBootstrapping] = useState(() => !readSavedCustomer());

  // Dynamic Search Options (populated from API)
  const [dropdownOptions, setDropdownOptions] = useState<LookupOptions>({
    idTypes: [
      { value: "Phone", label: "Phone Number" },
      { value: "Name", label: "Full Name" },
      { value: "NRIC", label: "National ID (NRIC)" },
      { value: "SecondaryID", label: "Secondary ID" }
    ],
    secondaryIdTypes: [
      { value: "PASSPORT", label: "Passport" },
      { value: "OLDID", label: "Old IC" },
      { value: "POLICENUMBER", label: "Police ID / Army ID" }
    ],
    corpSearchTypes: [
      { value: "BRN", label: "BRN" },
      { value: "OLDBRN", label: "Old BRN" },
      { value: "COMPANYNAME", label: "Company Name" }
    ]
  });

  // ID Search states for Individual
  const [isSearched, setIsSearched] = useState(false);
  const [searchIdType, setSearchIdType] = useState('');
  const [searchSubtype, setSearchSubtype] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [searchError, setSearchError] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);

  // ID Search states for Corporate (Non-Individual)
  const [isSearchedCorp, setIsSearchedCorp] = useState(false);
  const [corpSearchType, setCorpSearchType] = useState('');
  const [corpSearchVal, setCorpSearchVal] = useState('');
  const [corpSearchError, setCorpSearchError] = useState('');
  const [loadingCorpSearch, setLoadingCorpSearch] = useState(false);
  const [filterText, setFilterText] = useState('');

  // Individual Product Held states
  const [indSearchQuery, setIndSearchQuery] = useState('');
  const [indShowFilter, setIndShowFilter] = useState(false);
  const [indTypeFilter, setIndTypeFilter] = useState('');
  const [indStatusFilter, setIndStatusFilter] = useState('');
  const [indShowMode, setIndShowMode] = useState('5');
  const [indCustomSize, setIndCustomSize] = useState<number | string>(5);

  // Corporate (Non-Individual) Product Held states
  const [corpSearchQuery, setCorpSearchQuery] = useState('');
  const [corpShowFilter, setCorpShowFilter] = useState(false);
  const [corpTypeFilter, setCorpTypeFilter] = useState('');
  const [corpStatusFilter, setCorpStatusFilter] = useState('');
  const [corpShowMode, setCorpShowMode] = useState('5');
  const [corpCustomSize, setCorpCustomSize] = useState<number | string>(5);

  // Corporate Subtab toggle for Products & Signatories
  const [corpSubTab, setCorpSubTab] = useState('products');

  // Interactions states
  const [intSearchQuery, setIntSearchQuery] = useState('');
  const [intShowFilter, setIntShowFilter] = useState(false);
  const [intStatusFilter, setIntStatusFilter] = useState('');
  const [intShowMode, setIntShowMode] = useState('5');
  const [intCustomSize, setIntCustomSize] = useState<number | string>(5);
  const [intPageNumber, setIntPageNumber] = useState(1);

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const handleToggleReveal = async (fieldKey: string, fieldLabel: string, realVal: string) => {
    if (!realVal || realVal.trim() === '' || realVal.toLowerCase() === 'null') return;
    const isRevealing = !revealed[fieldKey];
    setRevealed(prev => ({ ...prev, [fieldKey]: isRevealing }));
    
    if (isRevealing) {
      // `profile` is typed as the CustomerProfile union, but every real call site of this function
      // (the four corporate signatory/TIN/phone reveal buttons) only ever fires with a corporate
      // profile loaded, matching the hardcoded "Non-Individual" label below — narrow explicitly rather
      // than reading `.organizationName`/`.brn` off the union, which TypeScript correctly can't allow.
      const corpProfile = profile as CorporateProfile | null;
      try {
        await api.logAudit({
          action: "VIEW_SENSITIVE_DATA",
          customerName: corpProfile?.organizationName || "Unknown",
          customerType: "Non-Individual",
          field: fieldLabel,
          status: "Success",
          description: `Viewed ${fieldLabel} for customer '${corpProfile?.organizationName || "Unknown"}'`,
          customerId: corpProfile?.brn || ""
        });
      } catch (err) {
        console.error("Failed to log view sensitive data audit:", err);
      }
    }
  };

  useEffect(() => {
    let active = true;
    const fetchOptions = async () => {
      try {
        const res = await api.getSearchOptions();
        if (active && res && res.data) {
          setDropdownOptions(res.data);
        }
      } catch (err) {
        console.error("Failed to load search options from lookups API:", err);
      }
    };
    fetchOptions();
    return () => {
      active = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Rehydrate the active customer after a browser refresh.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (profile) { setBootstrapping(false); return; }
    const saved = readSavedCustomer();
    if (!saved) { setBootstrapping(false); return; }

    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const routeCustomerType = pathname.includes('/corporate') ? 'corporate' : 'individual';
    if (saved.customerType !== routeCustomerType && saved.customerType !== customerType) {
      setBootstrapping(false);
      return;
    }

    if (saved.customerType === 'individual') {
      const { loadProfileById } = useCustomerStore.getState();
      loadProfileById(saved.id, 'NRIC')
        .then((loaded) => { if (loaded) setIsSearched(true); })
        .catch(() => clearSavedCustomer())
        .finally(() => setBootstrapping(false));
    } else if (saved.customerType === 'corporate') {
      const { loadCorporateProfileById } = useCustomerStore.getState();
      loadCorporateProfileById(saved.id, 'BRN')
        .then((loaded) => {
          if (loaded) {
            setIsSearchedCorp(true);
            setViewMode('details');
          }
        })
        .catch(() => clearSavedCustomer())
        .finally(() => setBootstrapping(false));
    }
  }, []);

  // Read tab from URL query param (used when navigating back)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && profile) {
      let resolvedTab = tabParam;
      if (['residency_details', 'contact_details'].includes(tabParam)) {
        resolvedTab = 'residency_contact_details';
      } else if (['additional_details', 'referrer_relationship'].includes(tabParam)) {
        resolvedTab = 'additional_relationship_details';
      } else if (['contact', 'referral'].includes(tabParam)) {
        resolvedTab = 'contact_relationship';
      } else if (['products', 'signatories'].includes(tabParam)) {
        resolvedTab = 'products_signatories';
        setCorpSubTab(tabParam);
      }
      setActiveTab(resolvedTab);
      if (customerType === 'individual') {
        setIsSearched(true);
      } else {
        setIsSearchedCorp(true);
        setViewMode('details');
      }
    }
  }, [profile]);

  const handleSearch = async () => {
    if (!searchIdType || !searchVal) return;
    setLoadingSearch(true);
    setSearchError('');
    try {
      const { loadProfileById } = useCustomerStore.getState();
      
      let apiType = searchIdType;
      if (searchIdType === 'Phone') apiType = 'PHONENO';
      if (searchIdType === 'Name') apiType = 'FULLNAME';
      if (searchIdType === 'SecondaryID') apiType = 'SECONDARYID';

      await loadProfileById(searchVal, apiType, searchSubtype);
      setIsSearched(true);

      // Log success
      const latestProfile = useCustomerStore.getState().profile as IndividualProfile | null;
      const customerName = latestProfile?.fullName || searchVal;
      const customerId = latestProfile?.nationalId || searchVal;
      await api.logAudit({
        action: "SEARCH",
        customerName: customerName,
        customerType: "Individual",
        status: "Success",
        description: `Searched for '${searchVal}' by ${searchIdType}`,
        customerId: customerId
      }).catch(e => console.error("Search audit error:", e));

    } catch (err) {
      const error = err as ApiError;
      const idLabel = idTypeToFriendlyLabel(searchIdType, searchSubtype);
      setSearchError(getFriendlyErrorMessage(error, 'individual-search', error?.status === 400 ? idLabel : ''));

      // Log failure
      await api.logAudit({
        action: "SEARCH",
        customerName: searchVal,
        customerType: "Individual",
        status: "Failed",
        description: `Failed search for '${searchVal}' by ${searchIdType}`,
        customerId: searchVal
      }).catch(e => console.error("Search audit error:", e));

    } finally {
      setLoadingSearch(false);
    }
  };

  const handleCorpSearch = async () => {
    if (!corpSearchType || !corpSearchVal) return;
    setLoadingCorpSearch(true);
    setCorpSearchError('');
    try {
      // loadCorporateProfileById fetches the profile once and reuses it — calling
      // getCorporateProfile here too (then loadActiveProfile again) previously
      // fired two identical /v1/corpprofile requests per search.
      const { loadCorporateProfileById } = useCustomerStore.getState();
      await loadCorporateProfileById(corpSearchVal, corpSearchType);
      setViewMode('details');
      setIsSearchedCorp(true);

      // Log success
      const latestProfile = useCustomerStore.getState().profile as CorporateProfile | null;
      const customerName = latestProfile?.organizationName || corpSearchVal;
      const customerId = latestProfile?.brn || corpSearchVal;
      await api.logAudit({
        action: "SEARCH",
        customerName: customerName,
        customerType: "Non-Individual",
        status: "Success",
        description: `Searched for '${corpSearchVal}' by ${corpSearchType}`,
        customerId: customerId
      }).catch(e => console.error("Search audit error:", e));

    } catch (err) {
      const error = err as ApiError;
      const idLabel = idTypeToFriendlyLabel(corpSearchType);
      setCorpSearchError(getFriendlyErrorMessage(error, 'corporate-search', error?.status === 400 ? idLabel : ''));

      // Log failure
      await api.logAudit({
        action: "SEARCH",
        customerName: corpSearchVal,
        customerType: "Non-Individual",
        status: "Failed",
        description: `Failed search for '${corpSearchVal}' by ${corpSearchType}`,
        customerId: corpSearchVal
      }).catch(e => console.error("Search audit error:", e));

    } finally {
      setLoadingCorpSearch(false);
    }
  };

  // Fetches the full corporate directory for the "Browse All Companies" / "Refresh Directory" /
  // "Load All Registered Companies" actions. This used to be referenced under the name
  // `handleViewAllCompanies` in three places (the Browse button, the Refresh Directory button, and
  // the empty-state's Load All button) without ever being defined — a bare ReferenceError thrown
  // during render the instant `showList` became true, which is deterministic: switching to
  // Non-Individual always sets viewMode to 'list' shortly after. It only failed to surface earlier
  // because nothing had exercised that render path in review. The fetch logic itself already existed,
  // duplicated inside the loader effect below; this is that same logic, named and made callable from
  // the buttons that were already trying to call it.
  const handleViewAllCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const res = await api.getAllCorporateProfiles();
      setCompanies(res.data || []);
    } catch (err) {
      console.error("Failed to load corporate directory:", err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Resets all individual search state and returns user to the clean search form.
  // Must clear every credential input so there is no leakage on re-entry.
  // "New Search" — this is the ONLY action that clears Individual's cached profile/search form.
  // Switching away to Non-Individual and back must NOT trigger this (see the removed effect below).
  const handleBackToSearch = () => {
    setIsSearched(false);
    setSearchIdType('');
    setSearchSubtype('');
    setSearchVal('');
    setSearchError('');
    clearSavedCustomer();
    useCustomerStore.setState({
      individualProfile: null,
      individualContactInfo: null,
      profile: null,
      contactInfo: null,
      error: null,
      activeIndividualId: '',
    });
    useProductStore.setState({ products: [], pageNumber: 1, pageSize: 5 });
    useInteractionStore.setState({ interactions: [], pageNumber: 1 });
  };

  // Resets all corporate search state and returns user to the clean corporate search form. Same
  // "only an explicit action clears it" rule as handleBackToSearch above.
  const handleBackToSearchCorp = () => {
    setIsSearchedCorp(false);
    setCorpSearchType('');
    setCorpSearchVal('');
    setCorpSearchError('');
    setViewMode('list');
    clearSavedCustomer();
    useCustomerStore.setState({
      corporateProfile: null,
      corporateContactInfo: null,
      profile: null,
      contactInfo: null,
      error: null,
      activeCorporateId: '',
    });
    useProductStore.setState({ products: [], pageNumber: 1, pageSize: 5 });
    useInteractionStore.setState({ interactions: [], pageNumber: 1 });
  };

  // Deliberately no useEffect on [customerType] here anymore. There used to be one that reset the
  // OTHER tab's search form and BOTH tabs' profile every time customerType changed — meaning
  // searching Individual, checking Non-Individual, then coming back to Individual always landed back
  // on a blank form. useCustomerStore.setCustomerType now switches which cached per-type slot is
  // being viewed without clearing either one; each tab's own local state here
  // (isSearched/searchIdType/... vs isSearchedCorp/corpSearchType/...) was ALREADY independent per
  // type and only ever got wiped by this effect. Products/Interactions still refresh for whichever
  // profile is now active via their own [profile, isIndividual] effects further below — that's a
  // deliberate re-fetch-on-switch, not a cache, since the user's complaint was specifically about
  // search state and profile data disappearing, not about an extra network request.

  // Load interactions when profile changes
  useEffect(() => {
    if (profile) {
      const customerId = isIndividual ? (profile as IndividualProfile).nationalId : (profile as CorporateProfile).brn;
      loadInteractions(customerId as string);
    }
  }, [profile, isIndividual]);

  // Load products based on profile and store pagination state
  const lastParamsRef = useRef<{ customerId: string | null | undefined; pageNumber: number | null; pageSize: number | null }>({ customerId: null, pageNumber: null, pageSize: null });

  useEffect(() => {
    if (profile) {
      const customerId = isIndividual ? (profile as IndividualProfile).nationalId : (profile as CorporateProfile).brn;
      const isNewCustomer = lastParamsRef.current.customerId !== customerId;

      // A new customer always needs a fresh fetch at page 1 — full stop.
      // This is handled as its own branch (rather than falling through to
      // the "did page/size change" guard below) specifically because that
      // guard was comparing the NEW target page/size (always 1/5 for a new
      // customer) against lastParamsRef's LEFTOVER page/size from the
      // *previous* customer. Since 1/5 is also the common default, a second
      // customer searched in the same session whose previous customer also
      // happened to be sitting at page 1/size 5 would match on all three
      // guard conditions and incorrectly skip the fetch entirely — Products
      // Held would show "No products found" until something else (e.g. a
      // full refresh, which resets this ref) forced a re-fetch.
      if (isNewCustomer) {
        lastParamsRef.current = { customerId, pageNumber: 1, pageSize: 5 };
        if (pageNumber !== 1 || pageSize !== 5) {
          useProductStore.setState({ pageNumber: 1, pageSize: 5 });
        }
        loadProducts(customerId as string, 1, 5);
        return;
      }

      // Same customer — only re-fetch if the page/size actually changed
      // since the last fetch we issued for them.
      if (lastParamsRef.current.pageNumber === pageNumber && lastParamsRef.current.pageSize === pageSize) {
        return;
      }

      lastParamsRef.current.pageNumber = pageNumber;
      lastParamsRef.current.pageSize = pageSize;
      loadProducts(customerId as string, pageNumber, pageSize);
    }
  }, [profile, pageNumber, pageSize, isIndividual]);

  // Reset filter and search states when customer profile changes
  useEffect(() => {
    setIndSearchQuery('');
    setIndShowFilter(false);
    setIndTypeFilter('');
    setIndStatusFilter('');
    setIndShowMode('5');
    setIndCustomSize(5);

    setCorpSearchQuery('');
    setCorpShowFilter(false);
    setCorpTypeFilter('');
    setCorpStatusFilter('');
    setCorpShowMode('5');
    setCorpCustomSize(5);

    setIntSearchQuery('');
    setIntShowFilter(false);
    setIntStatusFilter('');
    setIntShowMode('5');
    setIntCustomSize(5);
    setIntPageNumber(1);
  }, [profile]);

  // Load corporate directory companies dynamically when in corporate list mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleViewAllCompanies is a plain
  // function recreated every render (matching this file's existing handler style, e.g.
  // handleBackToSearchCorp above); including it would refire this effect on every render.
  useEffect(() => {
    if (!isIndividual && viewMode === 'list') {
      handleViewAllCompanies();
    }
  }, [isIndividual, viewMode]);

  useEffect(() => {
    // Skip default tab reset when navigating back with a tab query param
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (tabParam) return;
    }

    if (isIndividual) {
      setViewMode('details');
      setActiveTab('personal_details');
      setActiveSubTab('');
    } else {
      setViewMode('list');
      setActiveTab('overview');
      setActiveSubTab('');
    }
  }, [customerType]);

  const showList = !isIndividual && viewMode === 'list';

  // Restoring a customer after refresh — show a neutral loading state, never
  // the search form (which would flash briefly before swapping to the
  // restored workspace) and never a stale/empty table.
  if (bootstrapping) {
    return (
      <div className="loading-overlay" style={{ height: '70vh' }}>
        <div className="spinner"></div>
        <p style={{ fontWeight: 600, color: '#374151' }}>Restoring your session...</p>
      </div>
    );
  }

  // CustomerProduct's real CRM field is `accountNumber` (see types/api.ts) —
  // `accountNo` was never part of the contract, so this fallback has always
  // been dead at runtime. Preserved via cast rather than "fixed", per the
  // migration's no-behavior-change rule (mirrors the `sourcename`/`source`
  // preservation below for Interaction).
  const getLegacyProductField = (item: CustomerProduct, key: string): string | undefined =>
    (item as unknown as Record<string, string | undefined>)[key];

  // Interaction's real CRM fields are `statusParent` (no plain `status`) and
  // `sourceName` (no plain `source`) — see types/api.ts. Same preservation
  // rationale as getLegacyProductField above.
  const getLegacyInteractionField = (item: Interaction, key: string): string | undefined =>
    (item as unknown as Record<string, string | undefined>)[key];

  // Get filtered products, unique types, and unique statuses for Individual and Non-Individual product lists
  const getFilteredAndUnique = (isInd: boolean) => {
    // 1. Unique Types & Statuses (derived from the original complete list of products loaded in the store)
    const rawTypes = products.map(p => p.type || p.productCategory || '').filter(Boolean);
    const rawStatuses = products.map(p => p.derivedAccountStatus || p.financingStatus || '').filter(Boolean);
    const uniqueTypes = Array.from(new Set(rawTypes));
    const uniqueStatuses = Array.from(new Set(rawStatuses));

    // 2. Filter products
    const query = (isInd ? indSearchQuery : corpSearchQuery).toLowerCase().trim();
    const typeF = isInd ? indTypeFilter : corpTypeFilter;
    const statusF = isInd ? indStatusFilter : corpStatusFilter;

    const filtered = products.filter(item => {
      const matchesSearch = !query ||
        (item.productName || '').toLowerCase().includes(query) ||
        (item.accountNumber || getLegacyProductField(item, 'accountNo') || '').toLowerCase().includes(query) ||
        (item.type || item.productCategory || '').toLowerCase().includes(query);

      const matchesType = !typeF || (item.type || item.productCategory || '') === typeF;
      const matchesStatus = !statusF || (item.derivedAccountStatus || item.financingStatus || '') === statusF;

      return matchesSearch && matchesType && matchesStatus;
    });

    return { filtered, uniqueTypes, uniqueStatuses };
  };

  const indData = getFilteredAndUnique(true);
  const corpData = getFilteredAndUnique(false);

  const getFilteredInteractions = () => {
    const query = intSearchQuery.toLowerCase().trim();
    const statusF = intStatusFilter;

    // 1. Filter interactions
    const filtered = interactions.filter(item => {
      const matchesSearch = !query ||
        (item.caseId || '').toLowerCase().includes(query) ||
        (item.category || '').toLowerCase().includes(query) ||
        (getLegacyInteractionField(item, 'status') || item.statusParent || '').toLowerCase().includes(query) ||
        (getLegacyInteractionField(item, 'source') || item.sourceName || '').toLowerCase().includes(query) ||
        (item.classification || item.subCategory1 || '').toLowerCase().includes(query);

      const matchesStatus = !statusF || (getLegacyInteractionField(item, 'status') || item.statusParent || '') === statusF;

      return matchesSearch && matchesStatus;
    });

    // 2. Unique statuses
    const uniqueStatuses = Array.from(new Set(interactions.map(item => getLegacyInteractionField(item, 'status') || item.statusParent || '').filter(Boolean)));

    return { filtered, uniqueStatuses };
  };

  const intData = getFilteredInteractions();

  const getIntPageSize = () => {
    if (intShowMode === '5') return 5;
    if (intShowMode === '10') return 10;
    if (intShowMode === 'custom') {
      const size = parseInt(String(intCustomSize), 10);
      return (!isNaN(size) && size > 0) ? size : 5;
    }
    return intData.filtered.length || 5;
  };

  const intPageSize = getIntPageSize();
  const intTotalPages = Math.ceil(intData.filtered.length / intPageSize) || 1;
  const safeIntPageNumber = Math.min(intPageNumber, intTotalPages);

  const paginatedInteractions = intData.filtered.slice(
    (safeIntPageNumber - 1) * intPageSize,
    safeIntPageNumber * intPageSize
  );

  const getCompanyDetails = (company: CorporateProfile | null | undefined) => {
    return {
      id: company?.customerId || '-',
      phone: '-',
      email: company?.signatoryName || '-'
    };
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '-';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '-';
    const s = String(val).trim();
    if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
      return '-';
    }
    return s;
  };

  const formatCurrency = (val: unknown): string => {
    const formatted = formatValue(val);
    if (formatted === '-') return '-';
    if (formatted.includes('MYR') || formatted.includes('SGD') || formatted.includes('RM') || formatted.includes('$')) {
      return formatted;
    }
    let cleanVal = formatted.replace(/,/g, '');
    if (!isNaN(Number(cleanVal)) && cleanVal !== '') {
      const num = parseFloat(cleanVal);
      const formattedNum = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const currency = ((profile as CorporateProfile | null)?.country || '').toUpperCase() === 'SG' ? 'SGD' : 'MYR';
      return `${currency} ${formattedNum}`;
    }
    const currency = ((profile as CorporateProfile | null)?.country || '').toUpperCase() === 'SG' ? 'SGD' : 'MYR';
    return `${currency} ${formatted}`;
  };

  const renderIndividualSearchPanel = () => (
    <div className="c360-search-panel" style={{ marginBottom: 20 }}>
      <div className="c360-search-header">
        <div className="c360-search-title-box">
          <div className="c360-search-icon-badge">
            <User size={18} />
          </div>
          <div>
            <h2 className="c360-search-title">Individual Customer Search</h2>
            <p className="c360-search-subtitle">
              {!searchIdType ? 'Select an ID type and enter value to look up customer profile.' :
               searchIdType === 'Phone' ? 'Search customer by phone number.' :
               searchIdType === 'Name' ? 'Search customer by full registered name.' :
               searchIdType === 'NRIC' ? 'Search customer by National ID (NRIC).' :
               `Search customer by ${(dropdownOptions.secondaryIdTypes.find(opt => opt.value === searchSubtype)?.label || 'secondary document')}.`}
            </p>
          </div>
        </div>
        {isSearched && (
          <button 
            type="button"
            onClick={handleBackToSearch}
            className="c360-btn-secondary"
            style={{ height: '36px', padding: '0 14px', fontSize: '13px' }}
          >
            <RotateCcw size={14} /> New Search
          </button>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
        <div className="c360-search-form-row">
          {/* ID Type Select */}
          <div className="c360-form-group">
            <label className="c360-label">
              Search By <span className="c360-required">*</span>
            </label>
            <select
              value={searchIdType}
              onChange={(e) => {
                setSearchIdType(e.target.value);
                setSearchSubtype('');
                setSearchVal('');
                setSearchError('');
              }}
              className="c360-select"
            >
              <option value="">Select ID Type</option>
              {dropdownOptions.idTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Secondary ID Type Select */}
          {searchIdType === 'SecondaryID' ? (
            <div className="c360-form-group">
              <label className="c360-label">
                Document Type <span className="c360-required">*</span>
              </label>
              <select
                value={searchSubtype}
                onChange={(e) => {
                  setSearchSubtype(e.target.value);
                  setSearchVal('');
                  setSearchError('');
                }}
                className="c360-select"
              >
                <option value="">Select Document</option>
                {dropdownOptions.secondaryIdTypes.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'none' }} />
          )}

          {/* Search Input — only once the operator has actually chosen what they're searching by.
              Showing an empty "Identity Number" box before any ID Type is selected (previously
              unconditional) told the operator nothing about what format to enter and read as
              confusing/broken; for Secondary ID specifically, the document type must be picked too,
              since the placeholder/label below depends on it. */}
          {searchIdType && (searchIdType !== 'SecondaryID' || searchSubtype) && (
            <div className="c360-form-group" style={{ gridColumn: searchIdType === 'SecondaryID' ? 'span 1' : 'span 2' }}>
              <label className="c360-label">
                {searchIdType === 'Phone' ? 'Phone Number' :
                 searchIdType === 'Name' ? 'Full Name' :
                 searchIdType === 'NRIC' ? 'National ID (NRIC)' :
                 (dropdownOptions.secondaryIdTypes.find((opt) => opt.value === searchSubtype)?.label || 'Identity Number')} <span className="c360-required">*</span>
              </label>
              <div className="c360-input-wrapper">
                <Search size={16} className="c360-input-icon" />
                <input
                  type="text"
                  placeholder={
                    searchIdType === 'Phone' ? 'e.g. +60123456789 or 0123456789' :
                    searchIdType === 'Name' ? 'e.g. Ahmad bin Razak' :
                    searchIdType === 'NRIC' ? 'e.g. 900101-14-5566 or 900101145566' :
                    searchSubtype === 'PASSPORT' ? 'e.g. A12345678' : 'Enter identity number'
                  }
                  value={searchVal}
                  onChange={(e) => {
                    setSearchVal(e.target.value);
                    setSearchError('');
                  }}
                  className="c360-input"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <button
            type="submit"
            disabled={loadingSearch || !searchIdType || !searchVal}
            className="c360-btn-primary"
          >
            {loadingSearch ? (
              <>
                <Loader2 size={16} className="c360-spinner" />
                Searching...
              </>
            ) : (
              <>
                <Search size={15} />
                Search Profile
              </>
            )}
          </button>
        </div>

        {searchError && (
          <div style={{ marginTop: '12px', color: '#dc2626', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={15} />
            {searchError}
          </div>
        )}
      </form>
    </div>
  );

  const renderCorporateSearchPanel = () => (
    <div className="c360-search-panel" style={{ marginBottom: 20 }}>
      <div className="c360-search-header">
        <div className="c360-search-title-box">
          <div className="c360-search-icon-badge" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Building2 size={18} />
          </div>
          <div>
            <h2 className="c360-search-title">Non-Individual (Corporate) Search</h2>
            <p className="c360-search-subtitle">
              {!corpSearchType ? 'Select search type and enter details, or browse company directory.' :
               corpSearchType === 'BRN' ? 'Search registered company by Business Registration Number (BRN).' :
               corpSearchType === 'OLDBRN' ? 'Search registered company by Old BRN.' :
               'Search registered company by Company Name.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              if (companies.length === 0) {
                handleViewAllCompanies();
              }
            }}
            className={viewMode === 'list' ? 'c360-btn-primary' : 'c360-btn-secondary'}
            style={{ height: '36px', padding: '0 14px', fontSize: '13px' }}
          >
            <Building2 size={14} /> Browse All Companies
          </button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleCorpSearch(); }}>
        <div className="c360-search-form-row">
          {/* Search Type Select */}
          <div className="c360-form-group">
            <label className="c360-label">
              Search Type <span className="c360-required">*</span>
            </label>
            <select
              value={corpSearchType}
              onChange={(e) => {
                setCorpSearchType(e.target.value);
                setCorpSearchVal('');
                setCorpSearchError('');
              }}
              className="c360-select"
            >
              <option value="">Select Search Type</option>
              {dropdownOptions.corpSearchTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input — only once a search type is actually chosen. Previously unconditional,
              which meant it fell through to the "Company / Organization Name" branch (the ternary's
              else case) even with nothing selected — indistinguishable from genuinely having chosen
              Company Name search. */}
          {corpSearchType && (
            <div className="c360-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="c360-label">
                {corpSearchType === 'BRN' ? 'BRN (Business Registration Number)' :
                 corpSearchType === 'OLDBRN' ? 'Old Registration Number' :
                 'Company / Organization Name'} <span className="c360-required">*</span>
              </label>
              <div className="c360-input-wrapper">
                <Search size={16} className="c360-input-icon" />
                <input
                  type="text"
                  placeholder={
                    corpSearchType === 'BRN' ? 'e.g. 202003150001' :
                    corpSearchType === 'OLDBRN' ? 'e.g. 202003151A' :
                    'e.g. Omni Global Trading Sdn Bhd'
                  }
                  value={corpSearchVal}
                  onChange={(e) => {
                    setCorpSearchVal(e.target.value);
                    setCorpSearchError('');
                  }}
                  className="c360-input"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <button
            type="submit"
            disabled={loadingCorpSearch || !corpSearchType || !corpSearchVal}
            className="c360-btn-primary"
          >
            {loadingCorpSearch ? (
              <>
                <Loader2 size={16} className="c360-spinner" />
                Searching...
              </>
            ) : (
              <>
                <Search size={15} />
                Search Company
              </>
            )}
          </button>
        </div>

        {corpSearchError && (
          <div style={{ marginTop: '12px', color: '#dc2626', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={15} />
            {corpSearchError}
          </div>
        )}
      </form>
    </div>
  );

  if (showList) {
    // Filter results locally in directory view
    const filteredCompanies = companies.filter(company => 
      (company.organizationName || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (company.brn || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (company.organizationType || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (company.economicSector || '').toLowerCase().includes(filterText.toLowerCase())
    );

    const getCountryName = (code: string | null | undefined): string => {
      if (code === 'MY') return 'Malaysia';
      if (code === 'SG') return 'Singapore';
      return code || '-';
    };

    const colorsList = ['#10B981', '#6366F1', '#3B82F6', '#F59E0B', '#EF4444', '#0F172A', '#14B8A6'];
    const getAvatarBgColor = (name: string | null | undefined): string => {
      let hash = 0;
      for (let i = 0; i < (name || '').length; i++) {
        hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash) % colorsList.length;
      return colorsList[index];
    };

    return (
      <div>
        {renderCorporateSearchPanel()}

        {/* Directory Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="c360-input-wrapper" style={{ width: 280 }}>
              <Search size={15} className="c360-input-icon" />
              <input
                type="text"
                placeholder="Filter companies by name or BRN..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="c360-input"
                style={{ height: 38, fontSize: 13 }}
              />
            </div>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
              {filteredCompanies.length} companies found
            </span>
          </div>

          <button
            type="button"
            onClick={handleViewAllCompanies}
            disabled={loadingCompanies}
            className="c360-btn-secondary"
            style={{ height: 38, fontSize: 13 }}
          >
            {loadingCompanies ? <Loader2 size={14} className="c360-spinner" /> : <RotateCcw size={14} />} Refresh Directory
          </button>
        </div>

        {loadingCompanies ? (
          <div className="loading-overlay" style={{ height: '40vh' }}>
            <div className="spinner"></div>
            <p style={{ fontWeight: 600, color: '#374151' }}>Loading Corporate Directory...</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="c360-empty-prompt">
            <div className="c360-empty-prompt-icon">
              <Building2 size={28} />
            </div>
            <h3 className="c360-empty-prompt-title">No Corporate Records Found</h3>
            <p className="c360-empty-prompt-desc">
              {companies.length === 0
                ? 'Enter a BRN in the search form above or click "Refresh Directory" to load all registered companies.'
                : 'No companies match your current filter query.'}
            </p>
            {companies.length === 0 && (
              <button
                type="button"
                onClick={handleViewAllCompanies}
                className="c360-btn-primary"
                style={{ marginTop: 8 }}
              >
                <Building2 size={15} /> Load All Registered Companies
              </button>
            )}
          </div>
        ) : (
          <div className="c360-corp-grid">
            {filteredCompanies.map((company) => {
              const avatarBg = getAvatarBgColor(company.organizationName);
              const isActive = (company.onlineBankingActivationStatus || '').toLowerCase() === 'active';
              return (
                <div 
                  key={company.customerId} 
                  className="c360-corp-card"
                  onClick={() => {
                    useCustomerStore.setState({ activeCorporateId: company.brn as string });
                    loadActiveProfile();
                    setViewMode('details');
                  }}
                >
                  <div>
                    {/* Header: Avatar, Name, BRN, Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                        {getInitials(company.organizationName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={company.organizationName ?? undefined}>
                          {company.organizationName}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                          BRN: {company.brn || '-'}
                        </div>
                      </div>
                      <span className={isActive ? 'c360-badge c360-badge-success' : 'c360-badge c360-badge-warning'}>
                        {company.onlineBankingActivationStatus || '-'}
                      </span>
                    </div>

                    <div style={{ height: 1, background: '#f1f5f9', margin: '12px 0' }}></div>

                    {/* Content Fields */}
                    <div className="c360-data-grid-2" style={{ gap: 8 }}>
                      <div className="c360-data-item" style={{ padding: '8px 10px' }}>
                        <span className="c360-data-label">Type</span>
                        <span className="c360-data-value" style={{ fontSize: 12.5 }} title={company.organizationType ?? undefined}>{company.organizationType || '-'}</span>
                      </div>
                      <div className="c360-data-item" style={{ padding: '8px 10px' }}>
                        <span className="c360-data-label">Country</span>
                        <span className="c360-data-value" style={{ fontSize: 12.5 }} title={getCountryName(company.country)}>{getCountryName(company.country)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #f1f5f9', fontSize: 12.5, fontWeight: 600, color: '#2563eb' }}>
                    <span>View Customer 360</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (isIndividual && (!isSearched || !profile)) {
    return (
      <div>
        {renderIndividualSearchPanel()}

        {loading ? (
          <div className="loading-overlay" style={{ height: '40vh' }}>
            <div className="spinner"></div>
            <p style={{ fontWeight: 600, color: '#374151' }}>Searching Customer Profile...</p>
          </div>
        ) : (
          <div className="c360-empty-prompt">
            <div className="c360-empty-prompt-icon">
              <User size={28} />
            </div>
            <h3 className="c360-empty-prompt-title">No Customer Profile Selected</h3>
            <p className="c360-empty-prompt-desc">
              Select an ID type above (NRIC, Phone Number, Full Name, or Secondary ID) and enter the value to view the complete Customer 360 profile.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-overlay" style={{ height: '70vh' }}>
        <div className="spinner"></div>
        <p style={{ fontWeight: 600, color: '#374151' }}>Loading Customer 360 Workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {isIndividual ? renderIndividualSearchPanel() : renderCorporateSearchPanel()}
        <div className="error-container" style={{ marginTop: 20 }}>
          <h3>Error Loading Profile</h3>
          <p>{getFriendlyErrorMessage({ message: error ?? undefined, status: errorStatus ?? undefined }, isIndividual ? 'individual-search' : 'corporate-search')}</p>
          <button className="c360-btn-primary" onClick={loadActiveProfile} style={{ marginTop: 12 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        {isIndividual ? renderIndividualSearchPanel() : renderCorporateSearchPanel()}
        <div className="c360-empty-prompt" style={{ marginTop: 20 }}>
          <div className="c360-empty-prompt-icon">
            <Search size={28} />
          </div>
          <h3 className="c360-empty-prompt-title">No Active Profile Loaded</h3>
          <p className="c360-empty-prompt-desc">
            Use the search form above to find and load a customer record.
          </p>
        </div>
      </div>
    );
  }

  // `profile` is CustomerProfile = IndividualProfile | CorporateProfile. This
  // component renders one shape or the other depending on `isIndividual`, so
  // narrow with two aliases (both referencing the exact same object at
  // runtime) rather than scattering individual casts — matches the pattern
  // already used in AllProducts.tsx / AllInteractions.tsx.
  const individualProfile = profile as IndividualProfile;
  const corporateProfile = profile as CorporateProfile;

  return (
    <div>
      {isIndividual ? renderIndividualSearchPanel() : renderCorporateSearchPanel()}

      {isIndividual ? (
        <div>
          {/* Back to Search strip */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handleBackToSearch}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                backgroundColor: '#FFFFFF',
                color: '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#004EEB'; e.currentTarget.style.color = '#004EEB'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#374151'; }}
            >
              <ArrowLeft size={15} />
              Back to Search
            </button>
          </div>
          <div className="customer-layout-container">

          {/* Left Column: Summary Card */}
          <div className="customer-left-column">
            {/* Purple circle avatar */}
            <div style={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              backgroundColor: '#004EEB', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#FFFFFF', 
              fontSize: 28, 
              fontWeight: 700, 
              marginBottom: 16 
            }}>
              {getInitials(individualProfile.fullName)}
            </div>

            {/* Name and Title */}
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', margin: '0 0 4px 0', textAlign: 'center' }}>
              {individualProfile.fullName}
            </h3>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, textAlign: 'center' }}>
              Job Title: {individualProfile.designation || '-'}
            </div>

            {/* Badges */}
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#004EEB',
              backgroundColor: '#E6EEFF',
              padding: '4px 12px',
              borderRadius: 16,
              marginBottom: 20
            }}>
              Customer Status: {individualProfile.flags || '-'}
            </span>

            {/* Divider line for visual layout */}
            <div style={{ width: '100%', height: '1px', backgroundColor: '#E5E7EB', margin: '16px 0' }}></div>

            {/* Navigation buttons inside left card */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 12 }}>
              {/* Customer Details Group */}
              <div>
                <button 
                  className="left-tab-btn" 
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  style={{ justifyContent: 'space-between', fontWeight: 800, color: '#374151', paddingBottom: 6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <User size={16} />
                    <span>Customer Details</span>
                  </div>
                  {detailsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {detailsExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, paddingLeft: 12 }}>
                    <button 
                      className={`left-tab-btn ${activeTab === 'personal_details' ? 'active' : ''}`}
                      onClick={() => setActiveTab('personal_details')}
                      style={{ fontSize: 13, padding: '8px 12px', fontWeight: activeTab === 'personal_details' ? 700 : 500 }}
                    >
                      Personal Details
                    </button>
                    <button 
                      className={`left-tab-btn ${activeTab === 'residency_contact_details' ? 'active' : ''}`}
                      onClick={() => setActiveTab('residency_contact_details')}
                      style={{ fontSize: 13, padding: '8px 12px', fontWeight: activeTab === 'residency_contact_details' ? 700 : 500 }}
                    >
                      Residency & Contact Details
                    </button>
                    <button 
                      className={`left-tab-btn ${activeTab === 'employment_details' ? 'active' : ''}`}
                      onClick={() => setActiveTab('employment_details')}
                      style={{ fontSize: 13, padding: '8px 12px', fontWeight: activeTab === 'employment_details' ? 700 : 500 }}
                    >
                      Employment Details
                    </button>
                    <button 
                      className={`left-tab-btn ${activeTab === 'additional_relationship_details' ? 'active' : ''}`}
                      onClick={() => setActiveTab('additional_relationship_details')}
                      style={{ fontSize: 13, padding: '8px 12px', fontWeight: activeTab === 'additional_relationship_details' ? 700 : 500 }}
                    >
                      Additional & Relationship Details
                    </button>
                  </div>
                )}
              </div>

              {/* Divider between sections */}
              <div style={{ width: '100%', height: '1px', backgroundColor: '#F3F4F6', margin: '4px 0' }}></div>

              {/* Customer Workspace Group */}
              <div>
                <button 
                  className="left-tab-btn" 
                  onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
                  style={{ justifyContent: 'space-between', fontWeight: 800, color: '#374151', paddingBottom: 6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Briefcase size={16} />
                    <span>Customer Workspace</span>
                  </div>
                  {workspaceExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {workspaceExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, paddingLeft: 12 }}>
                    <button 
                      className={`left-tab-btn ${activeTab === 'user_interactions' ? 'active' : ''}`}
                      onClick={() => setActiveTab('user_interactions')}
                      style={{ fontSize: 13, padding: '8px 12px', fontWeight: activeTab === 'user_interactions' ? 700 : 500 }}
                    >
                      User Interactions
                    </button>
                    <button 
                      className={`left-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                      onClick={() => setActiveTab('products')}
                      style={{ fontSize: 13, padding: '8px 12px', fontWeight: activeTab === 'products' ? 700 : 500 }}
                    >
                      Products
                    </button>
                    <button 
                      className={`left-tab-btn ${activeTab === 'rm_details' ? 'active' : ''}`}
                      onClick={() => setActiveTab('rm_details')}
                      style={{ fontSize: 13, padding: '8px 12px', fontWeight: activeTab === 'rm_details' ? 700 : 500 }}
                    >
                      RM Details
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Content Workspace */}
          <div className="customer-right-column">

            {/* Tab switchers moved to left column */}

            {/* Active Content container */}
            <div 
              className={['personal_details', 'residency_contact_details', 'employment_details', 'additional_relationship_details', 'overview', 'company_info', 'contact_relationship', 'rmManager'].includes(activeTab) ? "" : "data-table-container"}
              style={
                ['personal_details', 'residency_contact_details', 'employment_details', 'additional_relationship_details', 'overview', 'company_info', 'contact_relationship', 'rmManager'].includes(activeTab)
                  ? { padding: '8px 4px' }
                  : { padding: '16px 20px', backgroundColor: '#FFFFFF' }
              }
            >
              {/* DETAILS TABS & WORKSPACE DIRECT SECTIONS */}
              {['personal_details', 'residency_contact_details', 'employment_details', 'additional_relationship_details'].includes(activeTab) && (
                <IndividualDetails
                  subTab={activeTab}
                  profile={individualProfile}
                  contactInfo={contactInfo}
                />
              )}

              {/* USER INTERACTIONS TAB */}
              {activeTab === 'user_interactions' && (
                <div>
                  {/* Search & filters */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16 }}>
                    <div style={{ position: 'relative', flexGrow: 1, maxWidth: 360 }}>
                      <input 
                        type="text" 
                        placeholder="Search interactions..." 
                        value={intSearchQuery}
                        onChange={(e) => {
                          setIntSearchQuery(e.target.value);
                          setIntPageNumber(1);
                        }}
                        style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #E5E7EB', outline: 'none', fontSize: 13 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button 
                        className="btn" 
                        style={{ 
                          height: 38,
                          backgroundColor: intShowFilter ? '#EFF6FF' : '#FFFFFF',
                          borderColor: intShowFilter ? '#004EEB' : '#E5E7EB',
                          color: intShowFilter ? '#004EEB' : '#374151'
                        }}
                        onClick={() => setIntShowFilter(!intShowFilter)}
                      >
                        <SlidersHorizontal size={13} style={{ marginRight: 6 }} />
                        Filter
                      </button>
                      <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}>
                        Show
                        <select 
                          value={intShowMode}
                          onChange={(e) => {
                            setIntShowMode(e.target.value);
                            setIntPageNumber(1);
                          }}
                          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', fontSize: 13 }}
                        >
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="custom">Custom</option>
                          <option value="all">All</option>
                        </select>
                        {intShowMode === 'custom' && (
                          <input 
                            type="number" 
                            min="1"
                            value={intCustomSize}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val > 0) {
                                setIntCustomSize(val);
                                setIntPageNumber(1);
                              } else {
                                setIntCustomSize(e.target.value);
                              }
                            }}
                            style={{ width: 60, height: 30, padding: '0 8px', borderRadius: 4, border: '1px solid #E5E7EB', outline: 'none', fontSize: 13 }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {intShowFilter && (
                    <div style={{ 
                      display: 'flex', 
                      gap: 16, 
                      marginTop: -10,
                      marginBottom: 20, 
                      padding: 12, 
                      backgroundColor: '#F9FAFB', 
                      borderRadius: 6, 
                      border: '1px solid #E5E7EB',
                      alignItems: 'center' 
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Status</label>
                        <select 
                          value={intStatusFilter} 
                          onChange={(e) => {
                            setIntStatusFilter(e.target.value);
                            setIntPageNumber(1);
                          }}
                          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontSize: 12, outline: 'none' }}
                        >
                          <option value="">All Statuses</option>
                          {intData.uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <button 
                        className="btn" 
                        onClick={() => { setIntStatusFilter(''); setIntPageNumber(1); }}
                        style={{ alignSelf: 'flex-end', height: 28, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF' }}
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {loadingInteractions ? (
                    <div style={{ padding: 24, textAlign: 'center' }}>Loading interactions...</div>
                  ) : interactionsError ? (
                    <div className="error-container">
                      <p>{getFriendlyErrorMessage({ message: interactionsError })}</p>
                      <button className="btn btn-primary" onClick={() => loadInteractions(individualProfile.nationalId as string)} style={{ marginTop: 12 }}>
                        Retry
                      </button>
                    </div>
                  ) : intData.filtered.length === 0 ? (
                    <div className="empty-state">No interactions found.</div>
                  ) : (
                    <div className="table-responsive-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Case ID</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Source</th>
                          <th>Classification</th>
                          <th>Date Complaint</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInteractions.map((item) => (
                          <tr key={item.caseId}>
                            <td className="account-num-text">{formatValue(item.caseId)}</td>
                            <td>{formatValue(item.category)}</td>
                            <td>
                              <span className={`status-badge ${
                                (getLegacyInteractionField(item, 'status') || item.statusParent || '').toLowerCase().includes('closed') ? 'status-validated' :
                                (getLegacyInteractionField(item, 'status') || item.statusParent || '').toLowerCase().includes('progress') ? 'status-wip' : 'status-pending'
                              }`}>
                                {formatValue(getLegacyInteractionField(item, 'status') || item.statusParent)}
                              </span>
                            </td>
                            <td>{formatValue(getLegacyInteractionField(item, 'source') || item.sourceName)}</td>
                            <td>{formatValue(item.classification || item.subCategory1)}</td>
                            <td>{formatValue((item.dateComplaint || item.dateCase || '').split(' ')[0] || item.positionDate)}</td>
                            <td>
                              <span 
                                className="action-link" 
                                style={{ color: '#004EEB', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => openCaseModal(item)}
                              >
                                <Eye size={13} />
                                View
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}

                  {/* Pagination */}
                  {intTotalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                      <button 
                        className="btn" 
                        style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                        disabled={safeIntPageNumber === 1}
                        onClick={() => setIntPageNumber(safeIntPageNumber - 1)}
                      >
                        &lt;
                      </button>
                      {Array.from({ length: intTotalPages }, (_, i) => i + 1).map((p) => (
                        <button 
                          key={p} 
                          className="btn" 
                          style={{ 
                            width: 32, 
                            height: 32, 
                            borderRadius: '50%', 
                            padding: 0, 
                            justifyContent: 'center', 
                            backgroundColor: safeIntPageNumber === p ? '#004EEB' : '#FFFFFF', 
                            color: safeIntPageNumber === p ? '#FFFFFF' : '#374151', 
                            borderColor: safeIntPageNumber === p ? '#004EEB' : '#E5E7EB' 
                          }}
                          onClick={() => setIntPageNumber(p)}
                        >
                          {p}
                        </button>
                      ))}
                      <button 
                        className="btn" 
                        style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                        disabled={safeIntPageNumber === intTotalPages}
                        onClick={() => setIntPageNumber(safeIntPageNumber + 1)}
                      >
                        &gt;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* PRODUCTS TAB */}
              {activeTab === 'products' && (
                <div>
                  {/* Tabbed layout for Products Held / Interested Products */}
                  <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #E5E7EB', paddingBottom: 12, marginBottom: 24 }}>
                    <span 
                      style={{ 
                        fontWeight: 700, 
                        fontSize: 13, 
                        color: productsTab === 'held' ? '#004EEB' : '#6B7280', 
                        cursor: 'pointer', 
                        borderBottom: productsTab === 'held' ? '2px solid #004EEB' : 'none', 
                        paddingBottom: 10 
                      }}
                      onClick={() => setProductsTab('held')}
                    >
                      Product Held
                    </span>
                    <span 
                      style={{ 
                        fontWeight: 700, 
                        fontSize: 13, 
                        color: productsTab === 'interested' ? '#004EEB' : '#6B7280', 
                        cursor: 'pointer', 
                        borderBottom: productsTab === 'interested' ? '2px solid #004EEB' : 'none', 
                        paddingBottom: 10 
                      }}
                      onClick={() => setProductsTab('interested')}
                    >
                      Interested Products
                    </span>
                  </div>

                  {productsTab === 'held' && (
                    <div>
                      {/* Search & filters */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16 }}>
                        <div style={{ position: 'relative', flexGrow: 1, maxWidth: 360 }}>
                          <input 
                            type="text" 
                            placeholder="Search products..." 
                            value={indSearchQuery}
                            onChange={(e) => setIndSearchQuery(e.target.value)}
                            style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #E5E7EB', outline: 'none', fontSize: 13 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button 
                            className="btn" 
                            style={{ 
                              height: 38, 
                              backgroundColor: indShowFilter ? '#EFF6FF' : '#FFFFFF', 
                              borderColor: indShowFilter ? '#004EEB' : '#E5E7EB', 
                              color: indShowFilter ? '#004EEB' : '#374151' 
                            }}
                            onClick={() => setIndShowFilter(!indShowFilter)}
                          >
                            <SlidersHorizontal size={13} style={{ marginRight: 6 }} />
                            Filter
                          </button>
                          <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}>
                            Show
                            <select 
                              value={indShowMode}
                              onChange={(e) => {
                                const mode = e.target.value;
                                setIndShowMode(mode);
                                const customerId = individualProfile.nationalId as string;
                                if (mode === '5') {
                                  loadProducts(customerId, 1, 5);
                                } else if (mode === '10') {
                                  loadProducts(customerId, 1, 10);
                                } else if (mode === 'custom') {
                                  const size = parseInt(String(indCustomSize), 10);
                                  const finalSize = (!isNaN(size) && size > 0) ? size : 5;
                                  loadProducts(customerId, 1, finalSize);
                                } else if (mode === 'all') {
                                  const targetSize = totalCount > 0 ? totalCount : 1000;
                                  loadProducts(customerId, 1, targetSize);
                                }
                              }}
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', fontSize: 13 }}
                            >
                              <option value="5">5</option>
                              <option value="10">10</option>
                              <option value="custom">Custom</option>
                              <option value="all">All</option>
                            </select>
                            {indShowMode === 'custom' && (
                              <input 
                                type="number" 
                                min="1" 
                                value={indCustomSize} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val > 0) {
                                    setIndCustomSize(val);
                                    const customerId = individualProfile.nationalId as string;
                                    loadProducts(customerId, 1, val);
                                  } else {
                                    setIndCustomSize(e.target.value);
                                  }
                                }}
                                style={{ width: 60, height: 30, padding: '0 8px', borderRadius: 4, border: '1px solid #E5E7EB', outline: 'none', fontSize: 13 }}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {indShowFilter && (
                        <div style={{ 
                          display: 'flex', 
                          gap: 16, 
                          marginTop: -10,
                          marginBottom: 20, 
                          padding: 12, 
                          backgroundColor: '#F9FAFB', 
                          borderRadius: 6, 
                          border: '1px solid #E5E7EB',
                          alignItems: 'center' 
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Product Type</label>
                            <select 
                              value={indTypeFilter} 
                              onChange={(e) => setIndTypeFilter(e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontSize: 12, outline: 'none' }}
                            >
                              <option value="">All Types</option>
                              {indData.uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Status</label>
                            <select 
                              value={indStatusFilter} 
                              onChange={(e) => setIndStatusFilter(e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontSize: 12, outline: 'none' }}
                            >
                              <option value="">All Statuses</option>
                              {indData.uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>

                          <button 
                            className="btn" 
                            onClick={() => { setIndTypeFilter(''); setIndStatusFilter(''); }}
                            style={{ alignSelf: 'flex-end', height: 28, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF' }}
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {loadingProducts ? (
                        <div style={{ padding: 24, textAlign: 'center' }}>Loading products...</div>
                      ) : productsError ? (
                        <div className="error-container">
                          <p>{getFriendlyErrorMessage({ message: productsError })}</p>
                          <button className="btn btn-primary" onClick={() => loadProducts(individualProfile.nationalId as string, pageNumber, pageSize)} style={{ marginTop: 12 }}>
                            Retry
                          </button>
                        </div>
                      ) : indData.filtered.length === 0 ? (
                        <div className="empty-state">No products found.</div>
                      ) : (
                        <div className="table-responsive-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr>
                              <th>Product Name</th>
                              <th>Type</th>
                              <th>Account No</th>
                              <th>Tenure</th>
                              <th>Account Status</th>
                              <th>Balance</th>
                              <th>Outstanding</th>
                              <th>Maturity Date</th>
                              <th>Timeline & Summary</th>
                              <th>Campaign Code</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {indData.filtered.map((item) => (
                              <tr key={item.accountNumber || getLegacyProductField(item, 'accountNo')}>
                                <td style={{ fontWeight: 700, color: '#004EEB' }}>{formatValue(item.productName)}</td>
                                <td>{formatValue(item.type || item.productCategory)}</td>
                                <td className="account-num-text">{formatValue(item.accountNumber || getLegacyProductField(item, 'accountNo'))}</td>
                                <td>{formatValue(item.tenure)}</td>
                                <td>
                                  <span className={`status-badge ${
                                    (item.derivedAccountStatus || item.financingStatus || '').toLowerCase().includes('active') ? 'status-active' : 'status-pending'
                                  }`} style={{
                                    backgroundColor: (item.derivedAccountStatus || item.financingStatus || '').toLowerCase().includes('active') ? '#ECFDF5' : '#FCE7F3',
                                    color: (item.derivedAccountStatus || item.financingStatus || '').toLowerCase().includes('active') ? '#065F46' : '#9D174D',
                                    border: 'none'
                                  }}>
                                    {formatValue(item.derivedAccountStatus || item.financingStatus)}
                                  </span>
                                </td>
                                <td>{formatCurrency(item.balances || getLegacyProductField(item, 'placementAmount'))}</td>
                                <td>{formatCurrency(item.outstanding)}</td>
                                <td>{formatValue(item.maturityDate)}</td>
                                <td>{formatValue(getLegacyProductField(item, 'timelineSummary') || getLegacyProductField(item, 'timelineAndSummary'))}</td>
                                <td>{formatValue(item.campaignCode)}</td>
                                <td>
                                  <span
                                    className="action-link"
                                    style={{ color: '#004EEB', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => openProductModal((item.accountNumber || getLegacyProductField(item, 'accountNo')) as string, (item.type || item.productCategory) as string)}
                                  >
                                    <Eye size={13} />
                                    View
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      )}

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                          <button 
                            className="btn" 
                            style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                            disabled={pageNumber === 1 || loadingProducts}
                            onClick={() => loadProducts(individualProfile.nationalId as string, pageNumber - 1)}
                          >
                            &lt;
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <button 
                              key={p} 
                              className="btn" 
                              style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: '50%', 
                                padding: 0, 
                                justifyContent: 'center', 
                                backgroundColor: pageNumber === p ? '#004EEB' : '#FFFFFF', 
                                color: pageNumber === p ? '#FFFFFF' : '#374151', 
                                borderColor: pageNumber === p ? '#004EEB' : '#E5E7EB' 
                              }}
                              disabled={loadingProducts}
                              onClick={() => loadProducts(individualProfile.nationalId as string, p)}
                            >
                              {p}
                            </button>
                          ))}
                          <button 
                            className="btn" 
                            style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                            disabled={pageNumber === totalPages || loadingProducts}
                            onClick={() => loadProducts(individualProfile.nationalId as string, pageNumber + 1)}
                          >
                            &gt;
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {productsTab === 'interested' && (
                    <div className="table-responsive-wrapper">
                      <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Product Name</th>
                            <th>Product Category</th>
                            <th>Engagement Count</th>
                            <th>Eligibility Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.interestedProductName || profile.interestedProductCategory ? (
                            <tr>
                              <td style={{ fontWeight: 700, color: '#004EEB' }}>{formatValue(profile.interestedProductName)}</td>
                              <td>{formatValue(profile.interestedProductCategory)}</td>
                              <td>{formatValue(profile.engagementCount)}</td>
                              <td>{formatValue(profile.eligibilityScore)}</td>
                            </tr>
                          ) : (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                                No interested products found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* RM DETAILS TAB */}
              {activeTab === 'rm_details' && (
                <div className="table-responsive-wrapper">
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>RM Name</th>
                        <th>RM ID</th>
                        <th>RM Branch Code</th>
                        <th>RM Contact Number</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.rmName || profile.rmId ? (
                        <tr>
                          <td style={{ fontWeight: 700, color: '#004EEB' }}>{formatValue(profile.rmName)}</td>
                          <td className="account-num-text">{formatValue(profile.rmId)}</td>
                          <td>{formatValue(profile.rmBranchCode)}</td>
                          <td>{formatValue(profile.rmContactNo)}</td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                            No Relationship Manager details found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div>
          {/* Back to Search strip */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handleBackToSearchCorp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                backgroundColor: '#FFFFFF',
                color: '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#004EEB'; e.currentTarget.style.color = '#004EEB'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#374151'; }}
            >
              <ArrowLeft size={15} />
              Back to Search
            </button>
          </div>
          <div className="customer-layout-container">
          {/* Left Column: Summary Card */}
          <div className="customer-left-column">
            {/* Blue circle avatar for company */}
            <div style={{ 
               width: 80, 
               height: 80, 
               borderRadius: '50%', 
               backgroundColor: '#004EEB', 
               display: 'flex', 
               alignItems: 'center', 
               justifyContent: 'center', 
               color: '#FFFFFF', 
               fontSize: 28, 
               fontWeight: 700, 
               marginBottom: 16 
             }}>
               {getInitials(corporateProfile.organizationName)}
             </div>

            {/* Company Name */}
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', margin: '0 0 4px 0', textAlign: 'center' }}>
              {corporateProfile.organizationName}
            </h3>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, textAlign: 'center' }}>
              BRN: {corporateProfile.brn || '-'}
            </div>

            {/* Badges */}
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#004EEB',
              backgroundColor: '#E6EEFF',
              padding: '4px 12px',
              borderRadius: 16,
              marginBottom: 20
            }}>
              Customer Status: {corporateProfile.lifecycleTrig || '-'}
            </span>

            {/* Divider line for visual layout */}
            <div style={{ width: '100%', height: '1px', backgroundColor: '#E5E7EB', margin: '16px 0' }}></div>

            {/* Navigation buttons inside left card */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
              <button 
                className={`left-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  backgroundColor: activeTab === 'overview' ? 'rgba(0, 78, 235, 0.08)' : 'transparent',
                  color: activeTab === 'overview' ? '#004EEB' : '#4B5563'
                }}
              >
                <Building2 size={16} />
                Company Overview
              </button>

              <button 
                className={`left-tab-btn ${activeTab === 'company_info' ? 'active' : ''}`}
                onClick={() => setActiveTab('company_info')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  backgroundColor: activeTab === 'company_info' ? 'rgba(0, 78, 235, 0.08)' : 'transparent',
                  color: activeTab === 'company_info' ? '#004EEB' : '#4B5563'
                }}
              >
                <Briefcase size={16} />
                Company Information
              </button>

              <button 
                 className={`left-tab-btn ${activeTab === 'contact_relationship' ? 'active' : ''}`}
                 onClick={() => setActiveTab('contact_relationship')}
                 style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 10,
                   width: '100%',
                   padding: '10px 14px',
                   borderRadius: 8,
                   border: 'none',
                   fontSize: 13,
                   fontWeight: 600,
                   cursor: 'pointer',
                   textAlign: 'left',
                   transition: 'all 0.2s',
                   backgroundColor: activeTab === 'contact_relationship' ? 'rgba(0, 78, 235, 0.08)' : 'transparent',
                   color: activeTab === 'contact_relationship' ? '#004EEB' : '#4B5563'
                 }}
               >
                 <Phone size={16} />
                 Contact & Relationship
               </button>
 
               <button 
                 className={`left-tab-btn ${activeTab === 'rmManager' ? 'active' : ''}`}
                 onClick={() => setActiveTab('rmManager')}
                 style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 10,
                   width: '100%',
                   padding: '10px 14px',
                   borderRadius: 8,
                   border: 'none',
                   fontSize: 13,
                   fontWeight: 600,
                   cursor: 'pointer',
                   textAlign: 'left',
                   transition: 'all 0.2s',
                   backgroundColor: activeTab === 'rmManager' ? 'rgba(0, 78, 235, 0.08)' : 'transparent',
                   color: activeTab === 'rmManager' ? '#004EEB' : '#4B5563'
                 }}
               >
                 <User size={16} />
                 RM Manager Information
               </button>
 
               <button 
                 className={`left-tab-btn ${activeTab === 'products_signatories' ? 'active' : ''}`}
                 onClick={() => {
                   setActiveTab('products_signatories');
                   setCorpSubTab('products');
                 }}
                 style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 10,
                   width: '100%',
                   padding: '10px 14px',
                   borderRadius: 8,
                   border: 'none',
                   fontSize: 13,
                   fontWeight: 600,
                   cursor: 'pointer',
                   textAlign: 'left',
                   transition: 'all 0.2s',
                   backgroundColor: activeTab === 'products_signatories' ? 'rgba(0, 78, 235, 0.08)' : 'transparent',
                   color: activeTab === 'products_signatories' ? '#004EEB' : '#4B5563'
                 }}
               >
                 <Layers size={16} />
                 Products & Signatories
               </button>

              <button 
                className={`left-tab-btn ${activeTab === 'interestedProducts' ? 'active' : ''}`}
                onClick={() => setActiveTab('interestedProducts')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  backgroundColor: activeTab === 'interestedProducts' ? 'rgba(0, 78, 235, 0.08)' : 'transparent',
                  color: activeTab === 'interestedProducts' ? '#004EEB' : '#4B5563'
                }}
              >
                <TrendingUp size={16} />
                Interested Products
              </button>
            </div>
          </div>

          {/* Right Column: Content Workspace */}
          <div className="customer-right-column">

            <div 
              className={['overview', 'company_info', 'contact_relationship', 'rmManager'].includes(activeTab) ? "" : "data-table-container"}
              style={
                ['overview', 'company_info', 'contact_relationship', 'rmManager'].includes(activeTab)
                  ? { padding: '8px 4px' }
                  : { padding: '16px 20px', backgroundColor: '#FFFFFF' }
              }
            >
              {/* COMPANY OVERVIEW */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Company Details */}
                  <SectionContainer title="Company Details" icon={<Building2 size={16} />}>
                    <div className="info-cards-grid">
                      <div className="info-card">
                        <div className="info-label">
                          <Building2 size={14} />
                          Type of Organization
                        </div>
                        <div className="info-value">
                          {corporateProfile.organizationType || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Globe size={14} />
                          Country of Incorporation
                        </div>
                        <div className="info-value">
                          {corporateProfile.country || '-'}
                        </div>
                      </div>
                    </div>
                  </SectionContainer>

                  {/* Online Banking Status */}
                  <SectionContainer title="Online Banking Status" icon={<Globe size={16} />}>
                    <div className="info-cards-grid">
                      <div className="info-card">
                        <div className="info-label">
                          <User size={14} />
                          Online Banking Registration Status
                        </div>
                        <div className="info-value">
                          {corporateProfile.onlineBankingRegistrationStatus || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Shield size={14} />
                          Online Banking Activation Status
                        </div>
                        <div className="info-value">
                          {corporateProfile.onlineBankingActivationStatus || '-'}
                        </div>
                      </div>
                    </div>
                  </SectionContainer>

                  {/* Business Registration */}
                  <SectionContainer title="Business Registration" icon={<FileText size={16} />}>
                    <div className="info-cards-grid">
                      <div className="info-card">
                        <div className="info-label">
                          <Calendar size={14} />
                          Date of Business Registration
                        </div>
                        <div className="info-value">
                          {corporateProfile.businessRegDate || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Calendar size={14} />
                          Organization Onboarding Date
                        </div>
                        <div className="info-value">
                          {profile.openingDate || '-'}
                        </div>
                      </div>
                    </div>
                  </SectionContainer>
                </div>
              )}

              {/* COMPANY INFORMATION */}
              {activeTab === 'company_info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SectionContainer title="Company Information" icon={<Briefcase size={16} />}>
                    <div className="info-cards-grid">
                      <div className="info-card">
                        <div className="info-label">
                          <Building2 size={14} />
                          Organization Name
                        </div>
                        <div className="info-value">
                          {corporateProfile.organizationName || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <FileText size={14} />
                          Old Business Registration Number (BRN)
                        </div>
                        <div className="info-value">
                          {corporateProfile.brn || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <FileText size={14} />
                          New Business Registration Number (BRN)
                        </div>
                        <div className="info-value">
                          {corporateProfile.brn2 || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Building2 size={14} />
                          Economic Sector
                        </div>
                        <div className="info-value">
                          {corporateProfile.economicSector || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Globe size={14} />
                          Company Website
                        </div>
                        <div className="info-value" style={{ color: '#004EEB', wordBreak: 'break-all' }}>
                          {corporateProfile.companyWebsite ? (
                            <a href={corporateProfile.companyWebsite} target="_blank" rel="noreferrer" style={{ color: '#004EEB', textDecoration: 'none' }}>{corporateProfile.companyWebsite}</a>
                          ) : '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <FileText size={14} />
                          Tax Identification Number
                        </div>
                        <div className="info-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                          <span>{revealed['corpTin'] ? (corporateProfile.tin || '-') : maskTIN(corporateProfile.tin)}</span>
                          {corporateProfile.tin && corporateProfile.tin.trim() !== '' && corporateProfile.tin.toLowerCase() !== 'null' && (
                            <button
                              onClick={() => handleToggleReveal('corpTin', 'Tax Identification Number', corporateProfile.tin!)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title={revealed['corpTin'] ? 'Hide details' : 'Reveal details'}
                            >
                              {revealed['corpTin'] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <FileText size={14} />
                          CIF Number
                        </div>
                        <div className="info-value">
                          {corporateProfile.cifNumber || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <DollarSign size={14} />
                          Annual Income
                        </div>
                        <div className="info-value">
                          {profile.annualIncome || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Globe size={14} />
                          Resident Type
                        </div>
                        <div className="info-value">
                          {corporateProfile.residentType || '-'}
                        </div>
                      </div>

                      <div className="info-card full-width">
                        <div className="info-label">
                          <MapPin size={14} />
                          Resident Address
                        </div>
                        <div className="info-value">
                          {corporateProfile.residentAddress || '-'}
                        </div>
                      </div>
                    </div>
                  </SectionContainer>
                </div>
              )}

              {/* CONTACT & RELATIONSHIP INFORMATION */}
              {activeTab === 'contact_relationship' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Contact Information */}
                  <SectionContainer title="Contact Information" icon={<Phone size={16} />}>
                    <div className="info-cards-grid">
                      <div className="info-card">
                        <div className="info-label">
                          <Mail size={14} />
                          Email
                        </div>
                        <div className="info-value">
                          {contactInfo?.padrEmail1 || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Phone size={14} />
                          Phone Number
                        </div>
                        <div className="info-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                          <span>{revealed['corpPhone'] ? (contactInfo?.contactNumber || '-') : maskPhone(contactInfo?.contactNumber)}</span>
                          {contactInfo?.contactNumber && contactInfo.contactNumber.trim() !== '' && contactInfo.contactNumber.toLowerCase() !== 'null' && (
                            <button
                              onClick={() => handleToggleReveal('corpPhone', 'Corporate Phone Number', contactInfo.contactNumber!)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title={revealed['corpPhone'] ? 'Hide details' : 'Reveal details'}
                            >
                              {revealed['corpPhone'] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <TrendingUp size={14} />
                          Marketing Message Opt-In/Out
                        </div>
                        <div className="info-value">
                          {profile.marketMessageOpt || '-'}
                        </div>
                      </div>

                      <div className="info-card full-width">
                        <div className="info-label">
                          <MapPin size={14} />
                          Address
                        </div>
                        <div className="info-value">
                          {contactInfo?.fixedAddress || '-'}
                        </div>
                      </div>
                    </div>
                  </SectionContainer>

                  {/* Referral & Relationship */}
                  <SectionContainer title="Referrer & Relationship Information" icon={<Globe size={16} />}>
                    <div className="info-cards-grid">
                      <div className="info-card">
                        <div className="info-label">
                          <User size={14} />
                          Referrer Employee Name
                        </div>
                        <div className="info-value">
                          {profile.refEmployeeName || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Mail size={14} />
                          Referrer Employee Email
                        </div>
                        <div className="info-value">
                          {profile.refEmployeeEmail || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <Phone size={14} />
                          Referrer Employee Phone Number
                        </div>
                        <div className="info-value">
                          {corporateProfile.refEmployeePhoneNo || '-'}
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-label">
                          <FileText size={14} />
                          Staff ID
                        </div>
                        <div className="info-value">
                          {corporateProfile.refStaffId || '-'}
                        </div>
                      </div>
                    </div>
                  </SectionContainer>
                </div>
              )}

              {/* RM MANAGER INFORMATION */}
              {activeTab === 'rmManager' && (
                <SectionContainer title="RM Manager Information" icon={<User size={16} />}>
                  <div className="info-cards-grid">
                    <div className="info-card">
                      <div className="info-label">
                        <User size={14} />
                        RM Name
                      </div>
                      <div className="info-value">
                        {profile.rmName || '-'}
                      </div>
                    </div>

                    <div className="info-card">
                      <div className="info-label">
                        <FileText size={14} />
                        RM ID
                      </div>
                      <div className="info-value">
                        {profile.rmId || '-'}
                      </div>
                    </div>

                    <div className="info-card">
                      <div className="info-label">
                        <Building2 size={14} />
                        RM Branch Code
                      </div>
                      <div className="info-value">
                        {profile.rmBranchCode || '-'}
                      </div>
                    </div>

                    <div className="info-card">
                      <div className="info-label">
                        <Phone size={14} />
                        RM Contact Number
                      </div>
                      <div className="info-value">
                        {profile.rmContactNo || '-'}
                      </div>
                    </div>
                  </div>
                </SectionContainer>
              )}

              {/* PRODUCTS & SIGNATORIES TAB */}
              {activeTab === 'products_signatories' && (
                <div>
                  {/* Subtab Navigation side-by-side at the top */}
                  <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #E5E7EB', paddingBottom: 12, marginBottom: 24 }}>
                    <span 
                      style={{ 
                        fontWeight: 700, 
                        fontSize: 13, 
                        color: corpSubTab === 'products' ? '#004EEB' : '#6B7280', 
                        cursor: 'pointer', 
                        borderBottom: corpSubTab === 'products' ? '2px solid #004EEB' : 'none', 
                        paddingBottom: 10 
                      }}
                      onClick={() => setCorpSubTab('products')}
                    >
                      Products Held
                    </span>
                    <span 
                      style={{ 
                        fontWeight: 700, 
                        fontSize: 13, 
                        color: corpSubTab === 'signatories' ? '#004EEB' : '#6B7280', 
                        cursor: 'pointer', 
                        borderBottom: corpSubTab === 'signatories' ? '2px solid #004EEB' : 'none', 
                        paddingBottom: 10 
                      }}
                      onClick={() => setCorpSubTab('signatories')}
                    >
                      Signatories
                    </span>
                  </div>

                  {corpSubTab === 'products' ? (
                    <div>
                      {/* Search & filters */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16 }}>
                        <div style={{ position: 'relative', flexGrow: 1, maxWidth: 360 }}>
                          <input 
                            type="text" 
                            placeholder="Search products..." 
                            value={corpSearchQuery}
                            onChange={(e) => setCorpSearchQuery(e.target.value)}
                            style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #E5E7EB', outline: 'none', fontSize: 13 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button 
                            className="btn" 
                            style={{ 
                              height: 38, 
                              backgroundColor: corpShowFilter ? '#EFF6FF' : '#FFFFFF', 
                              borderColor: corpShowFilter ? '#004EEB' : '#E5E7EB', 
                              color: corpShowFilter ? '#004EEB' : '#374151' 
                            }}
                            onClick={() => setCorpShowFilter(!corpShowFilter)}
                          >
                            <SlidersHorizontal size={13} style={{ marginRight: 6 }} />
                            Filter
                          </button>
                          <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}>
                            Show
                            <select 
                              value={corpShowMode}
                              onChange={(e) => {
                                const mode = e.target.value;
                                setCorpShowMode(mode);
                                const customerId = corporateProfile.brn as string;
                                if (mode === '5') {
                                  loadProducts(customerId, 1, 5);
                                } else if (mode === '10') {
                                  loadProducts(customerId, 1, 10);
                                } else if (mode === 'custom') {
                                  const size = parseInt(String(corpCustomSize), 10);
                                  const finalSize = (!isNaN(size) && size > 0) ? size : 5;
                                  loadProducts(customerId, 1, finalSize);
                                } else if (mode === 'all') {
                                  const targetSize = totalCount > 0 ? totalCount : 1000;
                                  loadProducts(customerId, 1, targetSize);
                                }
                              }}
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', fontSize: 13 }}
                            >
                              <option value="5">5</option>
                              <option value="10">10</option>
                              <option value="custom">Custom</option>
                              <option value="all">All</option>
                            </select>
                            {corpShowMode === 'custom' && (
                              <input 
                                type="number" 
                                min="1" 
                                value={corpCustomSize} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val > 0) {
                                    setCorpCustomSize(val);
                                    const customerId = corporateProfile.brn as string;
                                    loadProducts(customerId, 1, val);
                                  } else {
                                    setCorpCustomSize(e.target.value);
                                  }
                                }}
                                style={{ width: 60, height: 30, padding: '0 8px', borderRadius: 4, border: '1px solid #E5E7EB', outline: 'none', fontSize: 13 }}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {corpShowFilter && (
                        <div style={{ 
                          display: 'flex', 
                          gap: 16, 
                          marginTop: -10,
                          marginBottom: 20, 
                          padding: 12, 
                          backgroundColor: '#F9FAFB', 
                          borderRadius: 6, 
                          border: '1px solid #E5E7EB',
                          alignItems: 'center' 
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Product Type</label>
                            <select 
                              value={corpTypeFilter} 
                              onChange={(e) => setCorpTypeFilter(e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontSize: 12, outline: 'none' }}
                            >
                              <option value="">All Types</option>
                              {corpData.uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Status</label>
                            <select 
                              value={corpStatusFilter} 
                              onChange={(e) => setCorpStatusFilter(e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontSize: 12, outline: 'none' }}
                            >
                              <option value="">All Statuses</option>
                              {corpData.uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>

                          <button 
                            className="btn" 
                            onClick={() => { setCorpTypeFilter(''); setCorpStatusFilter(''); }}
                            style={{ alignSelf: 'flex-end', height: 28, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF' }}
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {loadingProducts ? (
                        <div style={{ padding: 24, textAlign: 'center' }}>Loading products...</div>
                      ) : productsError ? (
                        <div className="error-container">
                          <p>{getFriendlyErrorMessage({ message: productsError })}</p>
                          <button className="btn btn-primary" onClick={() => loadProducts(corporateProfile.brn as string, pageNumber, pageSize)} style={{ marginTop: 12 }}>
                            Retry
                          </button>
                        </div>
                      ) : corpData.filtered.length === 0 ? (
                        <div className="empty-state">No products found.</div>
                      ) : (
                        <div>
                          <div className="table-responsive-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                          <table className="data-table">
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                              <tr>
                                <th>Category</th>
                                <th>Sub Category</th>
                                <th>Product Name</th>
                                <th>Account Number</th>
                                <th>Account Status</th>
                                <th>Balance</th>
                                <th>Outstanding</th>
                                <th>Last Contact Date</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {corpData.filtered.map((item) => (
                                <tr key={item.accountNumber}>
                                  <td>
                                    <span style={{
                                      padding: '4px 10px',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      backgroundColor: item.type === 'Deposit' ? '#EFF6FF' : '#FFFBEB',
                                      color: item.type === 'Deposit' ? '#1E40AF' : '#B45309'
                                    }}>
                                      {item.type}
                                    </span>
                                  </td>
                                  <td>{item.productCategory}</td>
                                  <td style={{ fontWeight: 600 }}>{item.productName}</td>
                                  <td className="account-num-text">{item.accountNumber}</td>
                                  <td>
                                    <span className={`status-badge ${
                                      (item.derivedAccountStatus || item.financingStatus || '').toLowerCase().includes('active') ? 'status-active' : 'status-validated'
                                    }`}>
                                      {item.derivedAccountStatus || item.financingStatus || '-'}
                                    </span>
                                  </td>
                                  <td>{item.balances || '-'}</td>
                                  <td>{item.outstanding || '-'}</td>
                                  <td>{item.lastContactDate || '-'}</td>
                                  <td>
                                    <span className="action-link" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => openProductModal(item.accountNumber, item.type as string)}>
                                      <Eye size={13} />
                                      View
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                          
                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                              <button 
                                className="btn" 
                                style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                                disabled={pageNumber === 1 || loadingProducts}
                                onClick={() => loadProducts(corporateProfile.brn as string, pageNumber - 1)}
                              >
                                &lt;
                              </button>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button 
                                  key={p} 
                                  className="btn" 
                                  style={{ 
                                    width: 32, 
                                    height: 32, 
                                    borderRadius: '50%', 
                                    padding: 0, 
                                    justifyContent: 'center', 
                                    backgroundColor: pageNumber === p ? '#004EEB' : '#FFFFFF', 
                                    color: pageNumber === p ? '#FFFFFF' : '#374151', 
                                    borderColor: pageNumber === p ? '#004EEB' : '#E5E7EB' 
                                  }}
                                  disabled={loadingProducts}
                                  onClick={() => loadProducts(corporateProfile.brn as string, p)}
                                >
                                  {p}
                                </button>
                              ))}
                              <button 
                                className="btn" 
                                style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                                disabled={pageNumber === totalPages || loadingProducts}
                                onClick={() => loadProducts(corporateProfile.brn as string, pageNumber + 1)}
                              >
                                &gt;
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h4 className="info-section-title">
                        <FileText size={16} />
                        Authorized Signatories
                      </h4>
                      <div className="table-responsive-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Signatory Name</th>
                            <th>Date of Birth</th>
                            <th>ID Number</th>
                            <th>Phone Number</th>
                            <th>Position</th>
                          </tr>
                        </thead>
                         <tbody>
                           <tr>
                             <td style={{ fontWeight: 600 }}>{corporateProfile.signatoryName || '-'}</td>
                             <td>{corporateProfile.signatoryDateOfBirth || '-'}</td>
                             <td>
                               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                 <span>{revealed['sigId'] ? (corporateProfile.signatoryIdNumber || '-') : maskNRIC(corporateProfile.signatoryIdNumber)}</span>
                                 {corporateProfile.signatoryIdNumber && corporateProfile.signatoryIdNumber.trim() !== '' && corporateProfile.signatoryIdNumber.toLowerCase() !== 'null' && (
                                   <button
                                     onClick={() => handleToggleReveal('sigId', 'Signatory ID Number', corporateProfile.signatoryIdNumber!)}
                                     style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                     title={revealed['sigId'] ? 'Hide details' : 'Reveal details'}
                                   >
                                     {revealed['sigId'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                   </button>
                                 )}
                               </div>
                             </td>
                             <td>
                               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                 <span>{revealed['sigPhone'] ? (corporateProfile.signatoryPhoneNumber || '-') : maskPhone(corporateProfile.signatoryPhoneNumber)}</span>
                                 {corporateProfile.signatoryPhoneNumber && corporateProfile.signatoryPhoneNumber.trim() !== '' && corporateProfile.signatoryPhoneNumber.toLowerCase() !== 'null' && (
                                   <button
                                     onClick={() => handleToggleReveal('sigPhone', 'Signatory Phone Number', corporateProfile.signatoryPhoneNumber!)}
                                     style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                     title={revealed['sigPhone'] ? 'Hide details' : 'Reveal details'}
                                   >
                                     {revealed['sigPhone'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                   </button>
                                 )}
                               </div>
                             </td>
                             <td>{corporateProfile.signatoryPosition || '-'}</td>
                           </tr>
                         </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* INTERESTED PRODUCTS */}
              {activeTab === 'interestedProducts' && (
                <div>
                  <h4 className="info-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#004EEB', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
                    <TrendingUp size={14} />
                    Interested Products
                  </h4>
                  <div className="table-responsive-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Product Category</th>
                        <th>Engagement Count</th>
                        <th>Eligibility Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600 }}>{formatValue(profile.interestedProductName || profile.interestedProduct)}</td>
                        <td>{formatValue(profile.interestedProductCategory)}</td>
                        <td>{formatValue(profile.engagementCount)}</td>
                        <td>{formatValue(profile.eligibilityScore)}</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}


      {/* Modals */}
      <CaseDetailsModal />
      <ProductDetailsModal />
    </div>
  );
}
