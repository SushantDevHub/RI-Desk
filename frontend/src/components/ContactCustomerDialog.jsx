export default function ContactCustomerDialog({ contact, onClose }) {
  if (!contact) return null;

  const rawPhone = String(contact.phone || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  const displayPhone =
    digits.length === 10
      ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
      : rawPhone || '—';

  // Format WhatsApp URL: default 10-digit numbers with India 91 prefix
  const waNumber = digits.length === 10 ? `91${digits}` : digits;
  const waUrl = `https://wa.me/${waNumber}`;
  const telUrl = `tel:${digits}`;

  function getInitials(name = '') {
    return (
      name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'C'
    );
  }

  return (
    <div
      className="contact-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="contact-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-dialog-title"
      >
        <div className="contact-dialog-header">
          <div className="contact-dialog-header-info">
            <h2 id="contact-dialog-title">Contact Customer</h2>
            <p>Choose your preferred communication method</p>
          </div>
          <button
            type="button"
            className="contact-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="contact-dialog-profile">
          <div className="contact-dialog-avatar">
            {getInitials(contact.name)}
          </div>
          <div className="contact-dialog-details">
            <span className="contact-dialog-name">
              {contact.name || 'Customer'}
            </span>
            <span className="contact-dialog-number">{displayPhone}</span>
          </div>
        </div>

        <div className="contact-dialog-options">
          {/* Option 1: Direct Call */}
          <a
            href={telUrl}
            className="contact-dialog-btn call"
            onClick={onClose}
          >
            <div className="contact-dialog-btn-icon call">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="contact-dialog-btn-text">
              <span className="contact-dialog-btn-title">Phone Call</span>
              <span className="contact-dialog-btn-desc">Dial {displayPhone} directly</span>
            </div>
            <svg
              className="contact-dialog-btn-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>

          {/* Option 2: WhatsApp Chat */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-dialog-btn whatsapp"
            onClick={onClose}
          >
            <div className="contact-dialog-btn-icon whatsapp">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <div className="contact-dialog-btn-text">
              <span className="contact-dialog-btn-title">WhatsApp Chat</span>
              <span className="contact-dialog-btn-desc">Open chat on WhatsApp Web / App</span>
            </div>
            <svg
              className="contact-dialog-btn-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </div>

        <div className="contact-dialog-footer">
          <button
            type="button"
            className="contact-dialog-cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

