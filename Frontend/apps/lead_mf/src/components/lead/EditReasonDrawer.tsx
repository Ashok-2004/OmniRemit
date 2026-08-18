import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';

const PREDEFINED_REASONS = [
  'Incorrect customer information',
  'Incorrect contact information',
  'Incorrect financial information',
  'Incorrect amount entered',
  'Customer information changed',
  'Correction requested by customer',
  'Data entry mistake',
  'Other',
];

export const EditReasonDrawer: React.FC = () => {
  const { isEditReasonOpen, closeEditReasonDrawer, proceedToEditLead, editLeadTarget } = useLeadStore();

  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isEditReasonOpen || !editLeadTarget) return null;

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'Other' ? customReason.trim() : (selectedReason.trim() || customReason.trim());

    if (!finalReason) {
      setError('Please select or provide a reason for editing this lead.');
      return;
    }

    setError('');
    proceedToEditLead(finalReason);
  };

  return (
    <div className="drawer-overlay" onClick={closeEditReasonDrawer}>
      <div
        className="create-lead-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header-blue">
          <div className="drawer-header-content">
            <h2 className="drawer-title" style={{ fontSize: '18px' }}>
              Edit Lead Information
            </h2>
            <p className="drawer-subtitle">
              Audit requirement for lead modifications — {editLeadTarget.name} ({editLeadTarget.icNumber})
            </p>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={closeEditReasonDrawer}
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleProceed} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 130px)' }}>
          <div className="drawer-body" style={{ flex: 1, padding: '24px' }}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontWeight: 600, color: '#1e293b' }}>
                Select Edit Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value);
                  setError('');
                }}
                className="form-input"
                style={{
                  appearance: 'auto',
                  cursor: 'pointer',
                  borderColor: error ? '#f43f5e' : undefined,
                  background: error ? '#fff5f6' : undefined,
                }}
              >
                <option value="">-- Choose a reason --</option>
                {PREDEFINED_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {(selectedReason === 'Other' || selectedReason === '') && (
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 600, color: '#1e293b' }}>
                  {selectedReason === 'Other' ? 'Enter Custom Edit Reason *' : 'Or Type Custom Edit Reason'}
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the reason for updating this customer's details..."
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value);
                    setError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: `1.5px solid ${error ? '#f43f5e' : '#e2e8f0'}`,
                    fontSize: '14px',
                    resize: 'vertical',
                    background: '#f8fafc',
                    fontFamily: 'inherit',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 160ms ease, box-shadow 160ms ease',
                    minHeight: '80px',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.09)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = error ? '#f43f5e' : '#e2e8f0';
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            )}

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#dc2626',
                  fontSize: '13px',
                  marginTop: '8px',
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="drawer-footer">
            <button type="button" className="drawer-btn-cancel" onClick={closeEditReasonDrawer}>
              Cancel
            </button>
            <button type="submit" className="drawer-btn-create">
              Continue / Proceed
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
