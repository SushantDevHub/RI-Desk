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

// Clean and normalize displayed values: strip "Assigned (...)", "Not Assigned", etc.
function formatLogValue(val) {
  if (val === null || val === undefined || val === '' || val === 'None' || val === '—') {
    return '—';
  }
  const str = String(val).trim();
  const assignedMatch = str.match(/^Assigned\s*\((.+)\)$/i);
  if (assignedMatch) return assignedMatch[1].trim();
  if (/^Not Assigned/i.test(str) || str.toLowerCase() === 'unassigned') return 'Unassigned';
  return str;
}

// Clean and normalize field names for human readability
function formatFieldName(fieldName = '') {
  const f = String(fieldName || '').toLowerCase();
  if (f === 'assignment' || f.includes('assign')) return 'Assignee';
  if (f.includes('work left') || f.includes('transfer note')) return 'Handover Notes';
  return capitalize(fieldName);
}

function synthesizeTicketLogs(ticket) {
  if (!ticket) return [];

  const isAssigned = Boolean(ticket.assignedTo || ticket.assignedToId);
  const employeeName = ticket.assignedTo || null;
  const actualAssignmentText = employeeName || 'Unassigned';
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
          field: 'Assignee',
          oldValue: 'None',
          newValue: actualAssignmentText,
          isAssigned,
        },
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
          field: 'Description',
          oldValue: 'None',
          newValue: actualDescription || 'No description provided',
        },
      ],
      message: `Ticket created with Assignee: "${actualAssignmentText}", Priority: "${actualPriority}", Status: "${actualStatus}"`,
    };

    logs = [initialLog];
  }

  // If ticket has transferNotes and no transfer log found, append synthesized transfer log
  const hasTransferLog = logs.some(
    (l) =>
      l.action === 'Ticket Transferred' ||
      l.transferDetails ||
      String(l.action || '').toLowerCase().includes('transfer')
  );

  if (!hasTransferLog && ticket.transferNotes) {
    logs.push({
      id: `synth_transfer_${ticket.id}`,
      timestamp: ticket.lastTransferredAt || ticket.updatedAt || new Date().toISOString(),
      performedBy: ticket.lastTransferredBy || 'Employee',
      performedByRole: 'employee',
      action: 'Ticket Transferred',
      assignment: {
        old: 'Previous Assignee',
        new: employeeName || 'Target Assignee',
        oldAssigned: true,
        newAssigned: isAssigned,
      },
      transferDetails: {
        from: 'Previous Assignee',
        to: employeeName || 'Target Assignee',
        workLeft: ticket.transferNotes,
        transferredBy: ticket.lastTransferredBy || 'Employee',
        transferredByRole: 'employee',
      },
      changes: [
        {
          field: 'Assignee',
          oldValue: 'Previous Assignee',
          newValue: actualAssignmentText,
          newAssigned: isAssigned,
        },
      ],
      message: `Ticket transferred. Work left: "${ticket.transferNotes}"`,
    });
  }

  // Track latest state to reconcile any missing changes without duplicates
  const lastLoggedState = {
    priority: null,
    status: null,
    assignment: null,
    description: null,
    category: null,
    subject: null,
  };

  logs.forEach((log) => {
    if (log.priority?.new) {
      lastLoggedState.priority = capitalize(log.priority.new);
    }
    if (log.status?.new) {
      lastLoggedState.status = formatStatus(log.status.new);
    }
    if (log.assignment?.new) {
      lastLoggedState.assignment = formatLogValue(log.assignment.new);
    }
    if (Array.isArray(log.changes)) {
      log.changes.forEach((c) => {
        if (!c || !c.field) return;
        const f = String(c.field).toLowerCase();
        if (f === 'priority') lastLoggedState.priority = capitalize(c.newValue);
        if (f === 'status') lastLoggedState.status = formatStatus(c.newValue);
        if (f === 'assignment' || f.includes('assign')) {
          lastLoggedState.assignment = formatLogValue(c.newValue);
        }
        if (f === 'description') lastLoggedState.description = c.newValue;
        if (f === 'category') lastLoggedState.category = capitalize(c.newValue);
        if (f === 'subject') lastLoggedState.subject = c.newValue;
      });
    }
  });

  const missingChanges = [];

  if (
    lastLoggedState.priority &&
    formatLogValue(lastLoggedState.priority) !== formatLogValue(actualPriority)
  ) {
    missingChanges.push({
      field: 'Priority',
      oldValue: lastLoggedState.priority,
      newValue: actualPriority,
    });
  }

  if (
    lastLoggedState.status &&
    formatLogValue(lastLoggedState.status) !== formatLogValue(actualStatus)
  ) {
    missingChanges.push({
      field: 'Status',
      oldValue: lastLoggedState.status,
      newValue: actualStatus,
    });
  }

  if (
    lastLoggedState.assignment &&
    formatLogValue(lastLoggedState.assignment) !== formatLogValue(actualAssignmentText)
  ) {
    missingChanges.push({
      field: 'Assignee',
      oldValue: lastLoggedState.assignment,
      newValue: actualAssignmentText,
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



  if (missingChanges.length > 0) {
    logs.push({
      id: `log_update_${ticket.id || Date.now()}_${Date.now()}`,
      timestamp: ticket.updatedAt || new Date().toISOString(),
      performedBy: ticket.resolvedBy || 'Admin User',
      performedByRole: ticket.resolvedBy ? 'admin' : 'employee',
      action: 'Ticket Updated',
      changes: missingChanges,
      message: missingChanges
        .map((c) => `${c.field} changed from "${c.oldValue}" to "${c.newValue}"`)
        .join(' • '),
    });
  }

  return logs;
}

// Clean and deduplicate logs for display: removes repetitive entries and no-ops
function cleanAndDeduplicateLogs(rawLogs = []) {
  const result = [];
  const seenSignatures = new Set();

  for (const log of rawLogs) {
    if (!log) continue;
    const action = log.action || 'Ticket Updated';
    const isTransfer =
      action === 'Ticket Transferred' ||
      Boolean(log.transferDetails) ||
      String(action).toLowerCase().includes('transfer');
    const isCreation = action === 'Ticket Created';

    if (isTransfer) {
      result.push({
        ...log,
        action: 'Ticket Transferred',
        isTransfer: true,
      });
      continue;
    }

    if (isCreation) {
      const cleanChanges = (Array.isArray(log.changes) ? log.changes : [])
        .map((c) => ({
          ...c,
          field: formatFieldName(c.field),
          oldValue: formatLogValue(c.oldValue),
          newValue: formatLogValue(c.newValue),
        }))
        .filter((c) => c.newValue !== '—');

      result.push({
        ...log,
        isCreation: true,
        changes: cleanChanges,
      });
      continue;
    }

    // Regular updates: filter out no-op changes (where old value == new value)
    const rawChanges = Array.isArray(log.changes) ? log.changes : [];
    const cleanChanges = rawChanges
      .map((c) => ({
        ...c,
        field: formatFieldName(c.field),
        oldValue: formatLogValue(c.oldValue),
        newValue: formatLogValue(c.newValue),
      }))
      .filter((c) => c.oldValue.toLowerCase() !== c.newValue.toLowerCase());

    // Skip update entries that have zero meaningful changes
    if (cleanChanges.length === 0) {
      continue;
    }

    // Deduplicate identical consecutive change entries
    const sig = `${log.timestamp}_${cleanChanges
      .map((c) => `${c.field}:${c.oldValue}->${c.newValue}`)
      .join('|')}`;
    if (seenSignatures.has(sig)) {
      continue;
    }
    seenSignatures.add(sig);

    result.push({
      ...log,
      changes: cleanChanges,
    });
  }

  return result;
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

  // Fetch freshest logs from server with fast live-sync & polling
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
        if (!res.ok) throw new Error(`Failed to load logs (${res.status})`);
        const text = await res.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }
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
        if (isMounted) {
          setLogs((prev) => (prev.length > 0 ? prev : synthesizeTicketLogs(ticket)));
        }
      } finally {
        if (isMounted && !isBackground) {
          setLoading(false);
        }
      }
    }

    fetchLogs(false);

    const interval = setInterval(() => {
      fetchLogs(true);
    }, 1500);

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
  const currentAssignee = formatLogValue(currentTicket.assignedTo) || 'Unassigned';

  // Display logs in reverse-chronological order (newest first), cleaned & deduplicated
  const rawSortedLogs = [...logs].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  const displayedLogs = cleanAndDeduplicateLogs(rawSortedLogs);

  // Count transfer events
  const transferCount = displayedLogs.filter((l) => l.isTransfer).length;

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
                {currentTicket.category ? capitalize(currentTicket.category) : 'Ticket history'}
                {(currentTicket.client || currentTicket.customer)
                  ? ` • Client: ${currentTicket.client || currentTicket.customer}`
                  : ''}
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

          {/* Current Assignee */}
          <div className="ticket-log-state-card">
            <span className="ticket-log-state-label">Current Assignee</span>
            <span
              className={`ticket-log-state-val ${
                isCurrentlyAssigned && currentAssignee !== 'Unassigned'
                  ? 'assigned-val'
                  : 'unassigned-val'
              }`}
            >
              {isCurrentlyAssigned && currentAssignee !== 'Unassigned' ? (
                <>
                  <span className="ticket-log-dot dot-assigned" />
                  {currentAssignee}
                </>
              ) : (
                <>
                  <span className="ticket-log-dot dot-unassigned" />
                  Unassigned
                </>
              )}
            </span>
          </div>

          {/* Total History Events */}
          <div className="ticket-log-state-card">
            <span className="ticket-log-state-label">History Events</span>
            <span className="ticket-log-state-val neutral-val">
              {displayedLogs.length} {displayedLogs.length === 1 ? 'event' : 'events'}
              {transferCount > 0 && (
                <span className="transfer-count-pill">
                  {transferCount} {transferCount === 1 ? 'Transfer' : 'Transfers'}
                </span>
              )}
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
          {loading && displayedLogs.length === 0 ? (
            <div className="ticket-log-empty">Loading ticket logs...</div>
          ) : displayedLogs.length === 0 ? (
            <div className="ticket-log-empty">
              No log records found for this ticket yet.
            </div>
          ) : (
            <div className="ticket-log-timeline">
              {displayedLogs.map((log, index) => {
                const changes = Array.isArray(log.changes) ? log.changes : [];
                const isTransfer = Boolean(log.isTransfer);

                return (
                  <div key={log.id || `log-${index}`} className="ticket-log-item">
                    {/* Timeline Node marker */}
                    <div className="ticket-log-marker">
                      <div
                        className="ticket-log-circle"
                        style={isTransfer ? { borderColor: '#7c3aed' } : {}}
                      />
                      {index !== displayedLogs.length - 1 && (
                        <div className="ticket-log-line" />
                      )}
                    </div>

                    {/* Timeline Content */}
                    <div className="ticket-log-content">
                      <div className="ticket-log-item-header">
                        <div className="ticket-log-action-wrap">
                          <span
                            className={`ticket-log-action-badge ${
                              isTransfer ? 'badge-transferred' : ''
                            }`}
                          >
                            {isTransfer ? 'Ticket Transferred' : (log.action || 'Ticket Updated')}
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

                      {/* Clean Transfer Handover Box (No duplicate table underneath) */}
                      {isTransfer ? (
                        <div className="ticket-log-transfer-callout">
                          <div className="transfer-callout-header">
                            <span className="transfer-callout-tag">Transfer to</span>
                            <div className="transfer-callout-route">
                              <span>
                                {formatLogValue(
                                  log.transferDetails?.from ||
                                    log.assignment?.old ||
                                    'Previous Assignee'
                                )}
                              </span>
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                              <span>
                                {formatLogValue(
                                  log.transferDetails?.to ||
                                    log.assignment?.new ||
                                    currentTicket.assignedTo ||
                                    'Target Assignee'
                                )}
                              </span>
                            </div>
                          </div>
                          {(log.transferDetails?.workLeft || currentTicket.transferNotes) && (
                            <p className="transfer-callout-desc">
                              <strong>Work :</strong>{' '}
                              {log.transferDetails?.workLeft || currentTicket.transferNotes}
                            </p>
                          )}
                        </div>
                      ) : changes.length > 0 ? (
                        /* Clean Field Changes Table with Old -> New Values */
                        <div className="ticket-log-changes-table-wrap">
                          <table className="ticket-log-changes-table">
                            <thead>
                              <tr>
                                <th>Field</th>
                                <th>Previous Value</th>
                                <th style={{ width: 30, textAlign: 'center' }}></th>
                                <th>Updated Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {changes.map((change, cIdx) => {
                                const isPriority =
                                  String(change.field).toLowerCase() === 'priority';
                                const isAssignee =
                                  String(change.field).toLowerCase() === 'assignee';
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
                                      {change.field}
                                    </td>

                                    {/* 2. Previous Value */}
                                    <td className="ticket-log-cell-val">
                                      <span
                                        className={`ticket-log-val-badge old-val ${
                                          isHighOld ? 'priority-high-text' : ''
                                        } ${isDesc ? 'desc-val-badge' : ''}`}
                                      >
                                        {change.oldValue}
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

                                    {/* 3. Updated Value */}
                                    <td className="ticket-log-cell-val">
                                      <span
                                        className={`ticket-log-val-badge new-val ${
                                          isHighNew
                                            ? 'priority-high-text'
                                            : isAssignee && change.newValue !== 'Unassigned'
                                            ? 'is-assigned-badge'
                                            : isAssignee && change.newValue === 'Unassigned'
                                            ? 'is-unassigned-badge'
                                            : ''
                                        } ${isDesc ? 'desc-val-badge' : ''}`}
                                      >
                                        {change.newValue}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
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
