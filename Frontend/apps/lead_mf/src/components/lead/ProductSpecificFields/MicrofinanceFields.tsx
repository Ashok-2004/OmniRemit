import React from 'react';
import { Building2 } from 'lucide-react';
import { useLeadStore } from '../../../store/useLeadStore';
import { DatePicker } from '../../common/DatePicker';
import { SearchableDropdown } from '../../common/SearchableDropdown';

interface MicrofinanceFieldsProps {
  isEdit?: boolean;
}

export const MicrofinanceFields: React.FC<MicrofinanceFieldsProps> = ({ isEdit = false }) => {
  const store = useLeadStore();
  const formData = isEdit ? store.editFormData : store.formData;
  const errors = isEdit ? store.editErrors : store.errors;
  const setFieldValue = isEdit ? store.setEditFieldValue : store.setFieldValue;
  const entityTypes = store.entityTypes;
  const validateField = isEdit ? () => {} : store.validateField;

  return (
    <div className="form-section">
      <div className="form-section-title">
        <Building2 size={18} className="form-section-icon" />
        <span>Microfinance Business Details</span>
      </div>

      <div className="form-grid-1">
        {/* Date of Incorporation */}
        <DatePicker
          id="date-of-incorporation-picker"
          label="Date of Incorporation"
          placeholder="DD/MM/YYYY"
          value={formData.dateOfIncorporation}
          onChange={(val) => setFieldValue('dateOfIncorporation', val)}
          required
          error={errors.dateOfIncorporation}
        />

        {/* Company Name */}
        <div className="form-field-group">
          <label className="form-label">
            Company Name <span className="required-asterisk">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.companyName ? 'has-error' : ''}`}
            value={formData.companyName}
            onChange={(e) => setFieldValue('companyName', e.target.value)}
            onBlur={() => validateField('companyName')}
          />
          {errors.companyName && (
            <div className="field-error-message">{errors.companyName}</div>
          )}
        </div>

        {/* Entity Type */}
        <SearchableDropdown
          label="Entity Type"
          placeholder="Select Entity Type"
          options={entityTypes}
          value={formData.entityType}
          onChange={(val) => setFieldValue('entityType', val)}
          onBlur={() => validateField('entityType')}
          required
          error={errors.entityType}
        />
      </div>
    </div>
  );
};
