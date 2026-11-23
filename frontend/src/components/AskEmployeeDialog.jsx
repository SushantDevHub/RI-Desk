import { useState, useEffect } from 'react';
import { getToken } from '../api/authApi.js';
import { sendMobileNotification } from '../api/notificationApi.js';
import './AskEmployeeDialog.css';

const API = 'http://localhost:4000/api';

function formatPhone(digits = '') {
  const clean = String(digits).replace(/\D/g, '');
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return clean || '—';
}

function getInitials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'EM'
  );
}

export default function AskEmployeeDialog({
  ticket,
  employees: initialEmployees = [],
  currentUser,
  onClose,
}) {
  if (!ticket) return null;

  const [employeesList, setEmployeesList] = useState(initialEmployees);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [adminQuery, setAdminQuery] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [sendingPush, setSendingPush] = useState(false);
  const [pushSentSuccess, setPushSentSuccess] = useState(false);

  // Fetch employees if initial list is empty
  useEffect(() => {
    let isMounted = true;
    async function loadEmployees() {
      if (initialEmployees && initialEmployees.length > 0) {
        setEmployeesList(initialEmployees);
        return;
      }
      try {
        setLoadingEmployees(true);
        const token = getToken();
        if (!token) return;
        const res = await fetch(`${API}/tickets/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.employees) && isMounted) {
            setEmployeesList(data.employees);
          }
        }
      } catch (err) {
        console.error('Failed to load employees for AskEmployeeDialog:', err);
      } finally {
        if (isMounted) setLoadingEmployees(false);
      }
    }

    loadEmployees();
    return () => {
      isMounted = false;
    };
  }, [initialEmployees]);

  // Set default selected employee based on ticket assignment or first employee
  useEffect(() => {
    if (!employeesList || employeesList.length === 0) return;

    if (selectedEmployeeId) {
      // If already selected, ensure it exists in the list
      const exists = employeesList.some(
        (e) => String(e.id) === String(selectedEmployeeId)
      );
      if (exists) return;
    }

    // Try to match ticket's currently assigned employee
    if (ticket.assignedToId) {
      const matched = employeesList.find(
        (e) => String(e.id) === String(ticket.assignedToId)
      );
      if (matched) {
        setSelectedEmployeeId(String(matched.id));
        return;
      }
    }

    if (ticket.assignedTo && String(ticket.assignedTo).toLowerCase() !== 'unassigned') {
      const matched = employeesList.find(
        (e) => String(e.name).trim().toLowerCase() === String(ticket.assignedTo).trim().toLowerCase()
      );
      if (matched) {
        setSelectedEmployeeId(String(matched.id));
        return;
      }
    }

    // Default to first active employee or first employee
    const activeFirst = employeesList.find((e) => e.status !== 'inactive') || employeesList[0];
    if (activeFirst) {
      setSelectedEmployeeId(String(activeFirst.id));
    }
  }, [employeesList, ticket, selectedEmployeeId]);

  // Find currently selected employee object
  const selectedEmployee =
    employeesList.find((e) => String(e.id) === String(selectedEmployeeId)) ||
    employeesList[0] ||
    null;

  // Resolve admin name
  let adminName = currentUser?.name;
  if (!adminName) {
    try {
      const token = getToken();
      if (token) {
        const payload = token.split('.')[1];
        if (payload) {
          const decoded = JSON.parse(
            atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
          );
          adminName = decoded.name;
        }
      }
    } catch {}
  }
  if (!adminName) adminName = 'Admin User';

  const clientName = ticket.client || ticket.customer || 'Client';
  const clientMobile = ticket.clientMobile || ticket.customerMobile || ticket.mobileNumber || '';
  const clientEmail = ticket.clientEmail || ticket.customerEmail || ticket.email || '';

  const employeeName = selectedEmployee?.name || 'Employee';
  const employeeMobile = selectedEmployee?.mobileNumber || '';
  const employeeEmail = selectedEmployee?.email || '';

  // Generate plain-text message for WhatsApp & Copy
  function buildMessageText() {
    const lines = [
      `*RI-Desk Support: Instruction on Ticket #${ticket.id}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*To:* ${employeeName}`,
      ``,
      `*Admin Query / Instructions:*`,
      adminQuery.trim()
        ? `"${adminQuery.trim()}"`
        : `[Please review this ticket and take the required action.]`,
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
      `_Sent by: ${adminName} (Admin) via RI-Desk_`
    );

    return lines.join('\n');
  }

  // Handle WhatsApp action
  function handleSendWhatsApp() {
    const rawDigits = String(employeeMobile || '').replace(/\D/g, '');
    const waNumber = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
    if (!waNumber) {
      alert(`No valid mobile number available for ${employeeName}.`);
      return;
    }
    const message = buildMessageText();
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  // Handle Email action
  function handleSendEmail() {
    if (!employeeEmail) {
      alert(`No valid email address available for ${employeeName}.`);
      return;
    }
    const emailSubject = `[RI-Desk Admin Query] Ticket #${ticket.id}${
      ticket.category ? ` (${ticket.category.toUpperCase()})` : ''
    }`;
    const emailBody = [
      `Hi ${employeeName},`,
      ``,
      `ADMIN INSTRUCTION / QUERY:`,
      `----------------------------------------`,
      adminQuery.trim()
        ? adminQuery.trim()
        : `Please review Ticket #${ticket.id} and share an update on the progress.`,
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
      `Regards,`,
      `${adminName}`,
      `RI-Desk Administrator`,
    ]
      .filter((l) => l !== '')
      .join('\n');

    const mailtoUrl = `mailto:${employeeEmail}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoUrl;
  }

  // Handle Mobile Push Notification action
  async function handleSendMobileNotification() {
    if (!selectedEmployee) {
      alert('Please select an employee.');
      return;
    }
    setSendingPush(true);
    setPushSentSuccess(false);
    try {
      const notifMessage = adminQuery.trim()
        ? `[Ticket #${ticket.id}] ${adminQuery.trim()}`
        : `[Ticket #${ticket.id}] Please review this ticket for client ${clientName} and take required action.`;

      await sendMobileNotification({
        target: 'Employees',
        targetId: selectedEmployee.id,
        targetName: selectedEmployee.name,
        title: `Instruction on Ticket #${ticket.id}`,
        message: notifMessage,
        priority: ticket.priority === 'high' ? 'High' : 'Normal',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber || ticket.id,
      });

      setPushSentSuccess(true);
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      localStorage.setItem('ri_desk_notif_sync', Date.now().toString());
      setTimeout(() => setPushSentSuccess(false), 4500);
    } catch (err) {
      console.error('Failed to send mobile push:', err);
      alert(err.message || 'Failed to dispatch mobile notification to employee.');
    } finally {
      setSendingPush(false);
    }
  }

  return (
    <div className="ask-emp-dialog-overlay" onClick={onClose}>
      <section
        className="ask-emp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-emp-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ask-emp-dialog-header">
          <div className="ask-emp-header-left">
            <div className="ask-emp-header-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth={2.5} />
              </svg>
            </div>
            <div>
              <h2 id="ask-emp-dialog-title" className="ask-emp-title">
                Ask Employee / Query
              </h2>
              <p className="ask-emp-subtitle">
                Select an employee to automatically load their mobile and email with full ticket & client details.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ask-emp-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {/* Dialog Body */}
        <div className="ask-emp-body">
          {/* Employee Selector */}
          <div className="ask-emp-field">
            <label htmlFor="ask-emp-select" className="ask-emp-field-label">
              Choose Employee <span className="req">*</span>
            </label>
            <select
              id="ask-emp-select"
              className="ask-emp-select"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={loadingEmployees || employeesList.length === 0}
            >
              {employeesList.length === 0 && (
                <option value="">No employees found</option>
              )}
              {employeesList.map((emp) => {
                const isCurrentlyAssigned =
                  String(emp.id) === String(ticket.assignedToId) ||
                  (ticket.assignedTo &&
                    String(emp.name).trim().toLowerCase() ===
                      String(ticket.assignedTo).trim().toLowerCase());
                return (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.name} {isCurrentlyAssigned ? '★ (Currently Assigned)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Pre-Loaded Employee Profile Card */}
          {selectedEmployee && (
            <div className="ask-emp-recipient-card">
              <div className="ask-emp-avatar">{getInitials(selectedEmployee.name)}</div>
              <div className="ask-emp-recipient-info">
                <div className="ask-emp-recipient-name">
                  <span>{selectedEmployee.name}</span>
                  <span className="ask-emp-role-badge">EMPLOYEE</span>
                  {selectedEmployee.id === ticket.assignedToId && (
                    <span className="ask-emp-assigned-badge">ASSIGNED</span>
                  )}
                </div>
                <div className="ask-emp-recipient-actions">
                  <button
                    type="button"
                    className="ask-emp-profile-btn btn-wa-pill"
                    onClick={handleSendWhatsApp}
                    title={`Send WhatsApp message to ${employeeName} (${selectedEmployee.mobileNumber || ''})`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    <span>{formatPhone(selectedEmployee.mobileNumber)}</span>
                    <span className="ask-emp-pill-badge wa">WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    className="ask-emp-profile-btn btn-email-pill"
                    onClick={handleSendEmail}
                    title={`Send email to ${employeeName} (${selectedEmployee.email || ''})`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <span>{selectedEmployee.email || 'No email provided'}</span>
                    <span className="ask-emp-pill-badge email">Email</span>
                  </button>

                  <button
                    type="button"
                    className="ask-emp-profile-btn btn-push-pill"
                    onClick={handleSendMobileNotification}
                    disabled={sendingPush}
                    title={`Send instant mobile push notification to ${employeeName}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                    <span>{sendingPush ? 'Sending...' : pushSentSuccess ? 'Sent ✓' : 'Mobile Push'}</span>
                    <span className="ask-emp-pill-badge push">Instant</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ticket & Client Summary Card */}
          <div className="ask-emp-summary-card">
            <div className="ask-emp-summary-header">
              <span className="ask-emp-ticket-id">#{ticket.id}</span>
              <span className="ask-emp-badge status">{ticket.status || 'open'}</span>
              <span className={`ask-emp-badge priority-${ticket.priority || 'medium'}`}>
                {ticket.priority || 'medium'}
              </span>
              {ticket.category && (
                <span className="ask-emp-badge category">
                  {ticket.category.toUpperCase()}
                </span>
              )}
            </div>

            <div className="ask-emp-client-box">
              <div className="ask-emp-client-row">
                <span className="ask-emp-lbl">Client / Customer:</span>
                <strong>{clientName}</strong>
              </div>
              {clientMobile && (
                <div className="ask-emp-client-row">
                  <span className="ask-emp-lbl">Contact Mobile:</span>
                  <span>{clientMobile}</span>
                </div>
              )}
              {clientEmail && (
                <div className="ask-emp-client-row">
                  <span className="ask-emp-lbl">Email Address:</span>
                  <span>{clientEmail}</span>
                </div>
              )}
            </div>

            {ticket.description && (
              <div className="ask-emp-desc-box">
                <span className="ask-emp-desc-lbl">Description:</span>
                <span className="ask-emp-desc-val">{ticket.description}</span>
              </div>
            )}

            {ticket.transferNotes && (
              <div className="ask-emp-work-left-box">
                <span className="ask-emp-notes-lbl">Work Left:</span>
                <span className="ask-emp-notes-val">{ticket.transferNotes}</span>
              </div>
            )}
          </div>

          {/* Admin Instructions / Doubt Textarea */}
          <div className="ask-emp-field">
            <label htmlFor="ask-emp-doubt-input" className="ask-emp-field-label">
              Instruction or Question for {employeeName} <span className="opt">(optional)</span>
            </label>
            <textarea
              id="ask-emp-doubt-input"
              className="ask-emp-textarea"
              rows={3}
              placeholder="e.g. Please update the status of this ticket immediately or check with client regarding recharge details."
              value={adminQuery}
              onChange={(e) => setAdminQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="ask-emp-footer">
          <button
            type="button"
            className="ask-emp-close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
