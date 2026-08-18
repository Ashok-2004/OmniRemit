import React from 'react';
import { useCustomerStore } from '../store/customerStore';
import { User, Building2, Phone, Mail, Edit3, Layers, Sparkles } from 'lucide-react';
import type { IndividualProfile, CorporateProfile } from '../types/api';

interface CustomerHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSubTab?: string;
  setActiveSubTab?: (subTab: string) => void;
}

export default function CustomerHeader({ activeTab, setActiveTab, setActiveSubTab }: CustomerHeaderProps) {
  const { customerType, profile } = useCustomerStore();

  if (!profile) return null;

  const isIndividual = customerType === 'individual';
  const individualProfile = profile as IndividualProfile;
  const corporateProfile = profile as CorporateProfile;

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #eaecf0',
        padding: '24px 28px',
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Upper Row: Profile Avatar, Name, Badges, Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '280px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1.5px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              flexShrink: 0,
            }}
          >
            {isIndividual ? <User size={28} /> : <Building2 size={28} />}
          </div>

          <div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 750,
                color: '#0f172a',
                margin: '0 0 4px 0',
                letterSpacing: '-0.02em',
              }}
            >
              {isIndividual ? individualProfile.fullName : corporateProfile.organizationName}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 8px 0' }}>
              {isIndividual
                ? `Designation: ${individualProfile.designation || '-'}`
                : `${corporateProfile.organizationType || '-'} • ${corporateProfile.country || '-'}`}
            </p>

            {/* Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {isIndividual ? (
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '999px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    fontSize: '11.5px',
                    fontWeight: 700,
                  }}
                >
                  Status: {individualProfile.flags || 'Active'}
                </span>
              ) : (
                <>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: '999px',
                      background: '#ede9fe',
                      color: '#6d28d9',
                      border: '1px solid #ddd6fe',
                      fontSize: '11.5px',
                      fontWeight: 700,
                    }}
                  >
                    {corporateProfile.organizationType || 'Corporate'}
                  </span>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: '999px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    {corporateProfile.country || 'Malaysia'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #eaecf0' }}>
          {isIndividual ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('details');
                  if (setActiveSubTab) setActiveSubTab('personal');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === 'details' ? '#ffffff' : 'transparent',
                  color: activeTab === 'details' ? '#2563eb' : '#64748b',
                  fontSize: '13px',
                  fontWeight: activeTab === 'details' ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'details' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                <User size={14} />
                <span>Customer Details</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('workspace');
                  if (setActiveSubTab) setActiveSubTab('interactions');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === 'workspace' ? '#ffffff' : 'transparent',
                  color: activeTab === 'workspace' ? '#2563eb' : '#64748b',
                  fontSize: '13px',
                  fontWeight: activeTab === 'workspace' ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'workspace' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                <Building2 size={14} />
                <span>Customer Workspace</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === 'overview' ? '#ffffff' : 'transparent',
                  color: activeTab === 'overview' ? '#2563eb' : '#64748b',
                  fontSize: '13px',
                  fontWeight: activeTab === 'overview' ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'overview' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                <Building2 size={14} />
                <span>Company Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === 'products' ? '#ffffff' : 'transparent',
                  color: activeTab === 'products' ? '#2563eb' : '#64748b',
                  fontSize: '13px',
                  fontWeight: activeTab === 'products' ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'products' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                <Layers size={14} />
                <span>Product Holdings</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '100%', height: '1px', backgroundColor: '#eaecf0' }} />

      {/* Lower Row: Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="c360-btn-secondary"
          style={{ height: '36px', padding: '0 14px', fontSize: '12.5px' }}
        >
          <Edit3 size={13} />
          <span>Edit Profile</span>
        </button>

        {isIndividual && (
          <>
            <button
              type="button"
              className="c360-btn-primary"
              style={{ height: '36px', padding: '0 16px', fontSize: '12.5px' }}
            >
              <Phone size={13} />
              <span>Call Customer</span>
            </button>
            <button
              type="button"
              className="c360-btn-primary"
              style={{ height: '36px', padding: '0 16px', fontSize: '12.5px' }}
            >
              <Mail size={13} />
              <span>Send Message</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
