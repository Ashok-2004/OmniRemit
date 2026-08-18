import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useLeadStore } from '../../store/useLeadStore';

const GRANULARITY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const LeadsOverTimeCard: React.FC = () => {
  const { leadsOverTime, dashboardGranularity, setDashboardGranularity, isLoadingDashboard } =
    useLeadStore();

  return (
    /* widgetCard — matches host exactly */
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #eaecf0',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* widgetHeader */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '14.5px',
              fontWeight: 700,
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            Leads Over Time
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0', fontWeight: 400 }}>
            Application submission trends
          </p>
        </div>

        {/* headerManageBtn style */}
        <select
          value={dashboardGranularity}
          onChange={(e) =>
            setDashboardGranularity(e.target.value as 'daily' | 'weekly' | 'monthly')
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '7px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#475569',
            cursor: 'pointer',
            transition: 'background 130ms ease, color 130ms ease, border-color 130ms ease',
            outline: 'none',
            fontFamily: 'inherit',
            appearance: 'none',
            WebkitAppearance: 'none',
            minWidth: '80px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLSelectElement).style.background = '#2563eb';
            (e.currentTarget as HTMLSelectElement).style.color = '#ffffff';
            (e.currentTarget as HTMLSelectElement).style.borderColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLSelectElement).style.background = '#f8fafc';
            (e.currentTarget as HTMLSelectElement).style.color = '#475569';
            (e.currentTarget as HTMLSelectElement).style.borderColor = '#e2e8f0';
          }}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Chart */}
      <div style={{ height: '200px', width: '100%' }}>
        {isLoadingDashboard ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: '13px',
            }}
          >
            Loading trend data...
          </div>
        ) : leadsOverTime.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: '13px',
            }}
          >
            No leads recorded in the selected period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={leadsOverTime} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="leadAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'Inter, sans-serif' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'Inter, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  fontFamily: 'Inter, sans-serif',
                }}
                labelStyle={{ fontWeight: 600, color: '#93c5fd' }}
                formatter={(value: any) => [`${value} Leads`, 'Leads']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#2563eb"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#leadAreaGradient)"
                dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Granularity label footer */}
      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginTop: '-8px' }}>
        Showing: <strong style={{ color: '#64748b' }}>{GRANULARITY_LABELS[dashboardGranularity]}</strong> breakdown
      </div>
    </div>
  );
};
