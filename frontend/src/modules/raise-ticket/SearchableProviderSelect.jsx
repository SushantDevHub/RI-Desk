import { useState, useRef, useEffect, useId } from 'react';

/**
 * Accessible, responsive searchable dropdown / combobox component.
 * Allows users to search and select a provider / electricity board from a list,
 * with real-time filtering, keyboard navigation, and custom "Other" support.
 *
 * @param {object} props
 * @param {string} props.id - HTML element ID
 * @param {string} props.label - User-facing field label
 * @param {string} props.placeholder - Dropdown search placeholder
 * @param {string[]} props.options - Array of provider options
 * @param {string} props.value - Currently selected value
 * @param {Function} props.onChange - (selectedValue) => void
 * @param {string} [props.error] - Validation error message
 * @param {boolean} [props.disabled=false] - Whether the combobox is disabled
 * @param {boolean} [props.required=true] - Whether the field is required
 */
export default function SearchableProviderSelect({
  id,
  label,
  placeholder = 'Search or select provider...',
  options = [],
  value = '',
  onChange,
  error = '',
  disabled = false,
  required = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxRef = useRef(null);
  const autoId = useId();
  const fieldId = id || `rt-provider-select-${autoId}`;

  // Filter options based on user search query (case-insensitive)
  const filteredOptions = options.filter((opt) =>
    String(opt).toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(-1);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Handle option selection
  function handleSelect(option) {
    onChange(option);
    setIsOpen(false);
    setSearchQuery('');
  }

  // Keyboard navigation within the dropdown
  function handleKeyDown(e) {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
      scrollItemIntoView(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
      scrollItemIntoView(highlightedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    }
  }

  function scrollItemIntoView(index) {
    if (!listboxRef.current) return;
    const items = listboxRef.current.querySelectorAll('.rt-combobox-option');
    if (items && items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  return (
    <div
      ref={containerRef}
      className={`rt-field rt-combobox-container ${disabled ? 'rt-combobox-disabled' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="rt-label" htmlFor={fieldId}>
          <span>
            {label} {required && <span className="rt-req">*</span>}
          </span>
        </label>
      )}

      {/* Combobox Trigger Button */}
      <button
        id={fieldId}
        type="button"
        className={`rt-combobox-trigger ${value ? 'has-value' : 'is-empty'} ${error ? 'rt-input-error' : ''} ${isOpen ? 'is-active' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={label ? `${fieldId}-label` : undefined}
      >
        <span className="rt-combobox-value-text">
          {value ? (
            <span className="rt-combobox-selected-val">{value}</span>
          ) : (
            <span className="rt-combobox-placeholder">
              {placeholder}
            </span>
          )}
        </span>

        <span className="rt-combobox-chevron">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div className="rt-combobox-dropdown" role="dialog" aria-modal="false">
          {/* Search Input Bar */}
          <div className="rt-combobox-search-wrap">
            <svg
              className="rt-combobox-search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              ref={searchInputRef}
              type="text"
              className="rt-combobox-search-input"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label="Search options"
            />

            {searchQuery && (
              <button
                type="button"
                className="rt-combobox-search-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                  if (searchInputRef.current) searchInputRef.current.focus();
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Options Listbox */}
          <div
            ref={listboxRef}
            className="rt-combobox-list"
            role="listbox"
            tabIndex={-1}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => {
                const isSelected = value === option;
                const isHighlighted = highlightedIndex === idx;
                const isOther = option === 'Other';

                return (
                  <div
                    key={option}
                    role="option"
                    aria-selected={isSelected}
                    className={`rt-combobox-option ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${isOther ? 'is-other-option' : ''}`}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <span className="rt-combobox-option-label">
                      {isOther ? <strong>✍ Other (Specify below)</strong> : option}
                    </span>

                    {isSelected && (
                      <svg
                        className="rt-combobox-check"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rt-combobox-empty">
                <p>No providers found matching &ldquo;{searchQuery}&rdquo;</p>
                <button
                  type="button"
                  className="rt-combobox-select-other-btn"
                  onClick={() => handleSelect('Other')}
                >
                  Select &ldquo;Other&rdquo; to enter name manually
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <span className="rt-field-err-text">{error}</span>}
    </div>
  );
}
