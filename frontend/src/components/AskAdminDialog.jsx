import { useState, useEffect } from 'react';
import { getToken } from '../api/authApi.js';
import { API_BASE } from '../config/api.js';
import './AskAdminDialog.css';

const API = API_BASE;

export default function AskAdminDialog({ ticket, currentUser, onClose }) {
  if (!ticket) return null;

  const [admin, setAdmin] = useState({
    name: 'Admin User',
    email: 'admin@ridesk.com',
    mobileNumber: '9876543210',
  });
  const [employeeDoubt, setEmployeeDoubt] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  // Fetch admin contact details from API
  useEffect(() => {
    let isMounted = true;
    async function loadAdminContact() {
      try {
        const token = getToken();
        if (!token) return;
        const res = await fetch(`${API}/tickets/admin-contact`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.admin && isMounted) {
            setAdmin(data.admin);
          }
        }
      } catch (err) {
        console.error('Failed to fetch admin contact:', err);
      } finally {
        if (isMounted) setLoadingAdmin(false);
      }
    }

    loadAdminContact();
    return () => {
      isMounted = false;
    };
  }, []);

  let employeeName = currentUser?.name;
  if (!employeeName) {
    try {
      const token = getToken();
      if (token) {
        const payload = token.split('.')[1];
        if (payload) {
          const decoded = JSON.parse(
            atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
          );
          employeeName = decoded.name;
        }
      }
    } catch {}
  }
  if (!employeeName) employeeName = 'Employee';

  const clientName = ticket.client || ticket.customer || 'Client';
  const clientMobile = ticket.clientMobile || ticket.customerMobile || ticket.mobileNumber || '';
  const clientEmail = ticket.clientEmail || ticket.customerEmail || ticket.email || '';

  // Generate plain-text message for WhatsApp & Copy
  function buildMessageText() {
    const lines = [
      `*RI-Desk Support: Query on Ticket #${ticket.id}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*To:* ${admin.name || 'Admin'}`,
      ``,
      `*Employee Question / Doubt:*`,
      employeeDoubt.trim()
        ? `"${employeeDoubt.trim()}"`
        : `[Employee ${employeeName} has a query regarding this ticket and needs assistance.]`,
      ``,
      `*Ticket Details:*`,
      `• *ID:* #${ticket.id}`,
      `• *Category:* ${ticket.category ? ticket.category.toUpperCase() : 'RECHARGE'}`,
      `• *Priority:* ${ticket.priority ? ticket.priority.toUpperCase() : 'MEDIUM'}`,
      `• *Status:* ${ticket.status ? ticket.status.toUpperCase() : 'OPEN'}`,
      `• *Currently Assigned:* ${ticket.assignedTo || 'Unassigned'}`,
    ];

    if (ticket.transferNotes) {
      lines.push(`• *Work Left / Notes:* ${ticket.transferNotes}`);
    }

    lines.push(
      ``,
      `*Client Profile:*`,
      `• *Name / Company:* ${clientName}`
    );

    if (clientMobile) {
      lines.push(`• *Mobile:* ${clientMobile}`);
    }
    if (clientEmail) {
      lines.push(`• *Email:* ${clientEmail}`);
    }

    lines.push(
      ``,
      `*Ticket Description:*`,
      `"${ticket.description || '—'}"`,
      ``,
      `_Sent by: ${employeeName} via RI-Desk_`
    );

    return lines.join('\n');
  }

  // Handle WhatsApp action
  function handleSendWhatsApp() {
    const rawDigits = String(admin.mobileNumber || '').replace(/\D/g, '');
    const waNumber = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
    if (!waNumber) {
      alert('No valid mobile number available for Admin.');
      return;
    }
    const message = buildMessageText();
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  // Handle Email action
  function handleSendEmail() {
    if (!admin.email) {
      alert('No valid email address available for Admin.');
      return;
    }
    const emailSubject = `[RI-Desk Support Query] Ticket #${ticket.id}${
      ticket.category ? ` (${ticket.category.toUpperCase()})` : ''
    }`;
    const emailBody = [
      `Hi ${admin.name || 'Admin'},`,
      ``,
      `I have a question / query regarding Ticket #${ticket.id} and would appreciate your guidance.`,
      ``,
      `MY QUERY / DOUBT:`,
      `----------------------------------------`,
      employeeDoubt.trim() ? employeeDoubt.trim() : `(Please advise on the next steps for this ticket.)`,
      ``,
      `TICKET DETAILS:`,
      `----------------------------------------`,
      `Ticket ID: #${ticket.id}`,
      `Category: ${ticket.category || 'recharge'}`,
      `Priority: ${ticket.priority || 'medium'}`,
      `Status: ${ticket.status || 'open'}`,
      `Currently Assigned: ${ticket.assignedTo || 'Unassigned'}`,
      ticket.transferNotes ? `Work Left: ${ticket.transferNotes}\n` : '',
      `Description:`,
      `${ticket.description || '—'}`,
      ``,
      `CLIENT PROFILE:`,
      `----------------------------------------`,
      `Client / Company: ${clientName}`,
      clientMobile ? `Mobile: ${clientMobile}` : '',
      clientEmail ? `Email: ${clientEmail}` : '',
      ``,
      `Thank you,`,
      `${employeeName}`,
      `RI-Desk Support Team`,
    ]
      .filter((l) => l !== '')
      .join('\n');

    const mailtoUrl = `mailto:${admin.email}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoUrl;
  }

  return (
    <div className="ask-admin-dialog-overlay" onClick={onClose}>
      <section
        className="ask-admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-admin-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ask-admin-dialog-header">
          <div className="ask-admin-header-left">
            <div className="ask-admin-header-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth={2.5} />
              </svg>
            </div>
            <div>
              <h2 id="ask-admin-dialog-title" className="ask-admin-title">
                Ask Admin For Help ?
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="ask-admin-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {/* Dialog Body */}
        <div className="ask-admin-body">
          {/* Ticket & Client Summary Card */}
          <div className="ask-admin-summary-card">
            <div className="ask-admin-summary-header">
              <span className="ask-admin-ticket-id">#{ticket.id}</span>
              <span className="ask-admin-badge status">{ticket.status || 'open'}</span>
              <span className={`ask-admin-badge priority-${ticket.priority || 'medium'}`}>
                {ticket.priority || 'medium'}
              </span>
              {ticket.category && (
                <span className="ask-admin-badge category">
                  {ticket.category.toUpperCase()}
                </span>
              )}
            </div>

            <div className="ask-admin-client-box">
              <div className="ask-admin-client-row">
                <span className="ask-admin-lbl">Client:</span>
                <strong>{clientName}</strong>
              </div>
              {clientMobile && (
                <div className="ask-admin-client-row">
                  <span className="ask-admin-lbl">Contact Mobile:</span>
                  <span>{clientMobile}</span>
                </div>
              )}
              {clientEmail && (
                <div className="ask-admin-client-row">
                  <span className="ask-admin-lbl">Email Address:</span>
                  <span>{clientEmail}</span>
                </div>
              )}
            </div>

            {ticket.description && (
              <div className="ask-admin-desc-box">
                <span className="ask-admin-desc-lbl">Description:</span>
                <span className="ask-admin-desc-val">{ticket.description}</span>
              </div>
            )}

            {ticket.transferNotes && (
              <div className="ask-admin-work-left-box">
                <span className="ask-admin-notes-lbl">Work Left:</span>
                <span className="ask-admin-notes-val">{ticket.transferNotes}</span>
              </div>
            )}
          </div>

          {/* Description / Query Box */}
          <div className="ask-admin-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="ask-admin-doubt-input" className="ask-admin-field-label">
                Query for Admin <span className="opt">(optional)</span>
              </label>
              <span style={{ fontSize: '11px', color: employeeDoubt.length >= 250 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                {employeeDoubt.length}/250
              </span>
            </div>
            <textarea
              id="ask-admin-doubt-input"
              className="ask-admin-textarea"
              rows={3}
              maxLength={250}
              placeholder="Describe your query or doubt here (max 250 characters)..."
              value={employeeDoubt}
              onChange={(e) => setEmployeeDoubt(e.target.value.slice(0, 250))}
            />
          </div>

          {/* Two small buttons just below the description box */}
          <div className="ask-admin-action-buttons">
            <button
              type="button"
              className="ask-admin-action-btn btn-wa"
              onClick={handleSendWhatsApp}
              title={`Open WhatsApp chat with Admin (${admin.mobileNumber || ''})`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              className="ask-admin-action-btn btn-email"
              onClick={handleSendEmail}
              title={`Send Email to Admin (${admin.email || ''})`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span>Email</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="ask-admin-footer">
          <button
            type="button"
            className="ask-admin-close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
