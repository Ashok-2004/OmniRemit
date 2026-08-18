import React from 'react';
import { ProductSelector } from './ProductSelector';
import { CustomerInformationSection } from './CustomerInformationSection';
import { PreferredSalesExecutiveSection } from './PreferredSalesExecutiveSection';
import { HomeFinancingFields } from './ProductSpecificFields/HomeFinancingFields';
import { MicrofinanceFields } from './ProductSpecificFields/MicrofinanceFields';
import { DeclarationConsentSection } from './DeclarationConsentSection';
import { useLeadStore } from '../../store/useLeadStore';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface LeadFormContainerProps {
  mode?: 'page' | 'drawer';
  onSuccess?: () => void;
}

export const LeadFormContainer: React.FC<LeadFormContainerProps> = ({
  mode = 'page',
  onSuccess,
}) => {
  const { formData, submitLead, isSubmitting } = useLeadStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await submitLead();
    if (success && mode === 'drawer' && onSuccess) {
      onSuccess();
    }
  };

  const isHomeFinancing = formData.product === 'Home Financing';
  const isMicrofinance = formData.product === 'Micro Finance';

  const formContent = (
    <form onSubmit={handleSubmit} noValidate>
      {/* Step 1: Product Selection */}
      <div style={{ marginBottom: '8px' }}>
        <ProductSelector />
      </div>

      {/* Display form only when a product is selected */}
      {formData.product ? (
        <div style={{ animation: 'fadeInForm 0.25s ease-out' }}>
          <CustomerInformationSection />
          <PreferredSalesExecutiveSection />
          {isHomeFinancing && <HomeFinancingFields />}
          {isMicrofinance && <MicrofinanceFields />}
          <DeclarationConsentSection />

          {/* Submit Button — only in page mode */}
          {mode === 'page' && (
            <button
              type="submit"
              className="submit-btn-primary"
              disabled={isSubmitting}
              id="lead-submit-button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Submitting Application...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Submit Lead Application</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            marginTop: '20px',
            padding: '32px 24px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '13.5px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1.5px dashed #e2e8f0',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
            Select a Financing Product
          </div>
          <div>Choose a product above to display the lead application form fields.</div>
        </div>
      )}
    </form>
  );

  // Drawer mode: return just the form content
  if (mode === 'drawer') {
    return formContent;
  }

  // Page mode: render without extra card wrapper — CreateLeadPage provides the card
  return formContent;
};
