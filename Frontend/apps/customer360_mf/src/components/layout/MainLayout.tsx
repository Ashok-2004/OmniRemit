import React, { useEffect } from 'react';
import { HostSidebarCustomer360Nav } from './HostSidebarCustomer360Nav';
import { useNavigationStore } from '../../store/navigationStore';
import { useCustomerStore } from '../../store/customerStore';
import Customer360 from '../../pages/Customer360';
import AllProducts from '../../pages/AllProducts';
import AllInteractions from '../../pages/AllInteractions';
import AuditLogs from '../../pages/AuditLogs';

export const MainLayout: React.FC = () => {
  const { activePage } = useNavigationStore();
  const { loadActiveProfile, setCustomerType } = useCustomerStore();

  useEffect(() => {
    if (activePage === 'individual') {
      setCustomerType('individual');
    } else if (activePage === 'non-individual') {
      setCustomerType('corporate');
    }
  }, [activePage, setCustomerType]);

  useEffect(() => {
    loadActiveProfile();
  }, [loadActiveProfile]);

  const renderActivePage = () => {
    switch (activePage) {
      case 'individual':
      case 'non-individual':
      case 'customer-360':
        return <Customer360 />;
      case 'products':
        return <AllProducts />;
      case 'interactions':
        return <AllInteractions />;
      case 'audit-logs':
        return <AuditLogs />;
      default:
        return <Customer360 />;
    }
  };

  return (
    <div className="c360-remote-app-root">
      {/* Portals collapsible sub-sections directly into Host's main sidebar under Customer 360 */}
      <HostSidebarCustomer360Nav />

      {/* Main Workspace Content Area (Full Width) */}
      <div className="c360-workspace-content-area">
        <main className="c360-workspace-viewport">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
