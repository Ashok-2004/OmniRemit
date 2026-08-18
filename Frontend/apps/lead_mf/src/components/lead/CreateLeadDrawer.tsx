import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { LeadFormContainer } from './LeadFormContainer';
import { useLeadStore } from '../../store/useLeadStore';

export const CreateLeadDrawer: React.FC = () => {
  const { isDrawerOpen, closeDrawer, resetForm, isSubmitting } = useLeadStore();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  const handleClose = () => {
    resetForm();
    closeDrawer();
  };

  const handleFormSuccess = () => {
    resetForm();
    closeDrawer();
  };

  const handleFooterSubmit = () => {
    const form = drawerRef.current?.querySelector('form');
    if (form) {
      form.requestSubmit();
    }
  };

  if (!isDrawerOpen) return null;

  return (
    <div className="drawer-overlay" onClick={handleOverlayClick}>
      <div className="create-lead-drawer" ref={drawerRef}>
        <div className="drawer-header-blue">
          <div className="drawer-header-content">
            <h2 className="drawer-title">Create New Lead</h2>
            <p className="drawer-subtitle">Start your financial journey with OmniConnect</p>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={handleClose}
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="drawer-body">
          <LeadFormContainer mode="drawer" onSuccess={handleFormSuccess} />
        </div>

        <div className="drawer-footer">
          <button
            type="button"
            className="drawer-btn-cancel"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="drawer-btn-create"
            onClick={handleFooterSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting Your Response...' : 'Create Lead'}
          </button>
        </div>
      </div>
    </div>
  );
};
