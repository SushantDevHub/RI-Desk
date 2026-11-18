import { useEffect, useState } from 'react';
import { getToken } from '../api/authApi.js';
import './TicketLogsDialog.css';

const API = 'http://localhost:4000/api';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatLogDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? String(dateStr) : DATE_FORMATTER.format(d);
}

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

function synthesizeTicketLogs(ticket) {
  if (!ticket) return [];

  const isAssigned = Boolean(ticket.assignedTo || ticket.assignedToId);
  const employeeName = ticket.assignedTo || null;
  const actualAssignmentText = isAssigned
    ? `Assigned (${employeeName})`
    : 'Not Assigned (Unassigned)';
  const actualPriority = capitalize(ticket.priority || 'medium');
  const actualStatus = formatStatus(ticket.status || 'open');
  const actualDescription = (ticket.description || '').trim();
  const actualCategory = capitalize(ticket.category || 'Recharge');
  const actualSubject = (ticket.subject || '').trim();

  let logs = [];
  if (Array.isArray(ticket.logs) && ticket.logs.length > 0) {
    logs = ticket.logs.map((log) => ({ ...log }));
  } else {
    // Initial creation log
    const initialLog = {
      id: `log_init_${ticket.id || Date.now()}`,
      timestamp: ticket.createdAt || new Date().toISOString(),
      performedBy: ticket.createdBy || 'Admin User',
      performedByRole: 'admin',
      action: 'Ticket Created',
      priority: {
        old: null,
        new: ticket.priority || 'medium',
      },
      status: {
        old: null,
        new: ticket.status || 'open',
      },
      assignment: {
        old: null,
        new: employeeName,
        oldAssigned: false,
        newAssigned: isAssigned,
      },
      changes: [
        {
          field: 'Priority',
          oldValue: 'None',
          newValue: actualPriority,
        },
        {
          field: 'Status',
          oldValue: 'None',
          newValue: actualStatus,
        },
        {
          field: 'Assignment',
          oldValue: 'None',
          newValue: actualAssignmentText,
          isAssigned,
        },
        {
          field: 'Description',
          oldValue: 'None',
          newValue: actualDescription || 'No description provided',
        },
      ],
      message: `Ticket created with Priority: "${actualPriority}", Status: "${actualStatus}", Assignment: "${actualAssignmentText}"`,
    };

    logs = [initialLog];
  }

  // Determine what the latest state recorded in logs is
  const lastLoggedState = {
    priority: null,
    status: null,
    assignment: null,
    isAssigned: null,
    description: null,
    category: null,
    subject: null,
  };

  logs.forEach((log) => {
    if (log.priority && log.priority.new !== undefined && log.priority.new !== null) {
      lastLoggedState.priority = capitalize(log.priority.new);
    }
    if (log.status && log.status.new !== undefined && log.status.new !== null) {
      lastLoggedState.status = formatStatus(log.status.new);
    }
    if (log.assignment) {
      if (log.assignment.newAssigned !== undefined) {
        lastLoggedState.isAssigned = Boolean(log.assignment.newAssigned);
      }
      if (log.assignment.new !== undefined && log.assignment.new !== null) {
        lastLoggedState.assignment = log.assignment.newAssigned
          ? `Assigned (${log.assignment.new})`
          : 'Not Assigned (Unassigned)';
      }
    }
    if (Array.isArray(log.changes)) {
      log.changes.forEach((c) => {
        if (!c || !c.field) return;
        const f = String(c.field).toLowerCase();
        if (f === 'priority') lastLoggedState.priority = capitalize(c.newValue);
        if (f === 'status') lastLoggedState.status = formatStatus(c.newValue);
        if (f === 'assignment') {
          lastLoggedState.assignment = c.newValue;
          lastLoggedState.isAssigned =
            c.newAssigned ?? c.isAssigned ?? (c.newValue && !c.newValue.includes('Not Assigned'));
        }
        if (f === 'description') lastLoggedState.description = c.newValue;
        if (f === 'category') lastLoggedState.category = capitalize(c.newValue);
        if (f === 'subject') lastLoggedState.subject = c.newValue;
      });
    }
  });

  // Reconcile any divergence between the last logged state and the current ticket state
  const missingChanges = [];

  if (lastLoggedState.priority && lastLoggedState.priority !== actualPriority) {
    missingChanges.push({
      field: 'Priority',
      oldValue: lastLoggedState.priority,
      newValue: actualPriority,
    });
  }

  if (lastLoggedState.status && lastLoggedState.status !== actualStatus) {
    missingChanges.push({
      field: 'Status',
      oldValue: lastLoggedState.status,
      newValue: actualStatus,
    });
  }

  if (lastLoggedState.assignment && lastLoggedState.assignment !== actualAssignmentText) {
    missingChanges.push({
      field: 'Assignment',
      oldValue: lastLoggedState.assignment,
      newValue: actualAssignmentText,
      oldAssigned: Boolean(lastLoggedState.isAssigned),
      newAssigned: isAssigned,
    });
  }

  if (
    lastLoggedState.description !== null &&
    actualDescription &&
    lastLoggedState.description.trim() !== actualDescription
  ) {
    missingChanges.push({
      field: 'Description',
      oldValue: lastLoggedState.description || 'None',
      newValue: actualDescription || 'None',
    });
  }

  if (lastLoggedState.category && lastLoggedState.category !== actualCategory) {
    missingChanges.push({
      field: 'Category',
      oldValue: lastLoggedState.category,
      newValue: actualCategory,
    });
  }

  if (lastLoggedState.subject && actualSubject && lastLoggedState.subject !== actualSubject) {
    missingChanges.push({
      field: 'Subject',
      oldValue: lastLoggedState.subject,
      newValue: actualSubject,
    });
  }

  if (missingChanges.length > 0) {
    logs.push({
      id: `log_update_${ticket.id || Date.now()}_${Date.now()}`,
      timestamp: ticket.updatedAt || new Date().toISOString(),
      performedBy: ticket.resolvedBy || 'Admin User',
      performedByRole: ticket.resolvedBy ? 'admin' : 'employee',
      action: missingChanges
        .map((c) => `${c.field === 'Assignment' ? 'Assignment' : c.field} Changed`)
        .join(', '),
      priority: {
        old: lastLoggedState.priority || actualPriority,
        new: actualPriority,
      },
      status: {
        old: lastLoggedState.status || actualStatus,
        new: actualStatus,
      },
      assignment: {
        old: lastLoggedState.assignment || 'Not Assigned (Unassigned)',
        new: actualAssignmentText,
        oldAssigned: Boolean(lastLoggedState.isAssigned),
        newAssigned: isAssigned,
      },
      changes: missingChanges,
      message: missingChanges
        .map(
          (c) =>
            `${c.field === 'Assignment' ? 'Assigned Status' : c.field} changed from "${
              c.oldValue
            }" to "${c.newValue}"`
        )
        .join(' • '),
    });
  }

  return logs;
}

