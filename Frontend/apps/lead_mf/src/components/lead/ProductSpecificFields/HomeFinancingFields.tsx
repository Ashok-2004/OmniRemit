import React from 'react';
import { Home } from 'lucide-react';
import { useLeadStore } from '../../../store/useLeadStore';
import { SearchableDropdown } from '../../common/SearchableDropdown';

interface HomeFinancingFieldsProps {
  isEdit?: boolean;
}

export const HomeFinancingFields: React.FC<HomeFinancingFieldsProps> = ({ isEdit = false }) => {
  const store = useLeadStore();
  const formData = isEdit ? store.editFormData : store.formData;
  const errors = isEdit ? store.editErrors : store.errors;
  const setFieldValue = isEdit ? store.setEditFieldValue : store.setFieldValue;
  const propertyTypes = store.propertyTypes;
  const propertyStatuses = store.propertyStatuses;
  const validateField = isEdit ? () => {} : store.validateField;

  return (
    <div className="form-section">
      <div className="form-section-title">
        <Home size={18} className="form-section-icon" />
        <span>Home Financing Details</span>
      </div>

      <div className="form-grid-2">
        <SearchableDropdown
          label="Property Type"
          placeholder="Select Property Type"
          options={propertyTypes}
          value={formData.propertyType}
          onChange={(val) => setFieldValue('propertyType', val)}
          onBlur={() => validateField('propertyType')}
          required
          error={errors.propertyType}
        />

        <SearchableDropdown
          label="Property Status"
          placeholder="Select Property Status"
          options={propertyStatuses}
          value={formData.propertyStatus}
          onChange={(val) => setFieldValue('propertyStatus', val)}
          onBlur={() => validateField('propertyStatus')}
          required
          error={errors.propertyStatus}
        />
      </div>
    </div>
  );
};
