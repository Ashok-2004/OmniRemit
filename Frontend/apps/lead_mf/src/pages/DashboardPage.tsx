import React, { useEffect } from 'react';
import { useLeadStore } from '../store/useLeadStore';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { KpiCardSection } from '../components/dashboard/KpiCardSection';
import { LeadsOverTimeCard } from '../components/dashboard/LeadsOverTimeCard';
import { LeadsByProductCard } from '../components/dashboard/LeadsByProductCard';
import { LeadsByBranchCard } from '../components/dashboard/LeadsByBranchCard';
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
      {/* Inject responsive grid CSS for chart rows */}
      <style>{`
        @media (max-width: 768px) {
          .lead-dash-charts-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Hero Welcome Banner */}
      <DashboardHeader />

      {/* 5 KPI Stat Cards */}
      <KpiCardSection />

      {/* Row 1: Charts — 2-column grid */}
      <div
        className="lead-dash-charts-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
        }}
      >
        <LeadsOverTimeCard />
        <LeadsByProductCard />
      </div>

      {/* Row 2: Branch Distribution — Top Sales Executives removed, so this is a single column now
          rather than leaving an empty gap where it used to sit. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '20px',
        }}
      >
        <LeadsByBranchCard />
      </div>

      {/* Row 3: Recent Leads — full width */}
      <RecentLeadsCard />

      {/* Lead Details Side Drawer */}
      <LeadDetailsDrawer />
    </div>
  );
};

export default DashboardPage;
