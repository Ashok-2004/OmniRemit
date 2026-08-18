import React from 'react';
import { X, ShieldCheck, Clock, User } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';

export const AuditDetailsDrawer: React.FC = () => {
  const { isAuditDetailsOpen, selectedAuditLog, closeAuditDetails } = useLeadStore();

  if (!isAuditDetailsOpen || !selectedAuditLog) return null;

  // Parse diffs or previous/new JSON values if present
  let diffs: any[] = [];
  try {
    if (selectedAuditLog.previousValues && selectedAuditLog.previousValues.startsWith('[')) {
      diffs = JSON.parse(selectedAuditLog.previousValues);
    }
  } catch (err) {
    diffs = [];
  }

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'edit':
        return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'delete':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
  };

  const badgeStyle = getActionBadgeColor(selectedAuditLog.actionType);

  return (
    <div className="drawer-overlay" style={{ zIndex: 1200 }} onClick={closeAuditDetails}>
      <div
        className="create-lead-drawer"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header-blue">
          <div className="drawer-header-content">
            <h2 className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} style={{ color: '#ffffff' }} />
              <span>Audit Log Record Details</span>
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={closeAuditDetails}
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="drawer-body" style={{ padding: '24px', overflowY: 'auto' }}>
          {/* Metadata Card */}
          <div style={{ background: '#f8fafc', border: '1px solid #eaecf0', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span
                style={{
                  background: badgeStyle.bg,
                  color: badgeStyle.text,
                  border: `1px solid ${badgeStyle.border}`,
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                }}
              >
                {selectedAuditLog.actionType} ACTION
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                <Clock size={15} />
                <span>{selectedAuditLog.timestamp}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13.5px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>PERFORMED BY</span>
                <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} style={{ color: '#2563eb' }} />
                  <span>{selectedAuditLog.userName} ({selectedAuditLog.userId})</span>
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>USER ROLE</span>
                <strong style={{ color: '#0f172a' }}>{selectedAuditLog.userRole}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>IP ADDRESS</span>
                <span style={{ fontFamily: 'monospace', color: '#475569' }}>{selectedAuditLog.ipAddress}</span>
              </div>
            </div>
          </div>

          {/* Action Description & Reason */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569', display: 'block', marginBottom: '6px' }}>
              DESCRIPTION
            </label>
            <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', color: '#1e293b' }}>
              {selectedAuditLog.description}
            </div>
          </div>

          {selectedAuditLog.reason && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569', display: 'block', marginBottom: '6px' }}>
                AUDIT REASON / JUSTIFICATION
              </label>
              <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef08a', borderRadius: '6px', fontSize: '14px', color: '#92400e', fontWeight: 500 }}>
                "{selectedAuditLog.reason}"
              </div>
            </div>
          )}

          {/* Diffs Table for Edit Actions */}
          {diffs.length > 0 && (
            <div>
              <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569', display: 'block', marginBottom: '8px' }}>
                FIELD-LEVEL MODIFICATION DIFFS
              </label>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#334155' }}>FIELD</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#dc2626' }}>PREVIOUS</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#16a34a' }}>NEW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((d: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: idx === diffs.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{d.field}</td>
                        <td style={{ padding: '10px 14px', color: '#dc2626', background: '#fef2f2', fontFamily: 'monospace' }}>
                          {d.previousValue}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#15803d', background: '#f0fdf4', fontFamily: 'monospace', fontWeight: 600 }}>
                          {d.newValue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="drawer-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeAuditDetails}
            style={{ padding: '9px 20px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 500, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
