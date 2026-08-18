import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useLeadStore } from '../../store/useLeadStore';

export const LeadsByProductCard: React.FC = () => {
  const { leadsByProduct, kpiSummary, isLoadingDashboard } = useLeadStore();
  const totalLeads = kpiSummary.totalLeads;

  return (
    /* widgetCard */
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
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
            Leads by Product
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0', fontWeight: 400 }}>
            Product distribution across applications
          </p>
        </div>
      </div>

      {isLoadingDashboard ? (
        <div
          style={{
            height: '180px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '13px',
          }}
        >
          Loading product distribution...
        </div>
      ) : leadsByProduct.length === 0 ? (
        <div
          style={{
            height: '180px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '13px',
          }}
        >
          No product distribution data available.
        </div>
      ) : (
        /* donutContainer */
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', minHeight: '180px' }}>
          {/* Donut SVG Wrap */}
          <div style={{ position: 'relative', width: '148px', height: '148px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadsByProduct}
                  dataKey="count"
                  nameKey="productName"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="none"
                >
                  {leadsByProduct.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  formatter={(value: any, name: any) => [`${value} Leads`, name]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* donutCenter */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {totalLeads.toLocaleString()}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontWeight: 600,
                  marginTop: '3px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Total
              </span>
            </div>
          </div>

          {/* legendList */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              flex: 1,
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {leadsByProduct.map((item, idx) => (
              /* legendItem */
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                {/* legendLeft */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: '#334155',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.productName}
                  </span>
                </div>
                {/* legendStat */}
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.count}{' '}
                  <span style={{ color: '#64748b', fontWeight: 500 }}>({item.percentage}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
