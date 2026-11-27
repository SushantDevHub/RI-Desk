import { useState, useEffect } from 'react';
import { getToken } from '../api/authApi.js';
import { API_BASE } from '../config/api.js';
import './TransferTicketDialog.css';

const API = API_BASE;

function capitalize(str = '') {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

function formatStatus(status = '') {
  const s = String(status).toLowerCase();
  if (s === 'in-progress') return 'In Progress';
  if (s === 'resolved') return 'Resolved';
  if (s === 'open') return 'Open';
  return capitalize(status);
}

async function parseResponse(res) {
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text && !text.includes('<!DOCTYPE') ? text : `Request failed (${res.status})` };
  }
  return { ok: res.ok, status: res.status, data };
}

function getLoggedInUser() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function TransferTicketDialog({ ticket, currentUser, onClose, onSuccess }) {
  if (!ticket) return null;

  const activeUser = currentUser || getLoggedInUser();

  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [transferToId, setTransferToId] = useState('');
  const [workLeftDescription, setWorkLeftDescription] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch active employees
  useEffect(() => {
    let isMounted = true;
    async function loadEmployees() {
      try {
        setEmployeesLoading(true);
        const res = await fetch(`${API}/tickets/employees`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        const { ok, data } = await parseResponse(res);
        if (ok && isMounted) {
          const list = Array.isArray(data.employees) ? data.employees : [];
          setEmployees(list.filter((e) => e.status !== 'inactive'));
        }
      } catch (err) {
        console.error('Failed to load employees for transfer:', err);
      } finally {
        if (isMounted) setEmployeesLoading(false);
      }
    }

    loadEmployees();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!transferToId) {
      setError('Please select an employee to transfer this ticket to.');
      return;
    }

    if (activeUser?.id && String(transferToId) === String(activeUser.id)) {
      setError('You cannot transfer a ticket to yourself. Please select another employee.');
      return;
    }

    const trimmedNotes = workLeftDescription.trim();
    if (!trimmedNotes) {
      setError('Please describe how much work is left or provide handover notes.');
      return;
    }

    if (trimmedNotes.length > 250) {
      setError('Work left description cannot exceed 250 characters.');
      return;
    }

    setTransferring(true);
    try {
      const res = await fetch(`${API}/tickets/${ticket.id}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          transferToId,
          workLeftDescription: trimmedNotes,
        }),
      });

      const { ok, data } = await parseResponse(res);
      if (!ok) {
        throw new Error(data.error || data.message || 'Failed to transfer ticket.');
      }

      setSuccess(data.message || 'Ticket successfully transferred!');

      // Notify parent & global subscribers
      if (onSuccess) {
        onSuccess(data.ticket);
      }

      window.dispatchEvent(
        new CustomEvent('tickets-updated', {
          detail: data.ticket,
        })
      );

      window.dispatchEvent(
        new CustomEvent('notifications-updated', {
          detail: data.notification,
        })
      );

      try {
        localStorage.setItem('ri_desk_notif_sync', Date.now().toString());
      } catch (storageErr) {
        // ignore
      }

      // Close dialog shortly after displaying success
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Error occurred while transferring ticket.');
    } finally {
      setTransferring(false);
    }
  }

  const currentAssigneeName = ticket.assignedTo || 'Unassigned';

  return (
    <div
      className="transfer-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !transferring) onClose();
      }}
    >
      <div
        className="transfer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-ticket-title"
      >
        {/* Header */}
        <div className="transfer-dialog-header">
          <div className="transfer-dialog-header-left">
            <div className="transfer-dialog-icon-badge">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <div>
              <h2 id="transfer-ticket-title" className="transfer-dialog-title">
                Transfer Ticket <span className="transfer-dialog-id">{ticket.id}</span>
              </h2>
              <p className="transfer-dialog-sub">
                Reassign ticket to another employee
              </p>
            </div>
          </div>
          <button
            type="button"
            className="transfer-dialog-close-btn"
            onClick={onClose}
            disabled={transferring}
            aria-label="Close transfer dialog"
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="transfer-dialog-body">
            {/* Context Card */}
            <div className="transfer-ticket-info-card">
              <div className="transfer-info-item">
                <span className="transfer-info-label">Currently Assigned</span>
                <span className="transfer-info-val highlight-assignee">
                  {currentAssigneeName}
                </span>
              </div>
              <div className="transfer-info-item">
                <span className="transfer-info-label">Client / Customer</span>
                <span className="transfer-info-val">
                  {ticket.client || ticket.customer || '—'}
                </span>
              </div>
              <div className="transfer-info-item">
                <span className="transfer-info-label">Status</span>
                <span className="transfer-info-val">
                  {formatStatus(ticket.status || 'open')}
                </span>
              </div>
              <div className="transfer-info-item">
                <span className="transfer-info-label">Priority</span>
                <span className="transfer-info-val">
                  {capitalize(ticket.priority || 'medium')}
                </span>
              </div>
            </div>

            {/* Error / Success Alerts */}
            {error && (
              <div className="transfer-alert error">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="transfer-alert success">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{success}</span>
              </div>
            )}

            {/* Transfer To Field */}
            <div className="transfer-field">
              <label htmlFor="transfer-employee-select" className="transfer-label">
                Transfer To <span className="req">*</span>
              </label>
              <select
                id="transfer-employee-select"
                className="transfer-select"
                value={transferToId}
                onChange={(e) => {
                  setTransferToId(e.target.value);
                  setError('');
                }}
                disabled={transferring || employeesLoading}
                required
              >
                <option value="">
                  {employeesLoading ? 'Loading employees...' : 'Select Employee to Transfer To...'}
                </option>
                {(() => {
                  const availableEmployees = employees.filter(
                    (emp) => !activeUser?.id || String(emp.id) !== String(activeUser.id)
                  );
                  if (availableEmployees.length === 0 && !employeesLoading) {
                    return <option value="" disabled>No other active employees available</option>;
                  }
                  return availableEmployees.map((emp) => {
                    const isCurrent =
                      String(emp.id) === String(ticket.assignedToId) ||
                      emp.name === ticket.assignedTo;
                    return (
                      <option key={emp.id} value={emp.id} disabled={isCurrent}>
                        {emp.name} {isCurrent ? '(Currently Assigned)' : ''}
                      </option>
                    );
                  });
                })()}
              </select>
            </div>

            {/* Work Left Description Field */}
            <div className="transfer-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="transfer-work-left-textarea" className="transfer-label">
                  Work <span className="req">*</span>
                </label>
                <span
                  style={{
                    fontSize: '11.5px',
                    color: workLeftDescription.length >= 250 ? '#dc2626' : '#64748b',
                    fontWeight: 600,
                  }}
                >
                  {workLeftDescription.length}/250
                </span>
              </div>
              <textarea
                id="transfer-work-left-textarea"
                className="transfer-textarea"
                rows={3}
                maxLength={250}
                value={workLeftDescription}
                onChange={(e) => {
                  setWorkLeftDescription(e.target.value.slice(0, 250));
                  setError('');
                }}
                disabled={transferring}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <p className="transfer-hint">
                  This description will be recorded in the transfer history log.
                </p>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {Math.max(0, 250 - workLeftDescription.length)} chars left
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="transfer-dialog-footer">
            <button
              type="button"
              className="transfer-cancel-btn"
              onClick={onClose}
              disabled={transferring}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="transfer-submit-btn"
              disabled={transferring || !transferToId || !workLeftDescription.trim()}
            >
              {transferring ? (
                <>
                  <span className="transfer-btn-spinner" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="15 14 20 9 15 4" />
                    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                  </svg>
                  <span>Transfer Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
