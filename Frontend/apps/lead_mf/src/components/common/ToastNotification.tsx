import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';

export const ToastNotification: React.FC = () => {
  const { toast, hideToast } = useLeadStore();

  useEffect(() => {
    if (toast?.show) {
      const timer = setTimeout(() => {
        hideToast();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  if (!toast || !toast.show) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />;
      case 'warning':
        return <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />;
      case 'error':
        return <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />;
      default:
        return <Info size={20} style={{ color: '#2563eb', flexShrink: 0 }} />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return '#bbf7d0';
      case 'warning':
        return '#fef08a';
      case 'error':
        return '#fecaca';
      default:
        return '#bfdbfe';
    }
  };

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return '#f0fdf4';
      case 'warning':
        return '#fffbeb';
      case 'error':
        return '#fef2f2';
      default:
        return '#eff6ff';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        minWidth: '320px',
        maxWidth: '460px',
        background: getBgColor(),
        border: `1px solid ${getBorderColor()}`,
        borderRadius: '8px',
        padding: '14px 18px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
        animation: 'slideInRight 0.25s ease-out',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      {getIcon()}

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', marginBottom: '2px' }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>
            {toast.message}
          </div>
        )}
        {toast.errorsList && toast.errorsList.length > 0 && (
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px', fontSize: '12.5px', color: '#dc2626' }}>
            {toast.errorsList.map((err, idx) => (
              <li key={idx} style={{ marginBottom: '2px' }}>
                {err}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={hideToast}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '2px',
          borderRadius: '4px',
          marginLeft: '8px',
        }}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
};
