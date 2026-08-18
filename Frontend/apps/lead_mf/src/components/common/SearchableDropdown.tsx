import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { DropdownOption } from '../../types/lead';

interface SearchableDropdownProps {
  id?: string;
  label?: string;
  placeholder?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  id,
  label,
  placeholder = 'Select an option',
  options = [],
  value,
  onChange,
  onBlur,
  required = false,
  error,
  disabled = false,
  emptyMessage = 'No options available',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find currently selected option object
  const selectedOption = options.find((opt) => opt.value === value);

  // Synchronize input term when value changes or when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOption ? selectedOption.label : '');
    }
  }, [value, selectedOption, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen) {
          setIsOpen(false);
          setSearchTerm(selectedOption ? selectedOption.label : '');
          if (onBlur) onBlur();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, selectedOption, onBlur]);

  // Filter options based on direct input search term
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes((isOpen ? searchTerm : '').toLowerCase())
  );

  const handleInputFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearchTerm(''); // Clear text on focus so all options show initially
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleSelect = (option: DropdownOption) => {
    onChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (onBlur) onBlur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(true);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm(selectedOption ? selectedOption.label : '');
    }
  };

  return (
    <div className="form-field-group" ref={containerRef} id={id}>
      {label && (
        <label className="form-label">
          {label} {required && <span className="required-asterisk">*</span>}
        </label>
      )}

      <div className="dropdown-container" style={{ position: 'relative' }}>
        {/* Unified Searchable Input Field */}
        <div
          className={`dropdown-trigger ${isOpen ? 'open' : ''} ${error ? 'has-error' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: '12px',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            style={{
              border: 'none',
              outline: 'none',
              padding: 0,
              boxShadow: 'none',
              background: 'transparent',
              width: '100%',
              fontSize: '14px',
              color: '#0f172a',
              cursor: disabled ? 'not-allowed' : 'text',
            }}
            placeholder={placeholder}
            value={isOpen ? searchTerm : selectedOption ? selectedOption.label : ''}
            onFocus={handleInputFocus}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
            {selectedOption && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
                title="Clear selection"
              >
                <X size={14} />
              </button>
            )}
            <ChevronDown
              size={16}
              style={{
                color: '#64748b',
                transition: 'transform 0.2s',
                transform: isOpen ? 'rotate(180deg)' : 'none',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Dynamic Suggestions List */}
        {isOpen && (
          <div
            className="dropdown-menu"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              zIndex: 100,
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {options.length === 0 ? (
              <div className="dropdown-empty-state" style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                {emptyMessage}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="dropdown-empty-state" style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <div
                  key={opt.value}
                  className={`dropdown-option ${opt.value === value ? 'selected' : ''} ${
                    idx === highlightedIndex ? 'highlighted' : ''
                  }`}
                  style={{
                    padding: '8px 14px',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor:
                      opt.value === value
                        ? '#eff6ff'
                        : idx === highlightedIndex
                        ? '#f1f5f9'
                        : 'transparent',
                    color: opt.value === value ? '#2563eb' : '#1e293b',
                    fontWeight: opt.value === value ? 600 : 400,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur before click registers
                    handleSelect(opt);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && <Check size={15} style={{ color: '#2563eb' }} />}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
};
