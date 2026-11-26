import { useState, useRef } from 'react';
import {
  CATEGORIES,
  OPERATORS,
  DESCRIPTION_MAX_LENGTH,
  isTransactionCategory,
  INITIAL_FORM_VALUES,
} from './fieldConfig.js';
import { submitRaiseTicket } from './raiseTicketApi.js';
import './raise-ticket.css';

/**
 * Reusable Raise Ticket Form component for Clients.
 * Standalone public form without user/retailer distinction.
 *
 * @param {object} props
 * @param {Function} [props.onSuccess] - Optional callback invoked with the created ticket data.
 * @param {boolean} [props.showHeader=true] - Whether to render the brand header and title inside the card.
 */
export default function RaiseTicketForm({ onSuccess, showHeader = true }) {
  const [formData, setFormData] = useState({ ...INITIAL_FORM_VALUES });
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);

  // Check if current category requires transaction fields
  const showTxnFields = isTransactionCategory(formData.category);

  // Field change handler
  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear specific field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    if (generalError) {
      setGeneralError('');
    }
  }

  // Description input handler enforcing max character limit
  function handleDescriptionChange(e) {
    const val = e.target.value;
    if (val.length <= DESCRIPTION_MAX_LENGTH) {
      setFormData((prev) => ({ ...prev, description: val }));
      if (fieldErrors.description) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.description;
          return next;
        });
      }
    }
  }

  // Screenshot upload handler
  function handleScreenshotChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setFieldErrors((prev) => ({
        ...prev,
        screenshot: 'Only image files (PNG, JPG, JPEG, WEBP) are allowed.',
      }));
      return;
    }

    // Validate size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFieldErrors((prev) => ({
        ...prev,
        screenshot: 'Image file size must be less than 5MB.',
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setFormData((prev) => ({
        ...prev,
        screenshot: uploadEvent.target.result,
        screenshotName: file.name,
        screenshotSize: (file.size / 1024).toFixed(1) + ' KB',
      }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.screenshot;
        return next;
      });
    };
    reader.onerror = () => {
      setFieldErrors((prev) => ({
        ...prev,
        screenshot: 'Failed to read image file. Please try another.',
      }));
    };
    reader.readAsDataURL(file);
  }

  // Remove screenshot
  function handleRemoveScreenshot() {
    setFormData((prev) => ({
      ...prev,
      screenshot: null,
      screenshotName: null,
      screenshotSize: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Client-side validation before hitting API
  function validateForm() {
    const errors = {};

    if (!formData.name || formData.name.trim().length < 2) {
      errors.name = 'Please enter your client or company name (minimum 2 characters).';
    }

    const cleanMobile = formData.mobileNumber.replace(/\D/g, '');
    if (!cleanMobile) {
      errors.mobileNumber = 'Client mobile number is required.';
    } else if (cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
      errors.mobileNumber = 'Enter a valid 10-digit mobile number (e.g. 9876543210).';
    }

    if (!formData.category) {
      errors.category = 'Please select a category.';
    }

    if (!formData.subject || formData.subject.trim().length < 3) {
      errors.subject = 'Subject is required (minimum 3 characters).';
    }

    if (!formData.description || formData.description.trim().length < 5) {
      errors.description = 'Please provide a detailed description (minimum 5 characters).';
    } else if (formData.description.length > DESCRIPTION_MAX_LENGTH) {
      errors.description = `Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters.`;
    }

    // Conditional transaction validation
    if (showTxnFields) {
      if (!formData.transactionId || formData.transactionId.trim().length === 0) {
        errors.transactionId = 'Transaction ID / UTR is required for this category.';
      }
      if (
        formData.amount === undefined ||
        formData.amount === null ||
        formData.amount === '' ||
        Number(formData.amount) <= 0
      ) {
        errors.amount = 'Please enter a valid transaction amount greater than ₹0.';
      }
      if (!formData.operator) {
        errors.operator = 'Please select operator/service.';
      }
    }

    return errors;
  }

  // Form submit handler
  async function handleSubmit(e) {
    e.preventDefault();
    setGeneralError('');

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setGeneralError('Please fix the highlighted errors before submitting.');
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      // Prepare payload (strictly for clients)
      const payload = {
        name: formData.name.trim(),
        mobileNumber: formData.mobileNumber.replace(/\D/g, ''),
        userType: 'client',
        category: formData.category,
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        screenshot: formData.screenshot || null,
      };

      if (showTxnFields) {
        payload.transactionId = formData.transactionId.trim();
        payload.amount = Number(formData.amount);
        payload.operator = formData.operator;
      }

      const response = await submitRaiseTicket(payload);

      const ticketResult = {
        ticketId: response.ticketId,
        ...response.ticket,
        ...formData,
      };

      setSubmittedTicket(ticketResult);

      try {
        window.dispatchEvent(
          new CustomEvent('tickets-updated', { detail: response.ticket || ticketResult })
        );
        localStorage.setItem('tickets_last_sync', String(Date.now()));
      } catch (e) {}

      if (typeof onSuccess === 'function') {
        onSuccess(ticketResult);
      }
    } catch (err) {
      console.error('Raise Ticket Error:', err);
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      setGeneralError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Copy Ticket ID helper
  function handleCopyTicketId() {
    if (!submittedTicket?.ticketId) return;
    navigator.clipboard.writeText(submittedTicket.ticketId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Reset form to raise another ticket
  function handleReset() {
    setFormData({ ...INITIAL_FORM_VALUES });
    setFieldErrors({});
    setGeneralError('');
    setSubmittedTicket(null);
    setCopied(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUCCESS SCREEN
  // ─────────────────────────────────────────────────────────────
  if (submittedTicket) {
    const isTxn = isTransactionCategory(submittedTicket.category);

    return (
      <div className="rt-success-card">
        <div className="rt-success-icon-wrap" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <h2 className="rt-success-title">Ticket Raised Successfully!</h2>
        <p className="rt-success-sub">
          Your support ticket has been registered in our system. Our support team will review your request and get back to you shortly.
        </p>

        <div className="rt-ticket-id-badge-wrap">
          <span className="rt-ticket-id-label">Ticket ID:</span>
          <span className="rt-ticket-id-val">#{submittedTicket.ticketId}</span>
          <button
            type="button"
            className="rt-copy-btn"
            onClick={handleCopyTicketId}
            title="Copy Ticket ID"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>

        {/* Summary Details */}
        <div className="rt-summary-box">
          <div className="rt-summary-row">
            <span className="rt-summary-label">Client Name</span>
            <span className="rt-summary-val">{submittedTicket.name}</span>
          </div>
          <div className="rt-summary-row">
            <span className="rt-summary-label">Client Mobile</span>
            <span className="rt-summary-val">{submittedTicket.mobileNumber}</span>
          </div>
          <div className="rt-summary-row">
            <span className="rt-summary-label">Category</span>
            <span className="rt-summary-val">{submittedTicket.category}</span>
          </div>
          <div className="rt-summary-row">
            <span className="rt-summary-label">Subject</span>
            <span className="rt-summary-val">{submittedTicket.subject}</span>
          </div>

          {isTxn && submittedTicket.transactionId && (
            <div className="rt-summary-row">
              <span className="rt-summary-label">Transaction ID / UTR</span>
              <span className="rt-summary-val">{submittedTicket.transactionId}</span>
            </div>
          )}

          {isTxn && submittedTicket.amount && (
            <div className="rt-summary-row">
              <span className="rt-summary-label">Amount</span>
              <span className="rt-summary-val">₹{Number(submittedTicket.amount).toLocaleString('en-IN')}</span>
            </div>
          )}

          {isTxn && submittedTicket.operator && (
            <div className="rt-summary-row">
              <span className="rt-summary-label">Operator / Service</span>
              <span className="rt-summary-val">{submittedTicket.operator}</span>
            </div>
          )}

          <div className="rt-summary-row">
            <span className="rt-summary-label">Default Priority</span>
            <span className="rt-summary-val" style={{ textTransform: 'capitalize', color: '#2563eb' }}>
              {submittedTicket.priority || 'Medium'}
            </span>
          </div>

          <div className="rt-summary-row">
            <span className="rt-summary-label">Initial Status</span>
            <span className="rt-summary-val" style={{ textTransform: 'capitalize', color: '#16a34a' }}>
              {submittedTicket.status || 'Open'}
            </span>
          </div>
        </div>

        <div className="rt-success-actions">
          <button
            type="button"
            className="rt-btn-primary"
            onClick={handleReset}
          >
            Raise Another Ticket
          </button>
          <a href="/login" className="rt-btn-secondary">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FORM VIEW
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="rt-form-container">
      {showHeader && (
        <div className="rt-header">
          <img
            src="/rambhiya-logo.png"
            alt="Rambhiya Infotech Logo"
            className="rt-brand-logo"
            onError={(e) => {
              // Fallback to /img.jpg if rambhiya-logo.png fails
              e.currentTarget.src = '/img.jpg';
            }}
          />
          <h1 className="rt-title">Raise Support Ticket</h1>
          <p className="rt-subtitle">
            Need help? Fill in your details below and our technical support team will assist you.
          </p>
        </div>
      )}

      {generalError && (
        <div className="rt-alert rt-alert-error" role="alert">
          <div className="rt-alert-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>{generalError}</div>
        </div>
      )}

      <form className="rt-form" onSubmit={handleSubmit} noValidate>
        {/* Client Name and Mobile Number */}
        <div className="rt-form-grid">
          <div className="rt-field">
            <label className="rt-label" htmlFor="rt-name">
              <span>Client Name <span className="rt-req">*</span></span>
            </label>
            <input
              id="rt-name"
              name="name"
              type="text"
              className={`rt-input ${fieldErrors.name ? 'rt-input-error' : ''}`}
              placeholder="e.g. Acme Infotech / Rahul Sharma"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              autoComplete="name"
            />
            {fieldErrors.name && (
              <span className="rt-field-err-text">{fieldErrors.name}</span>
            )}
          </div>

          <div className="rt-field">
            <label className="rt-label" htmlFor="rt-mobile">
              <span>Client Mobile Number <span className="rt-req">*</span></span>
            </label>
            <input
              id="rt-mobile"
              name="mobileNumber"
              type="tel"
              maxLength={10}
              className={`rt-input ${fieldErrors.mobileNumber ? 'rt-input-error' : ''}`}
              placeholder="10-digit mobile number"
              value={formData.mobileNumber}
              onChange={handleChange}
              disabled={loading}
              autoComplete="tel"
            />
            {fieldErrors.mobileNumber && (
              <span className="rt-field-err-text">{fieldErrors.mobileNumber}</span>
            )}
          </div>
        </div>

        {/* Issue Category */}
        <div className="rt-field">
          <label className="rt-label" htmlFor="rt-category">
            <span>Issue Category <span className="rt-req">*</span></span>
          </label>
          <select
            id="rt-category"
            name="category"
            className={`rt-select ${fieldErrors.category ? 'rt-input-error' : ''}`}
            value={formData.category}
            onChange={handleChange}
            disabled={loading}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {fieldErrors.category && (
            <span className="rt-field-err-text">{fieldErrors.category}</span>
          )}
        </div>

        {/* Conditional Transaction Details Box */}
        {showTxnFields && (
          <div className="rt-txn-box">
            <div className="rt-txn-box-header">
              <svg className="rt-txn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
              <span>Transaction & Payment Details</span>
            </div>

            <div className="rt-form-grid">
              <div className="rt-field">
                <label className="rt-label" htmlFor="rt-transactionId">
                  <span>Txn ID / UTR <span className="rt-req">*</span></span>
                </label>
                <input
                  id="rt-transactionId"
                  name="transactionId"
                  type="text"
                  className={`rt-input ${fieldErrors.transactionId ? 'rt-input-error' : ''}`}
                  placeholder="e.g. TXN9876543210"
                  value={formData.transactionId}
                  onChange={handleChange}
                  disabled={loading}
                />
                {fieldErrors.transactionId && (
                  <span className="rt-field-err-text">{fieldErrors.transactionId}</span>
                )}
              </div>

              <div className="rt-field">
                <label className="rt-label" htmlFor="rt-amount">
                  <span>Amount (₹) <span className="rt-req">*</span></span>
                </label>
                <input
                  id="rt-amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  className={`rt-input ${fieldErrors.amount ? 'rt-input-error' : ''}`}
                  placeholder="e.g. 500"
                  value={formData.amount}
                  onChange={handleChange}
                  disabled={loading}
                />
                {fieldErrors.amount && (
                  <span className="rt-field-err-text">{fieldErrors.amount}</span>
                )}
              </div>

              <div className="rt-field rt-field-full">
                <label className="rt-label" htmlFor="rt-operator">
                  <span>Operator / Gateway <span className="rt-req">*</span></span>
                </label>
                <select
                  id="rt-operator"
                  name="operator"
                  className={`rt-select ${fieldErrors.operator ? 'rt-input-error' : ''}`}
                  value={formData.operator}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                {fieldErrors.operator && (
                  <span className="rt-field-err-text">{fieldErrors.operator}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subject */}
        <div className="rt-field">
          <label className="rt-label" htmlFor="rt-subject">
            <span>Subject <span className="rt-req">*</span></span>
          </label>
          <input
            id="rt-subject"
            name="subject"
            type="text"
            className={`rt-input ${fieldErrors.subject ? 'rt-input-error' : ''}`}
            placeholder="Brief summary of your query"
            value={formData.subject}
            onChange={handleChange}
            disabled={loading}
          />
          {fieldErrors.subject && (
            <span className="rt-field-err-text">{fieldErrors.subject}</span>
          )}
        </div>

        {/* Description with 250 character limit and no resize drager */}
        <div className="rt-field">
          <div className="rt-label">
            <span>Description <span className="rt-req">*</span></span>
            <span
              className={`rt-char-count ${
                formData.description.length >= DESCRIPTION_MAX_LENGTH
                  ? 'rt-limit-max'
                  : formData.description.length >= DESCRIPTION_MAX_LENGTH - 30
                  ? 'rt-limit-near'
                  : ''
              }`}
            >
              {formData.description.length} / {DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="rt-description"
            name="description"
            className={`rt-textarea ${fieldErrors.description ? 'rt-input-error' : ''}`}
            placeholder="Please explain your issue clearly (max 250 characters)..."
            value={formData.description}
            onChange={handleDescriptionChange}
            maxLength={DESCRIPTION_MAX_LENGTH}
            disabled={loading}
            rows={3}
            style={{ resize: 'none' }}
          />
          {fieldErrors.description && (
            <span className="rt-field-err-text">{fieldErrors.description}</span>
          )}
        </div>

        {/* Screenshot Upload (Optional) */}
        <div className="rt-field">
          <label className="rt-label">
            <span>Attach Screenshot (Optional)</span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>Max 5MB</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleScreenshotChange}
            disabled={loading}
          />

          {!formData.screenshot ? (
            <div className="rt-file-wrap">
              <button
                type="button"
                className="rt-file-custom-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Choose Screenshot
              </button>
              <span className="rt-file-hint">JPG, PNG, WEBP up to 5MB</span>
            </div>
          ) : (
            <div className="rt-preview-container">
              <img
                src={formData.screenshot}
                alt="Upload preview"
                className="rt-preview-thumb"
              />
              <div className="rt-preview-info">
                <div className="rt-preview-name">{formData.screenshotName || 'Screenshot attached'}</div>
                <div className="rt-preview-size">{formData.screenshotSize || ''}</div>
              </div>
              <button
                type="button"
                className="rt-preview-remove"
                onClick={handleRemoveScreenshot}
                disabled={loading}
                title="Remove attachment"
              >
                Remove
              </button>
            </div>
          )}

          {fieldErrors.screenshot && (
            <span className="rt-field-err-text">{fieldErrors.screenshot}</span>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="rt-submit-btn"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="rt-spinner" aria-hidden="true" />
              <span>Submitting Ticket...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span>Submit Support Ticket</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
