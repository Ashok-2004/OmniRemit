import React from 'react';
import { User } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';
import { SearchableDropdown } from '../common/SearchableDropdown';

interface CustomerInformationSectionProps {
  isEdit?: boolean;
}

export const CustomerInformationSection: React.FC<CustomerInformationSectionProps> = ({ isEdit = false }) => {
  const store = useLeadStore();
  const formData = isEdit ? store.editFormData : store.formData;
  const errors = isEdit ? store.editErrors : store.errors;
  const setFieldValue = isEdit ? store.setEditFieldValue : store.setFieldValue;
  const states = store.states;
  const branches = store.branches;
  const validateField = isEdit ? () => {} : store.validateField;

  return (
    <div className="form-section">
      <div className="form-section-title">
        <User size={18} className="form-section-icon" />
        <span>Customer Information</span>
      </div>

      <div className="form-grid-1">
        {/* Customer Name */}
        <div className="form-field-group">
          <label className="form-label">
            Customer Name <span className="required-asterisk">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.customerName ? 'has-error' : ''}`}
            value={formData.customerName}
            onChange={(e) => setFieldValue('customerName', e.target.value)}
            onBlur={() => validateField('customerName')}
          />
          {errors.customerName && (
            <div className="field-error-message">{errors.customerName}</div>
          )}
        </div>

        {/* IC Number */}
        <div className="form-field-group">
          <label className="form-label">
            IC Number <span className="required-asterisk">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.icNumber ? 'has-error' : ''}`}
            value={formData.icNumber}
            onChange={(e) => setFieldValue('icNumber', e.target.value)}
            onBlur={() => validateField('icNumber')}
          />
          {errors.icNumber && (
            <div className="field-error-message" style={{ marginTop: '4px' }}>
              <div>{errors.icNumber}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontWeight: 400 }}>
                Format: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>YYMMDD-PB-XXXX</span>
              </div>
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="form-field-group">
          <label className="form-label">
            Phone <span className="required-asterisk">*</span>
          </label>
          <div className={`phone-input-container ${errors.phoneNumber ? 'has-error' : ''}`}>
            <div className="phone-prefix-box">
              <span style={{ fontSize: '15px' }}>🇲🇾</span>
              <span>+60</span>
            </div>
            <input
              type="tel"
              className="form-input phone-input-field"
              value={formData.phoneNumber}
              onChange={(e) => setFieldValue('phoneNumber', e.target.value)}
              onBlur={() => validateField('phoneNumber')}
            />
          </div>
          {errors.phoneNumber && (
            <div className="field-error-message">{errors.phoneNumber}</div>
          )}
        </div>

        {/* Email */}
        <div className="form-field-group">
          <label className="form-label">
            Email <span className="required-asterisk">*</span>
          </label>
          <input
            type="email"
            className={`form-input ${errors.email ? 'has-error' : ''}`}
            value={formData.email}
            onChange={(e) => setFieldValue('email', e.target.value)}
            onBlur={() => validateField('email')}
          />
          {errors.email && (
            <div className="field-error-message">{errors.email}</div>
          )}
        </div>

        {/* State */}
        <SearchableDropdown
          label="State"
          placeholder="Select state"
          options={states}
          value={formData.state}
          onChange={(val) => setFieldValue('state', val)}
          onBlur={() => validateField('state')}
          required
          error={errors.state}
        />

        {/* Preferred Servicing Branch */}
        <SearchableDropdown
          label="Preferred Servicing Branch"
          placeholder="Select servicing branch"
          options={branches}
          value={formData.preferredBranch}
          onChange={(val) => setFieldValue('preferredBranch', val)}
          emptyMessage="No branch options currently available"
        />

        {/* Employer Name */}
        <div className="form-field-group">
          <label className="form-label">
            Employer Name <span className="required-asterisk">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.employerName ? 'has-error' : ''}`}
            value={formData.employerName}
            onChange={(e) => setFieldValue('employerName', e.target.value)}
            onBlur={() => validateField('employerName')}
          />
          {errors.employerName && (
            <div className="field-error-message">{errors.employerName}</div>
          )}
        </div>

        {/* Applied Amount */}
        <div className="form-field-group">
          <label className="form-label">
            Applied Amount <span className="required-asterisk">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.appliedAmount ? 'has-error' : ''}`}
            value={formData.appliedAmount}
            onChange={(e) => setFieldValue('appliedAmount', e.target.value)}
            onBlur={() => validateField('appliedAmount')}
          />
          {errors.appliedAmount && (
            <div className="field-error-message">{errors.appliedAmount}</div>
          )}
        </div>
      </div>
    </div>
  );
};
