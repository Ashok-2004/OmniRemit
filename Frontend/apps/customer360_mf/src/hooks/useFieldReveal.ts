import { useState, useCallback } from 'react';
import { api } from '../services/api';

export interface RevealAuditContext {
  customerName: string;
  customerType: 'Individual' | 'Non-Individual';
  customerId: string;
}

/**
 * The reveal-toggle + view-sensitive-data audit logging behavior that used to be hand-rolled
 * independently in IndividualDetails.tsx and CompanyOverview.tsx (identical logic, copy-pasted
 * twice). One shared implementation now backs both of the config-driven detail views.
 */
export function useFieldReveal(context: RevealAuditContext) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const toggleReveal = useCallback(
    async (fieldKey: string, fieldLabel: string, realVal: string) => {
      const isRevealing = !revealed[fieldKey];
      setRevealed((prev) => ({ ...prev, [fieldKey]: isRevealing }));

      if (isRevealing) {
        try {
          await api.logAudit({
            action: 'VIEW_SENSITIVE_DATA',
            customerName: context.customerName || 'Unknown',
            customerType: context.customerType,
            field: fieldLabel,
            status: 'Success',
            description: `Viewed ${fieldLabel} for customer '${context.customerName || 'Unknown'}'`,
            customerId: context.customerId || '',
          });
        } catch (err) {
          console.error('Failed to log view sensitive data audit:', err);
        }
      }
    },
    [revealed, context.customerName, context.customerType, context.customerId]
  );

  return { revealed, toggleReveal };
}
