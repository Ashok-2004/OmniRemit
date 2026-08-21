import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers,
  Building2,
  Calendar,
  CreditCard,
  Phone,
  User,
  Flag,
  Search,
} from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';
import { FilterCriterion } from '../../types/lead';

interface LeadFilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  /** The Filter button's wrapping element. Positioning is computed from its live
   * getBoundingClientRect() rather than a CSS `position: absolute` parent, because the popover is
   * portaled to document.body to escape the table card's `overflow: hidden` (see ViewLeadPage.tsx's
   * "Main Table Container Card") — that ancestor clips the popover whenever the card's own height
   * collapses below the panel's ~400-480px floor height, which happens exactly when the filtered
   * list is empty. */
  anchorRef: React.RefObject<HTMLElement | null>;
}

const TABS: { id: FilterCriterion; label: string; icon: React.ReactNode }[] = [
  { id: 'product', label: 'Product', icon: <Layers size={16} /> },
  { id: 'branch', label: 'Branch', icon: <Building2 size={16} /> },
  { id: 'createdFrom', label: 'Created From', icon: <Calendar size={16} /> },
  { id: 'createdTo', label: 'Created To', icon: <Calendar size={16} /> },
  { id: 'icNumber', label: 'IC Number', icon: <CreditCard size={16} /> },
  { id: 'phone', label: 'Phone Number', icon: <Phone size={16} /> },
  { id: 'name', label: 'Name', icon: <User size={16} /> },
  { id: 'status', label: 'Status', icon: <Flag size={16} /> },
];

// Fallback shown only for the brief window before the real product list has loaded from the API.
// This used to list 8 products, 5 of which don't exist in LeadService's product catalog at all
// (Backend/LeadService/Data/ApplicationDbContext.cs only seeds ASB Financing, Home Financing, and
// Micro Finance) — trimmed to match what the backend actually has.
const DEFAULT_PRODUCTS = [
  'Home Financing',
  'ASB Financing',
  'Micro Finance',
];

const STATUSES = ['New', 'Contacted', 'In Progress', 'Qualified', 'Converted', 'Closed'];

