import React, { useState } from 'react';
import { X, Trash2, ArrowLeft } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';

export const DeleteLeadDrawer: React.FC = () => {
  const {
    isDeleteReasonOpen,
    isDeleteConfirmOpen,
    deleteLeadTarget,
    deleteReason,
    closeDeleteWorkflow,
    proceedToDeleteConfirm,
    backToDeleteReason,
    confirmDeleteLead,
    isSubmitting,
  } = useLeadStore();

  const [inputReason, setInputReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  if ((!isDeleteReasonOpen && !isDeleteConfirmOpen) || !deleteLeadTarget) return null;

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputReason.trim()) {
      setError('Delete reason is mandatory. Please enter a justification for deleting this lead.');
      return;
    }
    setError('');
    proceedToDeleteConfirm(inputReason.trim());
  };

  const handleFinalDelete = async () => {
    await confirmDeleteLead();
  };

  return (
    <div className="drawer-overlay" style={{ zIndex: 1100 }} onClick={closeDeleteWorkflow}>
      <div
        className="create-lead-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header-blue" style={{ background: '#7f1d1d' }}>
          <div className="drawer-header-content">
            <h2 className="drawer-title" style={{ fontSize: '18px', color: '#fff' }}>
              {isDeleteConfirmOpen ? 'Confirm Lead Deletion' : 'Why do you want to delete this lead?'}
            </h2>
            <p className="drawer-subtitle" style={{ color: '#fca5a5' }}>
              Lead Reference — {deleteLeadTarget.name} ({deleteLeadTarget.icNumber})
            </p>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={closeDeleteWorkflow}
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {!isDeleteConfirmOpen ? (
          /* STEP 1: MANDATORY TYPED CUSTOM REASON */
          <form onSubmit={handleProceed} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 130px)' }}>
            <div className="drawer-body" style={{ flex: 1, padding: '24px' }}>


              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 600, color: '#1e293b' }}>
                  Enter reason for deleting this lead <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter reason for deleting this lead..."
                  value={inputReason}
                  onChange={(e) => {
                    setInputReason(e.target.value);
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
                    minHeight: '100px',
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
                {error && (
                  <div style={{ color: '#f43f5e', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="drawer-footer">
              <button type="button" className="drawer-btn-cancel" onClick={closeDeleteWorkflow}>
                Cancel
              </button>
              <button type="submit" className="drawer-btn-danger">
                Continue
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: CONFIRMATION STEP WITH LEAD IDENTITY DETAILS */
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 130px)' }}>
            <div className="drawer-body" style={{ flex: 1, padding: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#fef2f2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <Trash2 size={28} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                  Are you sure you want to delete this lead?
                </h3>
                <p style={{ fontSize: '13.5px', color: '#64748b' }}>
                  Please confirm that you intend to delete the following lead record:
                </p>
              </div>

              {/* Lead Identity Summary Card */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13.5px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>CUSTOMER NAME</span>
                    <strong style={{ color: '#0f172a' }}>{deleteLeadTarget.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>IC NUMBER</span>
                    <strong style={{ color: '#0f172a' }}>{deleteLeadTarget.icNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>PRODUCT</span>
                    <strong style={{ color: '#0f172a' }}>{deleteLeadTarget.product}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>PHONE</span>
                    <strong style={{ color: '#0f172a' }}>{deleteLeadTarget.phone}</strong>
                  </div>
                </div>

                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>DELETE REASON</span>
                  <p style={{ margin: '4px 0 0 0', color: '#7f1d1d', fontWeight: 500, fontSize: '13px' }}>
                    "{deleteReason}"
                  </p>
                </div>
              </div>
            </div>

            <div className="drawer-footer" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="drawer-btn-cancel" onClick={backToDeleteReason}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="drawer-btn-cancel" onClick={closeDeleteWorkflow}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="drawer-btn-danger"
                  disabled={isSubmitting}
                  onClick={handleFinalDelete}
                  style={isSubmitting ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                  <Trash2 size={16} />
                  <span>{isSubmitting ? 'Deleting...' : 'Delete Lead'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
