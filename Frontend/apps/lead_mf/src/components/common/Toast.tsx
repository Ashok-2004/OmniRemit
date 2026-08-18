import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useLeadStore();

  if (!toast || !toast.show) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={20} style={{ color: '#16a34a' }} />;
      case 'error':
        return <AlertCircle size={20} style={{ color: '#dc2626' }} />;
      case 'warning':
        return <AlertTriangle size={20} style={{ color: '#d97706' }} />;
      default:
        return <Info size={20} style={{ color: '#2563eb' }} />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return '#16a34a';
      case 'error':
        return '#dc2626';
      case 'warning':
        return '#d97706';
      default:
        return '#2563eb';
    }
  };

  return (
    <div
      className="toast-notification"
      style={{ borderLeftColor: getBorderColor() }}
      role="alert"
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', marginBottom: '2px' }}>
          {toast.title}
        </div>
        <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
          {toast.message}
        </div>
        {toast.payload && (
          <pre
            style={{
              marginTop: '8px',
              padding: '8px 10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#334155',
              maxHeight: '140px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {JSON.stringify(toast.payload, null, 2)}
          </pre>
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
          display: 'flex',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
