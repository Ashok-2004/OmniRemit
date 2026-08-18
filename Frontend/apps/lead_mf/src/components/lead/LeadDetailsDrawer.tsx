import React, { useEffect, useRef } from 'react';
import { X, User, Package, Briefcase, UserCheck, FileText, CheckCircle2 } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';

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
  const { selectedLead, isDetailsDrawerOpen, closeDetailsDrawer } = useLeadStore();
  const drawerRef = useRef<HTMLDivElement>(null);

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

  const isHomeFinancing = selectedLead.product === 'Home Financing' || !!selectedLead.propertyType || !!selectedLead.propertyStatus;
  const isMicrofinance = selectedLead.product === 'Micro Finance' || !!selectedLead.companyName || !!selectedLead.entityType || !!selectedLead.dateOfIncorporation;

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
              <div className="lead-details-row">
                <div className="lead-details-label">Full Name</div>
                <div className="lead-details-value">{formatVal(selectedLead.name)}</div>
              </div>
              <div className="lead-details-row">
                <div className="lead-details-label">IC Number</div>
                <div className="lead-details-value" style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                  {formatVal(selectedLead.icNumber)}
                </div>
              </div>
              <div className="lead-details-row">
                <div className="lead-details-label">Phone</div>
                <div className="lead-details-value">{formatVal(selectedLead.phone)}</div>
              </div>
              <div className="lead-details-row">
                <div className="lead-details-label">Email</div>
                <div className="lead-details-value">{formatVal(selectedLead.email)}</div>
              </div>
            </div>
          </div>

          {/* Card 2: Employment & Financing Application Card */}
          <div className="lead-details-card">
            <div className="lead-details-card-header">
              <Briefcase size={14} />
              <span>Employment & Financing Application</span>
            </div>
            <div className="lead-details-card-body">
              <div className="lead-details-row">
                <div className="lead-details-label">Employer Name</div>
                <div className="lead-details-value">{formatVal(selectedLead.employerName)}</div>
              </div>
              <div className="lead-details-row">
                <div className="lead-details-label">Applied Amount</div>
                <div className="lead-details-value" style={{ fontWeight: 600, color: '#2563eb' }}>
                  {selectedLead.appliedAmount ? `RM ${selectedLead.appliedAmount}` : '—'}
                </div>
              </div>
              <div className="lead-details-row">
                <div className="lead-details-label">State</div>
                <div className="lead-details-value">{formatVal(selectedLead.state)}</div>
              </div>
              <div className="lead-details-row">
                <div className="lead-details-label">Servicing Branch</div>
                <div className="lead-details-value">{formatVal(selectedLead.branch)}</div>
              </div>
            </div>
          </div>

          {/* Card 3: Sales Executive Assignment Card */}
          <div className="lead-details-card">
            <div className="lead-details-card-header">
              <UserCheck size={14} />
              <span>Sales Executive Assignment</span>
            </div>
            <div className="lead-details-card-body">
              <div className="lead-details-row">
                <div className="lead-details-label">Preferred Sales Executive</div>
                <div className="lead-details-value">{formatVal(selectedLead.preferredSalesExecutive)}</div>
              </div>
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
                  <div className="lead-details-row">
                    <div className="lead-details-label">Property Type</div>
                    <div className="lead-details-value">{formatVal(selectedLead.propertyType)}</div>
                  </div>
                  <div className="lead-details-row">
                    <div className="lead-details-label">Property Status</div>
                    <div className="lead-details-value">{formatVal(selectedLead.propertyStatus)}</div>
                  </div>
                </>
              )}

              {isMicrofinance && (
                <>
                  <div className="lead-details-row">
                    <div className="lead-details-label">Company Name</div>
                    <div className="lead-details-value">{formatVal(selectedLead.companyName)}</div>
                  </div>
                  <div className="lead-details-row">
                    <div className="lead-details-label">Entity Type</div>
                    <div className="lead-details-value">{formatVal(selectedLead.entityType)}</div>
                  </div>
                  <div className="lead-details-row">
                    <div className="lead-details-label">Date of Incorporation</div>
                    <div className="lead-details-value">{formatVal(selectedLead.dateOfIncorporation)}</div>
                  </div>
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
              <div className="lead-details-row">
                <div className="lead-details-label">Marketing Consent</div>
                <div className="lead-details-value">{formatConsent(selectedLead.marketingConsent)}</div>
              </div>
              <div className="lead-details-row">
                <div className="lead-details-label">Privacy Policy Agreement</div>
                <div className="lead-details-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600 }}>
                  <CheckCircle2 size={14} />
                  <span>Agreed & Accepted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
