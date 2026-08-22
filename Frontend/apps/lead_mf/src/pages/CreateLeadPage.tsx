import React from 'react';
import { LeadFormContainer } from '../components/lead/LeadFormContainer';
import { FileText } from 'lucide-react';

export const CreateLeadPage: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        maxWidth: '1340px',
        width: '100%',
        paddingBottom: '40px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* Page Hero Banner */}
      <div
        className="lead-hero-banner"
        style={{
          borderRadius: '18px',
          padding: '24px 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(120deg, #1e40af 0%, #2563eb 45%, #3b82f6 100%)',
          boxShadow: '0 4px 20px rgba(37, 99, 235, 0.25), 0 1px 4px rgba(37, 99, 235, 0.15)',
          boxSizing: 'border-box',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.07)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-60px',
            right: '120px',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            minWidth: 0,
            flexWrap: 'wrap',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Avatar icon */}
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <FileText size={24} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#ffffff',
                margin: 0,
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                wordBreak: 'break-word',
              }}
            >
              Submit New Lead Application
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.82)',
                margin: 0,
                wordBreak: 'break-word',
              }}
            >
              Complete all required fields to register a new customer financing enquiry
            </p>
          </div>
        </div>

        {/* Right: Role chip */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(255, 255, 255, 0.18)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.28)',
            borderRadius: '999px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            backdropFilter: 'blur(4px)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Lead Submission Form
        </div>
      </div>

      {/* Form Card — uses responsive form-card CSS class instead of fixed inline padding */}
      <div
        className="form-card"
        style={{
          boxSizing: 'border-box',
          width: '100%',
          marginBottom: 0,
        }}
      >
        <LeadFormContainer />
      </div>
    </div>
  );
};

