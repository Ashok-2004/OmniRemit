import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';

const AVATAR_COLORS = ['#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#0d9488'];

const getInitials = (name: string): string => {
  if (!name) return '??';
  const parts = name.split(' ').filter((p) => !['bin', 'binti', 'a/l', 'a/p'].includes(p.toLowerCase()));
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || '??';
};

export const TopSalesExecutivesCard: React.FC = () => {
  const { topSalesExecutives, isLoadingDashboard, setActivePage } = useLeadStore();

  const maxConverted = Math.max(...topSalesExecutives.map((se) => se.convertedLeads), 1);

  return (
    /* widgetCard */
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #eaecf0',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* widgetHeader */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h2
            style={{
              fontSize: '14.5px',
              fontWeight: 700,
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            Top Sales Executives
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0', fontWeight: 400 }}>
            Performance leaderboard by conversion
          </p>
        </div>

        {/* viewAllLink */}
        <button
          type="button"
          onClick={() => setActivePage('view-lead')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#2563eb',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '5px 0',
            transition: 'color 130ms ease',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#1d4ed8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#2563eb'; }}
        >
          <span>View Leads</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* appsList container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: '200px',
          maxHeight: '240px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#e2e8f0 transparent',
        }}
      >
        {isLoadingDashboard ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Loading performance metrics...
          </div>
        ) : topSalesExecutives.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
            No sales executive data available.
          </div>
        ) : (
          topSalesExecutives.map((exec, idx) => {
            const avatarBg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const initials = getInitials(exec.name);
            const barPct = Math.round((exec.convertedLeads / maxConverted) * 100);

            return (
              /* appRow */
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  border: '1px solid #eaecf0',
                  borderRadius: '11px',
                  background: '#f8fafc',
                  transition: 'background 130ms ease, border-color 130ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#d4dbe8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#eaecf0';
                }}
              >
                {/* Rank badge */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#94a3b8',
                    width: '16px',
                    flexShrink: 0,
                    textAlign: 'center',
                  }}
                >
                  {exec.rank}
                </span>

                {/* Avatar */}
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: avatarBg,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                    border: '1.5px solid rgba(255,255,255,0.3)',
                  }}
                >
                  {initials}
                </div>

                {/* Name + progress bar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#0f172a',
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {exec.name}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 500 }}>
                      {exec.conversionRate.toFixed(1)}%
                    </span>
                  </div>
                  {/* progressBarTrack */}
                  <div
                    style={{
                      width: '100%',
                      height: '4px',
                      background: '#f1f5f9',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${barPct}%`,
                        background: avatarBg,
                        borderRadius: '999px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Converted count pill */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: '#ecfdf5',
                    color: '#059669',
                    borderRadius: '999px',
                    padding: '3px 9px',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  {exec.convertedLeads}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
