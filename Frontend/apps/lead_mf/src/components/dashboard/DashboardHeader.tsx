import React from 'react';
import { Layers, UserPlus, Sparkles } from 'lucide-react';
import { TimeRangeFilterDropdown } from './TimeRangeFilterDropdown';
import { useLeadStore } from '../../store/useLeadStore';
import { canCreateLead } from '../../api/hostBridge';

// Exact clone of the host's own hero-banner breakpoint, so this collapses the same way the
// dashboard it's embedded in does (see Frontend/apps/host/src/pages/DashboardPage/DashboardPage.module.css
// .heroCard media query at 768px) rather than just overflowing on narrow screens.
const RESPONSIVE_CSS = `
@media (max-width: 768px) {
  .lead-hero-banner {
    flex-direction: column !important;
    align-items: flex-start !important;
    padding: 22px 22px !important;
    gap: 14px !important;
  }
}
`;

export const DashboardHeader: React.FC = () => {
  const { setActivePage } = useLeadStore();
  const userCanCreate = canCreateLead();

  return (
    <div style={{ marginBottom: '0' }}>
      <style>{RESPONSIVE_CSS}</style>
      {/* Lead Management Hero Banner — same gradient, shadow, and decorative-circle spec as the
          host's own DashboardPage.module.css .heroCard, so this remote's banner isn't a slightly
          different one-off. */}
      <div
        className="lead-hero-banner"
        style={{
          borderRadius: '18px',
          padding: '28px 34px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(120deg, #1e40af 0%, #2563eb 45%, #3b82f6 100%)',
          boxShadow: '0 4px 20px rgba(37, 99, 235, 0.25), 0 1px 4px rgba(37, 99, 235, 0.15)',
          boxSizing: 'border-box',
        }}
      >
        {/* Background decorative glass circles — matching host's exact sizes/offsets/opacity */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.07)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-60px',
            right: '120px',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            pointerEvents: 'none',
          }}
        />

        {/* Left Side: Avatar Icon & Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            minWidth: 0,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.18)',
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Layers size={24} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                Lead Management Overview
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Sparkles size={11} /> Live
              </span>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.88)',
                margin: '4px 0 0 0',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              Real-time operational metrics, financing pipelines & regional distributions
            </p>
          </div>
        </div>

        {/* Right Side: Quick Action + Time Filter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            position: 'relative',
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          {userCanCreate && (
            <button
              type="button"
              onClick={() => setActivePage('create-lead')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 16px',
                borderRadius: '10px',
                border: 'none',
                background: '#ffffff',
                color: '#1d4ed8',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
              }}
            >
              <UserPlus size={15} />
              <span>Create New Lead</span>
            </button>
          )}

          <TimeRangeFilterDropdown />
        </div>
      </div>
    </div>
  );
};
