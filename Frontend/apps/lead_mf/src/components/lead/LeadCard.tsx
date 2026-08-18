import React from 'react';
import { ChevronRight } from 'lucide-react';
import { LeadRecord } from '../../types/lead';

// Deterministic avatar colours based on initials
const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#dc2626', '#059669',
  '#d97706', '#0891b2', '#be185d', '#4f46e5',
  '#0d9488', '#9333ea', '#c2410c', '#1d4ed8',
];

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'New': { bg: '#eff6ff', color: '#2563eb' },
  'Contacted': { bg: '#e0e7ff', color: '#4338ca' },
  'In Progress': { bg: '#fef3c7', color: '#b45309' },
  'Qualified': { bg: '#d1fae5', color: '#047857' },
  'Converted': { bg: '#dcfce7', color: '#15803d' },
  'Closed': { bg: '#f1f5f9', color: '#64748b' },
};

const getInitials = (name: string): string => {
  const parts = name.split(' ').filter((p) => !['bin', 'binti', 'a/l', 'a/p'].includes(p.toLowerCase()));
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || '??';
};

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

interface LeadCardProps {
  lead: LeadRecord;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead }) => {
  const initials = getInitials(lead.name);
  const avatarColor = getAvatarColor(lead.name);
  const statusStyle = STATUS_STYLES[lead.status] || STATUS_STYLES['New'];

  return (
    <div className="lead-card" id={`lead-card-${lead.id}`}>
      {/* Card Header: Avatar + Name + Status */}
      <div className="lead-card-header">
        <div className="lead-card-avatar" style={{ backgroundColor: avatarColor }}>
          {initials}
        </div>
        <div className="lead-card-header-info">
          <div className="lead-card-name">{lead.name}</div>
          <div className="lead-card-ic">{lead.icNumber}</div>
        </div>
        <span
          className="lead-status-badge"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
        >
          {lead.status}
        </span>
      </div>

      {/* Card Divider */}
      <div className="lead-card-divider" />

      {/* Card Details */}
      <div className="lead-card-details">
        <div className="lead-card-detail-row">
          <span className="lead-card-detail-label">PHONE</span>
          <span className="lead-card-detail-value">{lead.phone}</span>
        </div>
        <div className="lead-card-detail-row">
          <span className="lead-card-detail-label">PRODUCT</span>
          <span className="lead-card-detail-value">{lead.product}</span>
        </div>
        <div className="lead-card-detail-row">
          <span className="lead-card-detail-label">BRANCH</span>
          <span className="lead-card-detail-value">{lead.branch}</span>
        </div>
        <div className="lead-card-detail-row">
          <span className="lead-card-detail-label">EMAIL</span>
          <span className="lead-card-detail-value lead-card-detail-email">{lead.email}</span>
        </div>
      </div>

      {/* Chevron indicator */}
      <div className="lead-card-chevron">
        <ChevronRight size={18} color="#94a3b8" />
      </div>
    </div>
  );
};
