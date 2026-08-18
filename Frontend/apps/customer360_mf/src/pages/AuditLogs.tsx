import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, Download, Eye, X, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../services/api';
import type { AuditLog } from '../types/api';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

const getActionBadge = (action?: string) => {
  const a = (action || '').toLowerCase();
  if (a.includes('create') || a.includes('add') || a.includes('insert')) {
    return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', dot: '#10b981' };
  }
  if (a.includes('edit') || a.includes('update') || a.includes('modify')) {
    return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#2563eb' };
  }
  if (a.includes('delete') || a.includes('remove') || a.includes('purge')) {
    return { bg: '#fff1f2', text: '#be123c', border: '#fecdd3', dot: '#f43f5e' };
  }
  return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#64748b' };
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Selected Log for Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAuditLogs({
        search: searchQuery,
        action: actionFilter,
        pageNumber,
        pageSize,
      });
      setLogs(res.data || []);
      setTotalCount(res.totalCount || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(getFriendlyErrorMessage(apiErr));
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageNumber(1);
  }, [searchQuery, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [pageNumber, pageSize, actionFilter, searchQuery]);

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs({
        search: searchQuery,
        action: actionFilter,
        pageNumber: 1,
        pageSize: 1000,
      });
      const allLogs = res.data || [];

      const headers = ['Timestamp', 'User', 'Action', 'Description', 'Status', 'Customer Name', 'Customer Type', 'Customer ID', 'Field'];
      const rows = allLogs.map((l) => [
        l.timestamp,
        l.user,
        l.action,
        l.description,
        l.status,
        l.customerName || '',
        l.customerType || '',
        l.customerId || '',
        l.field || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Customer360_AuditLogs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero Banner — Host Pattern */}
      <div className="c360-hero-banner">
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-50px', right: '120px', width: '130px', height: '130px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.18)',
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="c360-hero-title">Customer 360° Audit Trail</h1>
              <span className="c360-hero-pill">
                {totalCount || logs.length} Events Logged
              </span>
            </div>
            <p className="c360-hero-subtitle">
              Immutable compliance and security logs of all customer profile lookups, views, and data access events
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={logs.length === 0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            height: '40px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            background: 'rgba(255, 255, 255, 0.95)',
            color: '#1d4ed8',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
            opacity: logs.length === 0 ? 0.6 : 1,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
            transition: 'all 0.15s ease',
            fontFamily: 'inherit',
            flexShrink: 0,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Download size={15} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="c360-table-container">
        {/* Controls Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid #eaecf0',
            background: '#ffffff',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '520px', flexWrap: 'wrap' }}>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="c360-select"
              style={{ width: '170px', height: '40px', fontSize: '13px' }}
            >
              <option value="">All Action Types</option>
              <option value="VIEW">View Audits</option>
              <option value="CREATE">Create Events</option>
              <option value="EDIT">Update Events</option>
              <option value="DELETE">Delete Events</option>
            </select>

            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search user, action, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="c360-input"
                style={{ height: '40px', paddingLeft: '38px', paddingRight: searchQuery ? '32px' : '14px', fontSize: '13px' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={fetchLogs}
            title="Refresh Logs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={18} className="animate-spin" style={{ color: '#2563eb' }} />
              <span>Loading audit trail events...</span>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛡️</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              No audit logs found
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {searchQuery || actionFilter
                ? 'Try adjusting your search query or action filter.'
                : 'Customer profile view and edit events will appear here automatically.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="c360-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor / Officer</th>
                  <th>Customer Reference</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const badge = getActionBadge(log.action);

                  return (
                    <tr key={idx}>
                      <td style={{ whiteSpace: 'nowrap', color: '#0f172a', fontWeight: 500 }}>
                        {log.timestamp}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            background: badge.bg,
                            color: badge.text,
                            fontSize: '11.5px',
                            fontWeight: 750,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: badge.dot }} />
                          {(log.action || 'VIEW').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{log.user || 'System'}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.customerName || '-'}</div>
                        {log.customerId && (
                          <div style={{ fontSize: '11.5px', color: '#64748b', fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                            {log.customerId}
                          </div>
                        )}
                      </td>
                      <td style={{ color: '#334155', maxWidth: '280px' }}>{log.description || '-'}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: (log.status || '').toLowerCase() === 'success' ? '#16a34a' : '#dc2626',
                          }}
                        >
                          {log.status || 'Success'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLog(log);
                            setDetailsOpen(true);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 11px',
                            borderRadius: '8px',
                            border: '1px solid #bfdbfe',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#dbeafe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#eff6ff';
                          }}
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination — server-side paged (pageNumber/pageSize/totalPages all come from the API
          response, not a client-side slice of an already-fetched full list), which matters at bank
          scale: this never has to pull more than one page of audit records into the browser at once. */}
      {totalCount > pageSize && (
        <div className="c360-pagination">
          <button
            type="button"
            className="c360-page-btn"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => p - 1)}
          >
            &lt; Previous
          </button>
          <span className="c360-page-indicator">
            Page {pageNumber} of {totalPages}
          </span>
          <button
            type="button"
            className="c360-page-btn"
            disabled={pageNumber >= totalPages}
            onClick={() => setPageNumber((p) => p + 1)}
          >
            Next &gt;
          </button>
        </div>
      )}

      {/* Details drawer — right-side, matching the host's own drawer pattern (and this app's own
          CaseDetailsModal/ProductDetailsModal) rather than a centered dialog. */}
      {detailsOpen && selectedLog && (
        <div className="drawer-overlay" onClick={() => setDetailsOpen(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header blue-header">
              <div className="drawer-title-text">
                <h3>Audit Record Details</h3>
                <p>Full details of this audit trail entry</p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setDetailsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="drawer-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13.5px' }}>
                <div>
                  <span style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Timestamp
                  </span>
                  <strong style={{ color: '#0f172a' }}>{selectedLog.timestamp}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Officer / User
                  </span>
                  <strong style={{ color: '#0f172a' }}>{selectedLog.user}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Action
                  </span>
                  <strong style={{ color: '#2563eb' }}>{selectedLog.action}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Status
                  </span>
                  <strong style={{ color: (selectedLog.status || '').toLowerCase() === 'success' ? '#16a34a' : '#dc2626' }}>
                    {selectedLog.status}
                  </strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Customer
                  </span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>
                    {selectedLog.customerName} ({selectedLog.customerId})
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Description
                  </span>
                  <div style={{ color: '#334155', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #eaecf0', marginTop: '4px' }}>
                    {selectedLog.description}
                  </div>
                </div>
              </div>
            </div>
            <div className="drawer-footer">
              <button
                type="button"
                className="c360-btn-secondary"
                onClick={() => setDetailsOpen(false)}
                style={{ height: '36px', padding: '0 16px', fontSize: '13px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
