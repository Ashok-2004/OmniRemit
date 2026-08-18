import React, { useEffect } from 'react';
import { useLeadStore } from '../store/useLeadStore';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { KpiCardSection } from '../components/dashboard/KpiCardSection';
import { LeadsOverTimeCard } from '../components/dashboard/LeadsOverTimeCard';
import { LeadsByProductCard } from '../components/dashboard/LeadsByProductCard';
import { LeadsByBranchCard } from '../components/dashboard/LeadsByBranchCard';
import { TopSalesExecutivesCard } from '../components/dashboard/TopSalesExecutivesCard';
import { RecentLeadsCard } from '../components/dashboard/RecentLeadsCard';
import { LeadDetailsDrawer } from '../components/lead/LeadDetailsDrawer';

export const DashboardPage: React.FC = () => {
  const { fetchDashboardData, fetchMasterData, products } = useLeadStore();

  useEffect(() => {
    fetchDashboardData();
    if (products.length === 0) {
      fetchMasterData();
    }
  }, [fetchDashboardData, fetchMasterData, products.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        maxWidth: '1340px',
        width: '100%',
        paddingBottom: '32px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* Hero Welcome Banner */}
      <DashboardHeader />

      {/* 5 KPI Stat Cards */}
      <KpiCardSection />

      {/* Row 1: Charts — 2-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
        }}
      >
        <LeadsOverTimeCard />
        <LeadsByProductCard />
      </div>

      {/* Row 2: Branch Distribution (Left) & Top Sales Executives (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
        }}
      >
        <LeadsByBranchCard />
        <TopSalesExecutivesCard />
      </div>

      {/* Row 3: Recent Leads — full width */}
      <RecentLeadsCard />

      {/* Lead Details Side Drawer */}
      <LeadDetailsDrawer />
    </div>
  );
};

export default DashboardPage;
