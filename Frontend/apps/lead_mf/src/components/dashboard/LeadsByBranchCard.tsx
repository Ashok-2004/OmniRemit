import React from 'react';
import { useLeadStore } from '../../store/useLeadStore';

const BRANCH_COLORS = [
  '#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#0d9488',
];

export const LeadsByBranchCard: React.FC = () => {
  const { leadsByBranch, isLoadingDashboard } = useLeadStore();

  const sortedBranches = [...leadsByBranch].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sortedBranches.map((b) => b.count), 1);

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
            Leads by Branch
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0', fontWeight: 400 }}>
            Regional distribution of applications
          </p>
        </div>
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
            Loading branch data...
          </div>
        ) : sortedBranches.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
            No branch data available.
          </div>
        ) : (
          sortedBranches.map((branch, idx) => {
            const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
            const barPct = Math.round((branch.count / maxCount) * 100);

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
                {/* appRowIcon */}
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '9px',
                    background: `${color}18`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  {(branch.branchName || 'B').slice(0, 2).toUpperCase()}
                </div>

                {/* appRowContent */}
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
                      {branch.branchName}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 500 }}>
                      {barPct}%
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
                        background: color,
                        borderRadius: '999px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Status pill */}
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
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  {branch.count}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