export const LeadFilterPopover: React.FC<LeadFilterPopoverProps> = ({ isOpen, onClose, anchorRef }) => {
  const {
    products,
    branches,
    filterRules,
    updateFilterRule,
    removeFilterRule,
    clearAllFilters,
    fetchLeads,
  } = useLeadStore();

  const [activeTab, setActiveTab] = useState<FilterCriterion>('product');
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const popoverRef = useRef<HTMLDivElement>(null);
  // Viewport-relative coordinates for the portaled, position:'fixed' panel. Recomputed synchronously
  // before paint whenever it opens (and on resize/scroll while open) so it always tracks the button
  // it's anchored to, exactly like the old position:'absolute' layout did — just computed by hand
  // instead of by the CSS box model, since a portal has no positioned ancestor to be absolute to.
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRef]);

  // Close when clicking outside. popoverRef.current.contains(e.target) is unaffected by the portal —
  // it checks real DOM containment, which doesn't care where in the tree the node was mounted.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !coords) return null;

  // Helper to get rule value by field
  const getRuleValue = (field: FilterCriterion): string => {
    const rule = filterRules.find((r) => r.field === field);
    return rule ? rule.value : '';
  };

  // Helper to set rule value by field
  const setRuleValue = (field: FilterCriterion, value: string) => {
    const existingRule = filterRules.find((r) => r.field === field);
    if (!value || !value.trim()) {
      if (existingRule) {
        removeFilterRule(existingRule.id);
      }
    } else {
      if (existingRule) {
        updateFilterRule(existingRule.id, field, value);
      } else {
        const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        useLeadStore.setState((state) => ({
          filterRules: [...state.filterRules, { id, field, value }],
        }));
      }
    }
  };

  // Toggle value in comma-separated list
  const toggleMultiValue = (field: FilterCriterion, optionVal: string) => {
    const currentStr = getRuleValue(field);
    let list = currentStr ? currentStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (list.includes(optionVal)) {
      list = list.filter((item) => item !== optionVal);
    } else {
      list.push(optionVal);
    }
    setRuleValue(field, list.join(','));
  };

  const handleSearchChange = (field: string, val: string) => {
    setSearchQueries((prev) => ({ ...prev, [field]: val }));
  };

  const currentSearch = searchQueries[activeTab] || '';

  // Get master product list
  const allProducts = products.length > 0 ? products.map((p) => p.label) : DEFAULT_PRODUCTS;
  const filteredProducts = allProducts.filter((p) => p.toLowerCase().includes(currentSearch.toLowerCase()));

  // Get master branch list
  const allBranches = branches.map((b) => b.label);
  const filteredBranches = allBranches.filter((b) => b.toLowerCase().includes(currentSearch.toLowerCase()));

  // Get statuses
  const filteredStatuses = STATUSES.filter((s) => s.toLowerCase().includes(currentSearch.toLowerCase()));

  const handleReset = () => {
    clearAllFilters();
    setSearchQueries({});
    fetchLeads();
    onClose();
  };

  const handleApply = () => {
    fetchLeads();
    onClose();
  };

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: coords.top,
        right: coords.right,
        // Portaled into document.body's root stacking context, this now competes directly with
        // modals/toasts (.toast-notification is 1000, .drawer-overlay is 200) instead of the table
        // card's own stacking context it used to live inside — bumped above both.
        zIndex: 1200,
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
        width: '520px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Arrow Indicator */}
      <div
        style={{
          position: 'absolute',
          top: '-6px',
          right: '80px',
          width: '12px',
          height: '12px',
          background: '#ffffff',
          borderTop: '1px solid #cbd5e1',
          borderLeft: '1px solid #cbd5e1',
          transform: 'rotate(45deg)',
          zIndex: 1001,
        }}
      />

      {/* Main Content Split View */}
      <div style={{ display: 'flex', minHeight: '340px', maxHeight: '420px' }}>
        {/* Left Column — Subcategory Tabs */}
        <div
          style={{
            width: '180px',
            background: '#f8fafc',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 0',
          }}
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            const hasRule = !!getRuleValue(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '11px 16px',
                  border: 'none',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  color: isSelected ? '#2563eb' : '#475569',
                  fontWeight: isSelected ? 600 : 500,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <span style={{ color: isSelected ? '#2563eb' : '#64748b', display: 'flex' }}>
                  {tab.icon}
                </span>
                <span style={{ flex: 1 }}>{tab.label}</span>
                {hasRule && (
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#2563eb',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Column — Tab Specific Input Options */}
        <div
          style={{
            flex: 1,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
            {TABS.find((t) => t.id === activeTab)?.label}
          </div>

          {/* Tab 1: Product */}
          {activeTab === 'product' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search product..."
                  value={currentSearch}
                  onChange={(e) => handleSearchChange('product', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Checkbox Options — NO numbers rendered as requested */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                {filteredProducts.map((p) => {
                  const selectedList = getRuleValue('product').split(',').map((s) => s.trim());
                  const checked = selectedList.includes(p);

                  return (
                    <label
                      key={p}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        color: '#334155',
                        cursor: 'pointer',
                        fontWeight: checked ? 600 : 400,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMultiValue('product', p)}
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          accentColor: '#2563eb',
                          cursor: 'pointer',
                        }}
                      />
                      <span>{p}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Branch */}
          {activeTab === 'branch' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search branch..."
                  value={currentSearch}
                  onChange={(e) => handleSearchChange('branch', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                {filteredBranches.length > 0 ? (
                  filteredBranches.map((b) => {
                    const selectedList = getRuleValue('branch').split(',').map((s) => s.trim());
                    const checked = selectedList.includes(b);

                    return (
                      <label
                        key={b}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '13px',
                          color: '#334155',
                          cursor: 'pointer',
                          fontWeight: checked ? 600 : 400,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMultiValue('branch', b)}
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            accentColor: '#2563eb',
                            cursor: 'pointer',
                          }}
                        />
                        <span>{b}</span>
                      </label>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '13px', color: '#94a3b8', padding: '12px 0' }}>
                    No branches found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Created From */}
          {activeTab === 'createdFrom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
                Select Start Creation Date
              </label>
              <input
                type="date"
                value={getRuleValue('createdFrom')}
                onChange={(e) => setRuleValue('createdFrom', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Tab 5: Created To */}
          {activeTab === 'createdTo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
                Select End Creation Date
              </label>
              <input
                type="date"
                value={getRuleValue('createdTo')}
                onChange={(e) => setRuleValue('createdTo', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Tab 6: IC Number */}
          {activeTab === 'icNumber' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
                Search IC Number
              </label>
              <input
                type="text"
                placeholder="Enter IC Number (e.g. 123456-98-7890)"
                value={getRuleValue('icNumber')}
                onChange={(e) => setRuleValue('icNumber', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Tab 7: Phone Number */}
          {activeTab === 'phone' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
                Search Phone Number
              </label>
              <input
                type="text"
                placeholder="Enter Phone Number (e.g. 897657863)"
                value={getRuleValue('phone')}
                onChange={(e) => setRuleValue('phone', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Tab 8: Name */}
          {activeTab === 'name' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
                Search Customer Name
              </label>
              <input
                type="text"
                placeholder="Enter Customer Name..."
                value={getRuleValue('name')}
                onChange={(e) => setRuleValue('name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Tab 9: Status */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search status..."
                  value={currentSearch}
                  onChange={(e) => handleSearchChange('status', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                {filteredStatuses.map((st) => {
                  const selectedList = getRuleValue('status').split(',').map((item) => item.trim());
                  const checked = selectedList.includes(st);

                  return (
                    <label
                      key={st}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        color: '#334155',
                        cursor: 'pointer',
                        fontWeight: checked ? 600 : 400,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMultiValue('status', st)}
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          accentColor: '#2563eb',
                          cursor: 'pointer',
                        }}
                      />
                      <span>{st}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div
        style={{
          padding: '12px 18px',
          background: '#ffffff',
          borderTop: '1px solid #eaecf0',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          type="button"
          onClick={handleReset}
          className="drawer-btn-cancel"
          style={{
            height: '36px',
            padding: '0 16px',
            fontSize: '13px',
            borderRadius: '10px',
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="drawer-btn-create"
          style={{
            height: '36px',
            padding: '0 18px',
            fontSize: '13px',
            borderRadius: '10px',
          }}
        >
          Apply Filters
        </button>
      </div>
    </div>,
    document.body,
  );
};
