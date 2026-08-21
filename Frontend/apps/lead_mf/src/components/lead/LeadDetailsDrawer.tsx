import React, { useEffect, useRef, useState } from 'react';
import { X, User, Package, Briefcase, UserCheck, FileText, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';
import { isFieldVisible, getFieldLabel, type LeadFieldConfig } from '../../config/fieldControlRegistry';
import { applyMaskingRule, hasRevealableValue } from '../../utils/fieldMasking';

// Deterministic avatar helpers
const AVATAR_COLORS = [
  '#0284c7', '#7c3aed', '#dc2626', '#059669',
  '#d97706', '#0891b2', '#be185d', '#4f46e5',
  '#0d9488', '#9333ea', '#c2410c', '#2563eb',
];

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'New': { bg: '#eff6ff', color: '#2563eb' },
  'Contacted': { bg: '#e0e7ff', color: '#4338ca' },
  'In Progress': { bg: '#fef3c7', color: '#b45309' },
  'Qualified': { bg: '#d1fae5', color: '#047857' },
  'Converted': { bg: '#dcfce7', color: '#15803d' },
  'Closed': { bg: '#f1f5f9', color: '#64748b' },
};

const formatVal = (val?: string | null): string => {
  if (!val || !val.trim() || val.trim().toLowerCase() === 'null' || val.trim().toLowerCase() === 'undefined') {
    return '—';
  }
  return val.trim();
};

const formatConsent = (val?: string | null): string => {
  if (!val || !val.trim()) return '—';
  const v = val.trim().toUpperCase();
  if (v === 'CONSENT') return 'Consented to marketing & promotional activities';
  if (v === 'DO_NOT_CONSENT') return 'Did not consent to marketing & promotional activities';
  return val;
};

