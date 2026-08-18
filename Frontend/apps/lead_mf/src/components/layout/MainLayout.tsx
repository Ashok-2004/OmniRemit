import React, { useEffect } from 'react';
import { HostSidebarLeadNav } from './HostSidebarLeadNav';
import { ToastNotification } from '../common/ToastNotification';
import { useLeadStore } from '../../store/useLeadStore';
import { CreateLeadPage } from '../../pages/CreateLeadPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { ViewLeadPage } from '../../pages/ViewLeadPage';
import { AuditLogsPage } from '../../pages/AuditLogsPage';

export const MainLayout: React.FC = () => {
  const { activePage, fetchDashboardData, fetchMasterData, fetchLeads, products } = useLeadStore();

  useEffect(() => {
    fetchDashboardData();
    if (products.length === 0) {
      fetchMasterData();
    }
    fetchLeads();
  }, [fetchDashboardData, fetchMasterData, fetchLeads, products.length]);

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'create-lead':
        return <CreateLeadPage />;
      case 'view-lead':
        return <ViewLeadPage />;
      case 'audit-logs':
        return <AuditLogsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="lead-remote-app-root">
      {/* Portals collapsible sub-sections directly into Host's main sidebar under Lead Management */}
      <HostSidebarLeadNav />

      {/* Main Workspace Content Area (Full Width) */}
      <div className="lead-workspace-content-area">
        <main className={`lead-workspace-viewport${activePage === 'dashboard' || activePage === 'view-lead' || activePage === 'audit-logs' ? ' lead-workspace-viewport--wide' : ''}`}>
          {renderActivePage()}
        </main>
      </div>

      {/* Global Toast Notification */}
      <ToastNotification />
    </div>
  );
};