export default function TicketLogsDialog({ ticket, onClose }) {
  if (!ticket) return null;

  const [currentTicket, setCurrentTicket] = useState(ticket);
  const [logs, setLogs] = useState(() => {
    return synthesizeTicketLogs(ticket);
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCurrentTicket(ticket);
    setLogs(synthesizeTicketLogs(ticket));
  }, [ticket]);

  // Fetch freshest logs from server with fast live-sync & background polling
  useEffect(() => {
    let isMounted = true;

    async function fetchLogs(isBackground = false) {
      try {
        if (!isBackground && logs.length === 0) {
          setLoading(true);
        }
        const res = await fetch(`${API}/tickets/${ticket.id}/logs`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (!res.ok) throw new Error('Failed to load logs');
        const data = await res.json();
        if (isMounted) {
          const freshTicket = data.ticket || ticket;
          setCurrentTicket(freshTicket);
          if (Array.isArray(data.logs) && data.logs.length > 0) {
            setLogs(synthesizeTicketLogs({ ...freshTicket, logs: data.logs }));
          } else if (freshTicket && Array.isArray(freshTicket.logs) && freshTicket.logs.length > 0) {
            setLogs(synthesizeTicketLogs(freshTicket));
          } else {
            setLogs(synthesizeTicketLogs(freshTicket));
          }
        }
      } catch (err) {
        // Fall back to existing or synthesized ticket logs
        if (isMounted) {
          setLogs((prev) => (prev.length > 0 ? prev : synthesizeTicketLogs(ticket)));
        }
      } finally {
        if (isMounted && !isBackground) {
          setLoading(false);
        }
      }
    }

    // Initial fetch
    fetchLogs(false);

    // Fast polling every 1200ms while dialog is open
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 1200);

    // Instant event-driven sync when any ticket is updated in the app or another tab
    function handleFastSync(event) {
      if (event?.detail?.id && String(event.detail.id) !== String(ticket.id)) {
        return;
      }
      fetchLogs(true);
    }

    window.addEventListener('tickets-updated', handleFastSync);
    window.addEventListener('storage', () => fetchLogs(true));

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('tickets-updated', handleFastSync);
      window.removeEventListener('storage', () => fetchLogs(true));
    };
  }, [ticket.id]);

  // Current ticket values
  const currentPriority = String(currentTicket.priority || 'medium').toLowerCase();
  const currentStatus = String(currentTicket.status || 'open').toLowerCase();
  const isCurrentlyAssigned = Boolean(currentTicket.assignedTo || currentTicket.assignedToId);
  const currentAssignee = currentTicket.assignedTo || 'Unassigned';

  // Display logs in reverse-chronological order (newest first)
  const sortedLogs = [...logs].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  return (
    <div
      className="ticket-log-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ticket-log-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-log-title"
      >
        {/* Header */}
        <div className="ticket-log-header">
          <div className="ticket-log-header-left">
            <div className="ticket-log-badge-icon">
              <span className="ticket-log-l-symbol">L</span>
            </div>
            <div>
              <h2 id="ticket-log-title" className="ticket-log-title">
                Ticket Logs — <span className="ticket-log-id">{currentTicket.id}</span>
              </h2>
              <p className="ticket-log-sub">
                {currentTicket.subject ? `"${currentTicket.subject}"` : 'Ticket change history'}
                {(currentTicket.client || currentTicket.customer) ? ` • Client: ${currentTicket.client || currentTicket.customer}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ticket-log-close-btn"
            onClick={onClose}
            aria-label="Close ticket logs"
          >
            ×
          </button>
        </div>

        {/* Current State Summary Cards */}
        <div className="ticket-log-state-grid">
          {/* Priority */}
          <div className="ticket-log-state-card">
            <span className="ticket-log-state-label">Priority</span>
            <span
              className={`ticket-log-state-val ${
                currentPriority === 'high' ? 'priority-high' : 'priority-neutral'
              }`}
            >
              {capitalize(currentPriority)}
            </span>
          </div>

          {/* Status */}
          <div className="ticket-log-state-card">
            <span className="ticket-log-state-label">Status</span>
            <span className="ticket-log-state-val status-val">
              {formatStatus(currentStatus)}
            </span>
          </div>

          {/* Assigned or Not */}
          <div className="ticket-log-state-card">
            <span className="ticket-log-state-label">Assigned or Not</span>
            <span
              className={`ticket-log-state-val ${
                isCurrentlyAssigned ? 'assigned-val' : 'unassigned-val'
              }`}
            >
              {isCurrentlyAssigned ? (
                <>
                  <span className="ticket-log-dot dot-assigned" />
                  Assigned ({currentAssignee})
                </>
              ) : (
                <>
                  <span className="ticket-log-dot dot-unassigned" />
                  Not Assigned
                </>
              )}
            </span>
          </div>

          {/* Log count */}
          <div className="ticket-log-state-card">
            <span className="ticket-log-state-label">Total Events</span>
            <span className="ticket-log-state-val neutral-val">
              {logs.length} {logs.length === 1 ? 'event' : 'events'}
            </span>
          </div>
        </div>

        {/* Card of Description */}
        <div className="ticket-log-desc-card">
          <div className="ticket-log-desc-card-top">
            <div className="ticket-log-desc-card-heading">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
              <span>Description</span>
            </div>
            {currentTicket.category && (
              <span className="ticket-log-desc-category-pill">
                Category: {capitalize(currentTicket.category)}
              </span>
            )}
          </div>
          <div className="ticket-log-desc-card-body">
            <p className="ticket-log-desc-card-text">
              {currentTicket.description || 'No description provided.'}
            </p>
          </div>
        </div>

        {/* Log Entries Timeline */}
        <div className="ticket-log-body">
          {loading && logs.length === 0 ? (
            <div className="ticket-log-empty">Loading ticket logs...</div>
          ) : sortedLogs.length === 0 ? (
            <div className="ticket-log-empty">
              No log records found for this ticket yet.
            </div>
          ) : (
            <div className="ticket-log-timeline">
              {sortedLogs.map((log, index) => {
                const changes = Array.isArray(log.changes) ? log.changes : [];
                return (
                  <div key={log.id || `log-${index}`} className="ticket-log-item">
                    {/* Timeline Node marker */}
                    <div className="ticket-log-marker">
                      <div className="ticket-log-circle" />
                      {index !== sortedLogs.length - 1 && (
                        <div className="ticket-log-line" />
                      )}
                    </div>

                    {/* Timeline Content */}
                    <div className="ticket-log-content">
                      <div className="ticket-log-item-header">
                        <div className="ticket-log-action-wrap">
                          <span className="ticket-log-action-badge">
                            {log.action || 'Ticket Updated'}
                          </span>
                          <span className="ticket-log-author">
                            by <strong>{log.performedBy || 'System'}</strong>
                            {log.performedByRole && (
                              <span className="ticket-log-role">
                                ({log.performedByRole})
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="ticket-log-timestamp">
                          {formatLogDate(log.timestamp)}
                        </span>
                      </div>

                      {/* Changes Table showing Old Value and New Value */}
                      {changes.length > 0 ? (
                        <div className="ticket-log-changes-table-wrap">
                          <table className="ticket-log-changes-table">
                            <thead>
                              <tr>
                                <th>Field</th>
                                <th>Old Value</th>
                                <th style={{ width: 30, textAlign: 'center' }}></th>
                                <th>New Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {changes.map((change, cIdx) => {
                                const isPriority =
                                  String(change.field).toLowerCase() === 'priority';
                                const isStatus =
                                  String(change.field).toLowerCase() === 'status';
                                const isAssignment =
                                  String(change.field).toLowerCase() === 'assignment';

                                const isHighOld =
                                  isPriority &&
                                  String(change.oldValue).toLowerCase().includes('high');
                                const isHighNew =
                                  isPriority &&
                                  String(change.newValue).toLowerCase().includes('high');

                                const isDesc =
                                  String(change.field).toLowerCase() === 'description';

                                return (
                                  <tr key={`change-${cIdx}`}>
                                    {/* 1. Field */}
                                    <td className="ticket-log-cell-field">
                                      {change.field === 'Assignment'
                                        ? 'Assigned / Assignment'
                                        : change.field}
                                    </td>

                                    {/* 2. Old Value */}
                                    <td className="ticket-log-cell-val">
                                      <span
                                        className={`ticket-log-val-badge old-val ${
                                          isHighOld ? 'priority-high-text' : ''
                                        } ${isDesc ? 'desc-val-badge' : ''}`}
                                      >
                                        {change.oldValue || '—'}
                                      </span>
                                    </td>

                                    {/* Arrow */}
                                    <td className="ticket-log-cell-arrow">
                                      <svg
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <polyline points="9 18 15 12 9 6" />
                                      </svg>
                                    </td>

                                    {/* 3. New Value */}
                                    <td className="ticket-log-cell-val">
                                      <span
                                        className={`ticket-log-val-badge new-val ${
                                          isHighNew
                                            ? 'priority-high-text'
                                            : isAssignment && change.newAssigned
                                            ? 'is-assigned-badge'
                                            : isAssignment && !change.newAssigned
                                            ? 'is-unassigned-badge'
                                            : ''
                                        } ${isDesc ? 'desc-val-badge' : ''}`}
                                      >
                                        {change.newValue || '—'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="ticket-log-no-changes">
                          <span>Updated without field modifications</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ticket-log-footer">
          <button
            type="button"
            className="ticket-log-footer-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