const getInitials = (name: string): string => {
  const parts = (name || '').split(' ').filter((p) => !['bin', 'binti', 'a/l', 'a/p'].includes(p.toLowerCase()));
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || '??';
};

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const LeadDetailsDrawer: React.FC = () => {
  const { selectedLead, isDetailsDrawerOpen, closeDetailsDrawer, fieldConfig } = useLeadStore();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  function toggleReveal(apiField: string) {
    setRevealed((prev) => ({ ...prev, [apiField]: !prev[apiField] }));
  }

  /** Field-config-aware row: hidden entirely when Visible=false, masked-with-reveal when Sensitive. */
  function Row({ apiField, label, raw, valueStyle }: { apiField: string; label: string; raw?: string | null; valueStyle?: React.CSSProperties }) {
    if (!isFieldVisible(fieldConfig, apiField)) return null;
    const entry = fieldConfig.find((f) => f.apiField === apiField) as LeadFieldConfig | undefined;
    const formatted = formatVal(raw);
    const canReveal = !!entry?.sensitive && hasRevealableValue(raw) && formatted !== '—';
    const displayValue = canReveal && !revealed[apiField]
      ? applyMaskingRule(formatted, entry!.maskingRule, entry!.visibleCharCount)
      : formatted;

    return (
      <div className="lead-details-row">
        <div className="lead-details-label">{getFieldLabel(fieldConfig, apiField, label)}</div>
        <div className="lead-details-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...valueStyle }}>
          <span>{displayValue}</span>
          {canReveal && (
            <button
              type="button"
              onClick={() => toggleReveal(apiField)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}
              aria-label={revealed[apiField] ? 'Hide value' : 'Reveal value'}
            >
              {revealed[apiField] ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDetailsDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDetailsDrawerOpen]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      closeDetailsDrawer();
    }
  };

  if (!isDetailsDrawerOpen || !selectedLead) return null;

  const initials = getInitials(selectedLead.name);
  const avatarColor = getAvatarColor(selectedLead.name);
  const statusStyle = STATUS_STYLES[selectedLead.status] || STATUS_STYLES['New'];

  // Config-driven, not a hardcoded product-name check — a lead's product only ever has
  // propertyType/dateOfIncorporation rows in its config when that product's catalog actually has
  // them (see LeadFieldConfigService.BuildDefaultsFor). Falls back to "does the lead itself carry a
  // value" so a lead viewed before its config finished loading doesn't briefly hide real data.
  const isHomeFinancing = fieldConfig.some((f) => f.apiField === 'propertyType') || !!selectedLead.propertyType || !!selectedLead.propertyStatus;
  const isMicrofinance = fieldConfig.some((f) => f.apiField === 'dateOfIncorporation') || !!selectedLead.companyName || !!selectedLead.entityType || !!selectedLead.dateOfIncorporation;

  return (
    <div className="drawer-overlay" onClick={handleOverlayClick}>
      <div className="lead-details-drawer" ref={drawerRef}>
        {/* Blue Drawer Header — Case Management style */}
        <div className="drawer-header-blue">
          <div className="drawer-header-content">
            <h2 className="drawer-title">Lead Details</h2>
            <p className="drawer-subtitle">Viewing complete lead information</p>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={closeDetailsDrawer}
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="drawer-body">
          {/* Lead Identity Card Header */}
          <div className="lead-details-header-info">
            <div
              className="lead-details-avatar"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <div>
              <div className="lead-details-name">{selectedLead.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <span
                  className="lead-status-badge"
                  style={{
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.color,
                    display: 'inline-flex',
                  }}
                >
                  {selectedLead.status}
                </span>
                {selectedLead.createdDate && (
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Created At: <strong style={{ color: '#334155' }}>{selectedLead.createdDate}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 1: Contact Information Card */}
          <div className="lead-details-card">
            <div className="lead-details-card-header">
              <User size={14} />
              <span>Contact Information</span>
            </div>
            <div className="lead-details-card-body">
              <Row apiField="customerName" label="Full Name" raw={selectedLead.name} />
              <Row apiField="icNumber" label="IC Number" raw={selectedLead.icNumber} valueStyle={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }} />
              <Row apiField="phoneNumber" label="Phone" raw={selectedLead.phone} />
              <Row apiField="email" label="Email" raw={selectedLead.email} />
            </div>
          </div>

          {/* Card 2: Employment & Financing Application Card */}
          <div className="lead-details-card">
            <div className="lead-details-card-header">
              <Briefcase size={14} />
              <span>Employment & Financing Application</span>
            </div>
            <div className="lead-details-card-body">
              <Row apiField="employerName" label="Employer Name" raw={selectedLead.employerName} />
              {isFieldVisible(fieldConfig, 'appliedAmount') && (
                <div className="lead-details-row">
                  <div className="lead-details-label">{getFieldLabel(fieldConfig, 'appliedAmount', 'Applied Amount')}</div>
                  <div className="lead-details-value" style={{ fontWeight: 600, color: '#2563eb' }}>
                    {selectedLead.appliedAmount ? `RM ${selectedLead.appliedAmount}` : '—'}
                  </div>
                </div>
              )}
              <Row apiField="state" label="State" raw={selectedLead.state} />
              <Row apiField="branch" label="Servicing Branch" raw={selectedLead.branch} />
            </div>
          </div>

          {/* Card 3: Sales Executive Assignment Card */}
          <div className="lead-details-card">
            <div className="lead-details-card-header">
              <UserCheck size={14} />
              <span>Sales Executive Assignment</span>
            </div>
            <div className="lead-details-card-body">
              <Row apiField="preferredSalesExecutive" label="Preferred Sales Executive" raw={selectedLead.preferredSalesExecutive} />
            </div>
          </div>

          {/* Card 4: Product & Specific Details Card */}
          <div className="lead-details-card">
            <div className="lead-details-card-header">
              <Package size={14} />
              <span>Product Details</span>
            </div>
            <div className="lead-details-card-body">
              <div className="lead-details-row">
                <div className="lead-details-label">Product Name</div>
                <div className="lead-details-value" style={{ fontWeight: 600 }}>{formatVal(selectedLead.product)}</div>
              </div>

              {isHomeFinancing && (
                <>
                  <Row apiField="propertyType" label="Property Type" raw={selectedLead.propertyType} />
                  <Row apiField="propertyStatus" label="Property Status" raw={selectedLead.propertyStatus} />
                </>
              )}

              {isMicrofinance && (
                <>
                  <Row apiField="companyName" label="Company Name" raw={selectedLead.companyName} />
                  <Row apiField="entityType" label="Entity Type" raw={selectedLead.entityType} />
                  <Row apiField="dateOfIncorporation" label="Date of Incorporation" raw={selectedLead.dateOfIncorporation} />
                </>
              )}
            </div>
          </div>

          {/* Card 5: Declaration & Consent Details Card */}
          <div className="lead-details-card">
            <div className="lead-details-card-header">
              <FileText size={14} />
              <span>Declaration & Consent</span>
            </div>
            <div className="lead-details-card-body">
              {isFieldVisible(fieldConfig, 'marketingConsent') && (
                <div className="lead-details-row">
                  <div className="lead-details-label">{getFieldLabel(fieldConfig, 'marketingConsent', 'Marketing Consent')}</div>
                  <div className="lead-details-value">{formatConsent(selectedLead.marketingConsent)}</div>
                </div>
              )}
              {isFieldVisible(fieldConfig, 'agreedToPrivacyPolicy') && (
                <div className="lead-details-row">
                  <div className="lead-details-label">{getFieldLabel(fieldConfig, 'agreedToPrivacyPolicy', 'Privacy Policy Agreement')}</div>
                  <div className="lead-details-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600 }}>
                    <CheckCircle2 size={14} />
                    <span>Agreed & Accepted</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
