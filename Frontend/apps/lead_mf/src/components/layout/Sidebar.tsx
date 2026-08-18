import React from 'react';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  ShieldCheck,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';
import {
  canViewDashboard,
  canViewLeads,
  canCreateLead,
  canViewAuditLogs,
} from '../../api/hostBridge';
import type { NavigationPage } from '../../types/lead';

interface NavItem {
  id: NavigationPage;
  label: string;
  icon: React.ReactNode;
  visible: boolean;
}

export const Sidebar: React.FC = () => {
  const { activePage, setActivePage, isSidebarExpanded, toggleSidebar, leads, totalRecords } = useLeadStore();

  const userCanViewDashboard = canViewDashboard();
  const userCanViewLeads = canViewLeads();
  const userCanCreateLead = canCreateLead();
  const userCanViewAuditLogs = canViewAuditLogs();

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={18} className="nav-icon" />,
      visible: userCanViewDashboard,
    },
    {
      id: 'view-lead',
      label: 'View Leads',
      icon: <Users size={18} className="nav-icon" />,
      visible: userCanViewLeads,
    },
    {
      id: 'create-lead',
      label: 'Create Lead',
      icon: <UserPlus size={18} className="nav-icon" />,
      visible: userCanCreateLead,
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      icon: <ShieldCheck size={18} className="nav-icon" />,
      visible: userCanViewAuditLogs,
    },
  ];

  const visibleItems = navItems.filter((item) => item.visible);

  return (
    <aside className={`lead-sub-sidebar ${!isSidebarExpanded ? 'collapsed' : ''}`} aria-label="Lead Management Sub-navigation">
      {/* Sub-system Header */}
      <div className="lead-sub-sidebar-header">
        {isSidebarExpanded ? (
          <>
            <div className="lead-sub-sidebar-brand">
              <div className="lead-sub-sidebar-icon">
                <Layers size={18} color="#2563eb" />
              </div>
              <div className="lead-sub-sidebar-text">
                <span className="lead-sub-sidebar-title">Lead Management</span>
                <span className="lead-sub-sidebar-sub">Sub-Section</span>
              </div>
            </div>
            <button
              type="button"
              className="lead-sub-sidebar-toggle"
              onClick={toggleSidebar}
              title="Collapse Sub-Sidebar"
              aria-label="Collapse Sub-Sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        ) : (
          <div className="lead-sub-sidebar-collapsed-box">
            <div className="lead-sub-sidebar-icon" title="Lead Management System">
              <Layers size={18} color="#2563eb" />
            </div>
            <button
              type="button"
              className="lead-sub-sidebar-toggle"
              onClick={toggleSidebar}
              title="Expand Sub-Sidebar"
              aria-label="Expand Sub-Sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Sub-Section Menu */}
      <nav className="lead-sub-sidebar-nav">
        {isSidebarExpanded && (
          <div className="lead-sub-sidebar-group-title">
            <span>OPERATIONS</span>
          </div>
        )}

        <div className="lead-sub-sidebar-items">
          {visibleItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                id={`lead-subnav-${item.id}`}
                className={`lead-sub-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActivePage(item.id)}
                title={!isSidebarExpanded ? item.label : undefined}
              >
                <span className="lead-sub-nav-icon">{item.icon}</span>
                {isSidebarExpanded && (
                  <span className="lead-sub-nav-label">{item.label}</span>
                )}
                {isSidebarExpanded && item.id === 'view-lead' && (totalRecords > 0 || leads.length > 0) && (
                  <span className="lead-sub-nav-badge">
                    {totalRecords > 0 ? totalRecords : leads.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
};
