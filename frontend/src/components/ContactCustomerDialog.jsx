import { useState } from 'react';
import { sendMobileNotification } from '../api/notificationApi.js';

export default function ContactCustomerDialog({ contact, onClose, title }) {
  if (!contact) return null;

  const [showPushForm, setShowPushForm] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [sendingPush, setSendingPush] = useState(false);
  const [pushSuccess, setPushSuccess] = useState('');
  const [pushError, setPushError] = useState('');

  const rawPhone = String(contact.phone || '').trim();
  const rawEmail = String(contact.email || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  const displayPhone =
    digits.length === 10
      ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
      : rawPhone || '—';

  // Format WhatsApp URL: default 10-digit numbers with India 91 prefix
  const waNumber = digits.length === 10 ? `91${digits}` : digits;
  const waUrl = `https://wa.me/${waNumber}`;
  const telUrl = `tel:${digits}`;
  const mailtoUrl = `mailto:${rawEmail}`;

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

  const isEmployee = Boolean(contact.isEmployee || contact.role === 'employee');
  const contactName = contact.name || (isEmployee ? 'Employee' : 'Client');

  const dialogHeading =
    title ||
    contact.title ||
    (isEmployee ? 'Contact Employee' : 'Contact Client');

  async function handleSendPushNotification(e) {
    if (e) e.preventDefault();
    const trimmed = pushMessage.trim();
    if (!trimmed) {
      setPushError('Please enter a notification message.');
      return;
    }

    setSendingPush(true);
    setPushError('');
    setPushSuccess('');

    try {
      await sendMobileNotification({
        target: isEmployee ? 'Employees' : 'Clients',
        targetId: contact.id || null,
        targetName: contactName,
        title: pushTitle.trim() || `Message for ${contactName}`,
        message: trimmed,
        priority: 'Normal',
      });

      setPushSuccess(`Push notification dispatched to ${contactName}!`);
      setPushMessage('');
      setPushTitle('');

      window.dispatchEvent(new CustomEvent('notifications-updated'));
      localStorage.setItem('ri_desk_notif_sync', Date.now().toString());

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err) {
      console.error('Failed to send mobile push:', err);
      setPushError(err.message || 'Failed to dispatch mobile notification.');
    } finally {
      setSendingPush(false);
    }
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
            <h2 id="contact-dialog-title">{dialogHeading}</h2>
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
              {contact.name || (contact.isEmployee ? 'Employee' : 'Client')}
            </span>
            {contact.designation && (
              <span
                style={{
                  fontSize: 12,
                  color: '#4f46e5',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 1,
                  marginBottom: 2,
                }}
              >
                <span>💼</span>
                {contact.designation}
              </span>
            )}
            <span className="contact-dialog-number">{displayPhone}</span>
            {rawEmail && (
              <span
                style={{
                  fontSize: 12,
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <span>✉️</span>
                {rawEmail}
              </span>
            )}
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

          {/* Option 3: Send Email */}
          {rawEmail && (
            <a
              href={mailtoUrl}
              className="contact-dialog-btn email"
              onClick={onClose}
            >
              <div className="contact-dialog-btn-icon email">
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
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <div className="contact-dialog-btn-text">
                <span className="contact-dialog-btn-title">Send Email</span>
                <span className="contact-dialog-btn-desc">{rawEmail}</span>
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
          )}

          {/* Option 4: Mobile Push Notification */}
          <button
            type="button"
            className={`contact-dialog-btn push ${showPushForm ? 'active' : ''}`}
            onClick={() => {
              setShowPushForm((prev) => !prev);
              setPushError('');
              setPushSuccess('');
            }}
          >
            <div className="contact-dialog-btn-icon push">
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
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <div className="contact-dialog-btn-text" style={{ textAlign: 'left', flex: 1 }}>
              <span className="contact-dialog-btn-title">Send Mobile Notification</span>
              <span className="contact-dialog-btn-desc">Dispatch real-time mobile push alert</span>
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
              style={{ transform: showPushForm ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Inline Push Notification Form */}
          {showPushForm && (
            <div style={{
              background: '#f5f3ff',
              border: '1.5px solid #ddd6fe',
              borderRadius: '10px',
              padding: '12px',
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#6d28d9' }}>
                  Quick Push to {contactName}
                </span>
                <span style={{ fontSize: '10.5px', background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  {isEmployee ? 'EMPLOYEE' : 'CLIENT'}
                </span>
              </div>

              {pushError && (
                <div style={{ fontSize: '12px', color: '#dc2626', background: '#fee2e2', padding: '4px 8px', borderRadius: '4px' }}>
                  {pushError}
                </div>
              )}

              {pushSuccess && (
                <div style={{ fontSize: '12px', color: '#16a34a', background: '#dcfce7', padding: '4px 8px', borderRadius: '4px' }}>
                  ✓ {pushSuccess}
                </div>
              )}

              <input
                type="text"
                placeholder="Title (optional, e.g. Important Notice)"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd',
                  fontSize: '12.5px',
                  boxSizing: 'border-box',
                }}
              />

              <textarea
                rows={2}
                placeholder="Type notification message here..."
                value={pushMessage}
                onChange={(e) => setPushMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #c4b5fd',
                  fontSize: '12.5px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={() => setShowPushForm(false)}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendPushNotification}
                  disabled={sendingPush}
                  style={{
                    background: '#7c3aed',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: sendingPush ? 'not-allowed' : 'pointer',
                    opacity: sendingPush ? 0.7 : 1,
                  }}
                >
                  {sendingPush ? 'Sending...' : 'Send Push Alert'}
                </button>
              </div>
            </div>
          )}
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

