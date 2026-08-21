import React from 'react';
import { useLeadStore } from '../../store/useLeadStore';
import { SearchableDropdown } from '../common/SearchableDropdown';
import { isFieldVisible, isFieldEditable, getFieldLabel } from '../../config/fieldControlRegistry';

interface PreferredSalesExecutiveSectionProps {
  isEdit?: boolean;
}

export const PreferredSalesExecutiveSection: React.FC<PreferredSalesExecutiveSectionProps> = ({ isEdit = false }) => {
  const store = useLeadStore();
  const formData = isEdit ? store.editFormData : store.formData;
  const errors = isEdit ? store.editErrors : store.errors;
  const setFieldValue = isEdit ? store.setEditFieldValue : store.setFieldValue;
  const salesExecutives = store.salesExecutives;
  const validateField = isEdit ? () => {} : store.validateField;
  const config = store.fieldConfig;

  const handleCheckboxToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setFieldValue('hasPreferredSalesExecutive', isChecked);
    if (!isChecked) {
      setFieldValue('preferredSalesExecutive', '');
    }
  };

  if (!isFieldVisible(config, 'hasPreferredSalesExecutive')) return null;

  const checkboxLocked = isEdit && !isFieldEditable(config, 'hasPreferredSalesExecutive');

  return (
    <div style={{ marginTop: '20px', marginBottom: '20px' }}>
      <label className="custom-checkbox-label" style={{ marginBottom: '14px' }}>
        <input
          type="checkbox"
          className="custom-checkbox-input"
          checked={formData.hasPreferredSalesExecutive}
          disabled={checkboxLocked}
          onChange={handleCheckboxToggle}
        />
        <span style={{ fontWeight: 500, color: '#1e293b' }}>
          {getFieldLabel(config, 'hasPreferredSalesExecutive', 'Select your preferred Sales Executive')}
        </span>
      </label>

      {formData.hasPreferredSalesExecutive && isFieldVisible(config, 'preferredSalesExecutive') && (
        <div style={{ marginTop: '12px', paddingLeft: '28px' }}>
          <SearchableDropdown
            label={getFieldLabel(config, 'preferredSalesExecutive', 'Select your preferred Sales Executive')}
            placeholder="Select Sales Executive"
            options={salesExecutives}
            value={formData.preferredSalesExecutive}
            disabled={isEdit && !isFieldEditable(config, 'preferredSalesExecutive')}
            onChange={(val) => setFieldValue('preferredSalesExecutive', val)}
            onBlur={() => validateField('preferredSalesExecutive')}
            required
            error={errors.preferredSalesExecutive}
            emptyMessage="No sales executives currently available"
          />
        </div>
      )}
    </div>
  );
};
