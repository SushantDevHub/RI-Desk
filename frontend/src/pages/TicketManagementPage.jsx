import { useEffect, useState } from 'react';
import { getToken } from '../api/authApi.js';
import ContactClientDialog from '../components/ContactClientDialog.jsx';
import TicketLogsDialog from '../components/TicketLogsDialog.jsx';
import TransferTicketDialog from '../components/TransferTicketDialog.jsx';
import AskAdminDialog from '../components/AskAdminDialog.jsx';
import AskEmployeeDialog from '../components/AskEmployeeDialog.jsx';
import './TicketManagementPage.css';

const API = 'http://localhost:4000/api';

const INITIAL_FORM = {
  subject: '',
  userType: 'admin',
  client: '',
  clientMobile: '',
  clientEmail: '',
  customer: '',
  customerMobile: '',
  customerEmail: '',
  category: 'recharge',
  priority: 'medium',
  description: '',
  assignedToId: '',
  status: 'open',
};

const PRIORITY_ORDER = {
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_COLORS = {
  high: '#dc2626',
  medium: '#334155',
  low: '#334155',
};

const PRIORITY_BACKGROUNDS = {
  high: '#ffffff',
  medium: '#ffffff',
  low: '#ffffff',
};

const STATUS_COLORS = {
  open: '#334155',
  'in-progress': '#334155',
  resolved: '#334155',
};

const STATUS_BACKGROUNDS = {
  open: '#ffffff',
  'in-progress': '#ffffff',
  resolved: '#ffffff',
};

const CATEGORY_COLORS = {
  recharge: '#334155',
  payment: '#334155',
  wallet: '#334155',
  technical: '#334155',
};

const CATEGORY_BACKGROUNDS = {
  recharge: '#ffffff',
  payment: '#ffffff',
  wallet: '#ffffff',
  technical: '#ffffff',
};

function getCategoryColor() {
  return '#334155';
}

function getCategoryBg() {
  return '#ffffff';
}
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});


/* -------------------------------------------------- */
/* Helpers                                            */
/* -------------------------------------------------- */

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${getToken()}`,
    ...extra,
  };
}

async function readResponse(response) {
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
}

// Read the role from the JWT for UI display only.
// The backend must still enforce admin permissions.
function getCurrentRole() {
  try {
    const token = getToken();
    const payload = token?.split('.')[1];
    if (!payload) return '';

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      '='
    );

    return JSON.parse(atob(padded)).role || '';
  } catch {
    return '';
  }
}

function formatStatus(status) {
  if (!status) return 'Unknown';

  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Not set';
}

function formatDate(dateString) {
  if (!dateString) return '—';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function calculateResolutionTime(createdAt, resolvedAt) {
  if (!createdAt) return '< 1 min';
  const start = new Date(createdAt).getTime();
  const end = new Date(resolvedAt || new Date()).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return '< 1 min';

  const diffMs = end - start;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return remHours > 0 ? `${diffDays}d ${remHours}h` : `${diffDays}d`;
  }
  if (diffHours > 0) {
    const remMins = diffMins % 60;
    return remMins > 0 ? `${diffHours}h ${remMins}m` : `${diffHours}h`;
  }
  if (diffMins > 0) {
    return `${diffMins} min${diffMins > 1 ? 's' : ''}`;
  }
  return '< 1 min';
}

const NEW_TICKET_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function isTicketNew(createdAt, status) {
  if (status === 'resolved') return false;
  if (!createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return false;
  const age = Date.now() - createdTime;
  return age >= 0 && age < NEW_TICKET_THRESHOLD_MS;
}

// Returns an error message, or '' when the form is valid.
export function validateTicket(ticket) {
  const clientName = (ticket.client || ticket.customer || '').trim();
  const mobile = (ticket.clientMobile || ticket.customerMobile || '').trim();
  const email = (ticket.clientEmail || ticket.customerEmail || ticket.email || '').trim();

  if (
    !clientName ||
    !mobile ||
    !ticket.description.trim()
  ) {
    return 'Please fill in all required fields.';
  }

  if (ticket.description.trim().length > 250) {
    return 'Description cannot exceed 250 characters.';
  }

  if (!ticket.category || !String(ticket.category).trim()) {
    return 'Category is required.';
  }

  if (String(ticket.category).trim().length > 75) {
    return 'Category cannot exceed 75 characters.';
  }

  if (!/^\d{10}$/.test(mobile)) {
    return 'Enter a valid 10-digit mobile number.';
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.';
  }

  return '';
}

// Builds the request body used by both create and edit.
export function buildPayload(ticket) {
  const clientName = (ticket.client || ticket.customer || '').trim();
  const mobile = (ticket.clientMobile || ticket.customerMobile || '').trim();
  const email = (ticket.clientEmail || ticket.customerEmail || ticket.email || '').trim();

  return {
    subject: (ticket.subject || '').trim(),
    userType: ticket.userType,
    client: clientName,
    customer: clientName,
    clientMobile: mobile,
    customerMobile: mobile,
    clientEmail: email,
    customerEmail: email,
    email: email,
    category: ticket.category,
    priority: ticket.priority,
    description: ticket.description.trim(),
    status: ticket.status,
    assignedToId: ticket.assignedToId ? Number(ticket.assignedToId) : null,
  };
}

/* -------------------------------------------------- */
/* Small components                                   */
/* -------------------------------------------------- */

export function TicketIcon({ type }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (type === 'transfer') {
    return (
      <svg {...common} width={15} height={15}>
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    );
  }

  if (type === 'edit') {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </svg>
    );
  }

  if (type === 'view' || type === 'eye') {
    return (
      <svg {...common} width={15} height={15}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (type === 'description') {
    return (
      <svg {...common} width={15} height={15}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    );
  }

  if (type === 'log' || type === 'history') {
    return <span className="ticket-log-l-symbol">L</span>;
  }

  if (type === 'ask-admin' || type === 'help' || type === 'info' || type === 'i') {
    return (
      <svg {...common} width={14} height={14}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth={2.5} />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

/**
 * Shared form fields used by BOTH the Create and Edit dialogs.
 *
 * `values`   - the form state (ticketForm or editingTicket)
 * `onChange` - (field, value) => void, updates that same state
 * `idPrefix` - keeps element ids unique per dialog ("create" / "edit")
 *
 * Because both dialogs use this one component, the Assign To dropdown
 * can never be wired to the wrong state again.
 */
export function TicketFormFields({ values, onChange, employees, idPrefix, isAdmin }) {
  const id = (name) => `${idPrefix}-ticket-${name}`;
  const normCategory = String(values.category || '').trim().toLowerCase();
  const isCustomCategory =
    Boolean(values.isCustomCategory) ||
    (Boolean(normCategory) &&
      !['recharge', 'payment', 'wallet', 'technical'].includes(normCategory));
  const isStatusLocked =
    !isAdmin &&
    (idPrefix === 'edit' || idPrefix === 'db-edit') &&
    (values.originalStatus === 'resolved' || values.status === 'resolved');

  return (
    <div className="ticket-form-grid">
      <div className="ticket-form-field">
        <label htmlFor={id('client')}>Client Name *</label>
        <input
          id={id('client')}
          value={values.client ?? values.customer ?? ''}
          onChange={(e) => {
            onChange('client', e.target.value);
            onChange('customer', e.target.value);
          }}
          placeholder="Enter client name"
          required
        />
      </div>

      <div className="ticket-form-field">
        <label htmlFor={id('mobile')}>Mobile Number *</label>
        <input
          id={id('mobile')}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={values.clientMobile ?? values.customerMobile ?? ''}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            onChange('clientMobile', val);
            onChange('customerMobile', val);
          }}
          placeholder="10-digit mobile number"
          required
        />
      </div>
      <div className="ticket-form-field">
        <label htmlFor={id('email')}>Email</label>
        <input
          id={id('email')}
          type="email"
          value={values.clientEmail ?? values.customerEmail ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onChange('clientEmail', val);
            onChange('customerEmail', val);
          }}
          placeholder="Enter email address (optional)"
        />
      </div>

      <div className="ticket-form-field">
        <div className="ticket-field-label-row">
          <label htmlFor={isAdmin && isCustomCategory ? id('category-custom-input') : id('category-select')}>
            Category *
          </label>
          {isAdmin && isCustomCategory && (
            <div className="ticket-category-header-actions">
              <span className="ticket-char-counter">
                {(values.category || '').length}/75
              </span>
              <button
                type="button"
                className="ticket-category-switch-btn"
                title="Choose from preset categories"
                onClick={() => {
                  onChange('isCustomCategory', false);
                  onChange('category', 'recharge');
                }}
              >
                Choose from list ▾
              </button>
            </div>
          )}
        </div>

        {/* If custom category write-up is active, dropdown disappears and only the input box shows */}
        {isAdmin && isCustomCategory ? (
          <div className="ticket-category-custom-wrap">
            <input
              id={id('category-custom-input')}
              type="text"
              maxLength={75}
              value={values.category}
              onChange={(e) => onChange('category', e.target.value.slice(0, 75))}
              placeholder="Enter category name (up to 75 characters)..."
              autoFocus
              required
            />
          </div>
        ) : (
          /* Preset dropdown when not customizing */
          <select
            id={id('category-select')}
            value={
              ['recharge', 'payment', 'wallet', 'technical'].includes(
                String(values.category || '').toLowerCase()
              )
                ? String(values.category).toLowerCase()
                : 'recharge'
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'custom') {
                onChange('isCustomCategory', true);
                onChange('category', '');
              } else {
                onChange('isCustomCategory', false);
                onChange('category', val);
              }
            }}
          >
            <option value="recharge">Recharge</option>
            <option value="payment">Payment</option>
            <option value="wallet">Wallet</option>
            <option value="technical">Technical Issue</option>
            {isAdmin && <option value="custom">✍ (Type your own)...</option>}
          </select>
        )}
      </div>

      <div className="ticket-form-field">
        <label htmlFor={id('priority')}>Priority *</label>
        <select
          id={id('priority')}
          value={values.priority}
          onChange={(e) => onChange('priority', e.target.value)}
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="ticket-form-field">
        <label htmlFor={id('status')}>
          Status *
          {isStatusLocked && (
            <span style={{ fontSize: 11, fontWeight: 500, color: '#047857', marginLeft: 8 }}>
              🔒 Resolved (Admin only can re-open)
            </span>
          )}
        </label>
        <select
          id={id('status')}
          value={values.status}
          onChange={(e) => onChange('status', e.target.value)}
          disabled={isStatusLocked}
          style={isStatusLocked ? { background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' } : {}}
          title={isStatusLocked ? 'Only administrators can re-open or change the status of a resolved ticket.' : 'Select status'}
        >
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="ticket-form-field">
        <label htmlFor={id('assignedToId')}>Choose Support Staff</label>
        <select
          id={id('assignedToId')}
          value={values.assignedToId || ''}
          onChange={(e) => onChange('assignedToId', e.target.value)}
        >
          <option value="">Unassigned</option>
          {employees.map((employee) => (
            <option key={employee.id} value={String(employee.id)}>
              {employee.name} ({employee.mobileNumber})
            </option>
          ))}
        </select>
      </div>

      <div className="ticket-form-field ticket-form-full">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label htmlFor={id('description')} style={{ margin: 0 }}>Description *</label>
          <span style={{ fontSize: '11.5px', color: (values.description || '').length >= 250 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
            {(values.description || '').length}/250
          </span>
        </div>
        <textarea
          id={id('description')}
          rows={4}
          maxLength={250}
          value={values.description}
          onChange={(e) => onChange('description', e.target.value.slice(0, 250))}
          placeholder="Explain the issue in detail (max 250 characters)..."
          required
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------- */
/* Page                                               */
/* -------------------------------------------------- */

export default function TicketManagementPage() {
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [viewingTicket, setViewingTicket] = useState(null);
  const [viewingLogsTicket, setViewingLogsTicket] = useState(null);
  const [transferringTicket, setTransferringTicket] = useState(null);
  const [askAdminTicket, setAskAdminTicket] = useState(null);
  const [askEmployeeTicket, setAskEmployeeTicket] = useState(null);
  const [newlyCreatedTicketId, setNewlyCreatedTicketId] = useState(null);
  const [contactDialog, setContactDialog] = useState(null);

  const [ticketForm, setTicketForm] = useState(INITIAL_FORM);

  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [employeeError, setEmployeeError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [search, setSearch] = useState('');

  const isAdmin = getCurrentRole() === 'admin';

  /* ---------- Data loading ---------- */

  async function fetchTickets(isBackground = false) {
    try {
      if (!isBackground) {
        setLoading(true);
        setError('');
      }

      const response = await fetch(`${API}/tickets`, {
        headers: authHeaders(),
      });
      const data = await readResponse(response);

      const ticketList = Array.isArray(data.tickets) ? data.tickets : [];
      setTickets(ticketList);

      // Populate employees from incoming tickets if employees list is not yet populated
      setEmployees((prev) => {
        if (prev && prev.length > 0) return prev;
        const extracted = new Map();
        ticketList.forEach((t) => {
          if (
            t.assignedToId &&
            t.assignedTo &&
            String(t.assignedTo).trim().toLowerCase() !== 'unassigned'
          ) {
            extracted.set(String(t.assignedToId), {
              id: t.assignedToId,
              name: t.assignedTo,
              mobileNumber: t.assignedToMobile || '',
            });
          }
        });
        return Array.from(extracted.values());
      });
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Failed to load tickets.');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }

  async function fetchEmployees(ticketList) {
    try {
      setEmployeesLoading(true);
      setEmployeeError('');

      // 1. Try /api/tickets/employees first, then /api/users
      let res = await fetch(`${API}/tickets/employees`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        res = await fetch(`${API}/users`, {
          headers: authHeaders(),
        });
      }

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.employees) && data.employees.length > 0) {
          setEmployees(data.employees);
          setEmployeeError('');
          return;
        }
      }

      // 2. Fallback: extract unique employees from tickets
      const currentTickets = ticketList || tickets;
      const extracted = new Map();
      (currentTickets || []).forEach((t) => {
        if (
          t.assignedToId &&
          t.assignedTo &&
          String(t.assignedTo).trim().toLowerCase() !== 'unassigned'
        ) {
          extracted.set(String(t.assignedToId), {
            id: t.assignedToId,
            name: t.assignedTo,
            mobileNumber: t.assignedToMobile || '',
          });
        }
      });

      if (extracted.size > 0) {
        setEmployees(Array.from(extracted.values()));
        setEmployeeError('');
      } else if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setEmployeeError(errData.error || 'Failed to load employees.');
      }
    } catch (err) {
      const currentTickets = ticketList || tickets;
      const extracted = new Map();
      (currentTickets || []).forEach((t) => {
        if (
          t.assignedToId &&
          t.assignedTo &&
          String(t.assignedTo).trim().toLowerCase() !== 'unassigned'
        ) {
          extracted.set(String(t.assignedToId), {
            id: t.assignedToId,
            name: t.assignedTo,
            mobileNumber: t.assignedToMobile || '',
          });
        }
      });

      if (extracted.size > 0) {
        setEmployees(Array.from(extracted.values()));
        setEmployeeError('');
      } else {
        setEmployeeError(err.message || 'Failed to load employees.');
      }
    } finally {
      setEmployeesLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets(false);
    fetchEmployees();

    // Fast live auto-refresh every 1500ms
    const interval = setInterval(() => {
      fetchTickets(true);
    }, 1500);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    function handleFastSync() {
      fetchTickets(true);
    }
    window.addEventListener('tickets-updated', handleFastSync);
    window.addEventListener('storage', handleFastSync);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('tickets-updated', handleFastSync);
      window.removeEventListener('storage', handleFastSync);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage('');
    }, 2000);
    return () => clearTimeout(timer);
  }, [message]);

  /* ---------- Create ---------- */

  function updateTicketForm(field, value) {
    setTicketForm((previous) => ({ ...previous, [field]: value }));
  }

  function openCreateDialog() {
    setTicketForm(INITIAL_FORM);
    setFormError('');
    setError('');
    setMessage('');
    setShowCreateDialog(true);
  }

  function closeCreateDialog() {
    if (creatingTicket) return;
    setShowCreateDialog(false);
    setFormError('');
  }

  async function handleCreateTicket(event) {
    event.preventDefault();
    setFormError('');
    setError('');
    setMessage('');

    const validationError = validateTicket(ticketForm);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setCreatingTicket(true);

      const response = await fetch(`${API}/tickets`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(buildPayload(ticketForm)),
      });
      const data = await readResponse(response);

      setShowCreateDialog(false);
      setTicketForm(INITIAL_FORM);
      setMessage(data.message || 'Ticket created successfully.');

      if (data.ticket?.id) {
        setNewlyCreatedTicketId(data.ticket.id);
        setTimeout(() => {
          setNewlyCreatedTicketId(null);
        }, 15000);
      }

      if (data.ticket) {
        setTickets((prev) => [data.ticket, ...prev.filter((t) => t.id !== data.ticket.id)]);
      }

      window.dispatchEvent(
        new CustomEvent('tickets-updated', { detail: data.ticket })
      );
      if (data.notification) {
        window.dispatchEvent(
          new CustomEvent('notifications-updated', { detail: data.notification })
        );
      }
      try {
        localStorage.setItem('tickets_last_sync', String(Date.now()));
      } catch (e) {}

      await fetchTickets(true);
    } catch (err) {
      setFormError(err.message || 'Failed to create ticket.');
    } finally {
      setCreatingTicket(false);
    }
  }

  /* ---------- Edit ---------- */

  function openEditTicket(ticket) {
    setActionError('');
    setError('');
    setMessage('');

    setEditingTicket({
      id: ticket.id,
      subject: ticket.subject || '',
      userType: ticket.userType || 'client',
      client: ticket.client || ticket.customer || '',
      customer: ticket.client || ticket.customer || '',
      clientMobile: ticket.clientMobile || ticket.customerMobile || '',
      customerMobile: ticket.clientMobile || ticket.customerMobile || '',
      clientEmail: ticket.clientEmail || ticket.customerEmail || ticket.email || '',
      customerEmail: ticket.clientEmail || ticket.customerEmail || ticket.email || '',
      category: ticket.category || 'recharge',
      priority: ticket.priority || 'medium',
      description: ticket.description || '',
      assignedToId:
        ticket.assignedToId !== null && ticket.assignedToId !== undefined
          ? String(ticket.assignedToId)
          : '',
      status: ticket.status || 'open',
      originalStatus: ticket.status || 'open',
    });
  }

  function closeEditTicket() {
    if (savingTicket) return;
    setEditingTicket(null);
    setActionError('');
  }

  function updateEditingTicket(field, value) {
    setEditingTicket((previous) => ({ ...previous, [field]: value }));
  }

  async function handleUpdateTicket(event) {
    event.preventDefault();
    if (!editingTicket) return;

    setActionError('');

    if (editingTicket.originalStatus === 'resolved' && editingTicket.status !== 'resolved' && !isAdmin) {
      setActionError('Only administrators can re-open or change the status of a resolved ticket.');
      return;
    }

    const validationError = validateTicket(editingTicket);
    if (validationError) {
      setActionError(validationError);
      return;
    }

    try {
      setSavingTicket(true);

      const matchedEmployee = employees.find(
        (e) => String(e.id) === String(editingTicket.assignedToId)
      );
      const optimisticUpdate = {
        ...editingTicket,
        assignedTo: matchedEmployee ? matchedEmployee.name : null,
        assignedToId: matchedEmployee ? matchedEmployee.id : null,
        updatedAt: new Date().toISOString(),
      };
      setTickets((prev) =>
        prev.map((t) => (t.id === editingTicket.id ? { ...t, ...optimisticUpdate } : t))
      );

      const response = await fetch(
        `${API}/tickets/${encodeURIComponent(editingTicket.id)}`,
        {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(buildPayload(editingTicket)),
        }
      );
      const data = await readResponse(response);

      setEditingTicket(null);
      setMessage(data.message || 'Ticket updated successfully.');

      if (data.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === editingTicket.id ? { ...t, ...data.ticket } : t))
        );
      }

      window.dispatchEvent(
        new CustomEvent('tickets-updated', { detail: data.ticket || optimisticUpdate })
      );
      if (data.notification) {
        window.dispatchEvent(
          new CustomEvent('notifications-updated', { detail: data.notification })
        );
      }
      try {
        localStorage.setItem('tickets_last_sync', String(Date.now()));
      } catch (e) {}

      await fetchTickets(true);
    } catch (err) {
      setActionError(err.message || 'Failed to update ticket.');
      await fetchTickets(true);
    } finally {
      setSavingTicket(false);
    }
  }

  /* ---------- Delete ---------- */

  function openDeleteTicket(ticket) {
    setActionError('');
    setError('');
    setMessage('');
    setTicketToDelete(ticket);
  }

  function closeDeleteTicket() {
    if (deletingTicket) return;
    setTicketToDelete(null);
    setActionError('');
  }

  async function handleDeleteTicket() {
    if (!ticketToDelete) return;

    try {
      setDeletingTicket(true);
      setActionError('');

      const response = await fetch(
        `${API}/tickets/${encodeURIComponent(ticketToDelete.id)}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        }
      );
      const data = await readResponse(response);

      const deletedId = ticketToDelete.id;
      setTickets((previous) =>
        previous.filter((ticket) => String(ticket.id) !== String(deletedId))
      );

      window.dispatchEvent(
        new CustomEvent('tickets-updated', { detail: { id: deletedId, deleted: true } })
      );
      try {
        localStorage.setItem('tickets_last_sync', String(Date.now()));
      } catch (e) {}

      setTicketToDelete(null);
      setMessage(data.message || 'Ticket deleted successfully.');
    } catch (err) {
      setActionError(err.message || 'Failed to delete ticket.');
    } finally {
      setDeletingTicket(false);
    }
  }

  /* ---------- Inline Row Updates ---------- */

  async function handleInlineUpdate(ticket, field, value) {
    if (!ticket || !field) return;

    if (field === 'assignedToId') {
      const curId = ticket.assignedToId ? String(ticket.assignedToId) : '';
      const nId = value ? String(value) : '';
      if (curId === nId) return;
    } else if (ticket[field] === value) {
      return;
    }

    if (ticket.status === 'resolved' && field === 'status' && !isAdmin) {
      setActionError('Only administrators can re-open or change the status of a resolved ticket.');
      return;
    }

    const oldValue = ticket[field];
    const willBeResolved = field === 'status' && value === 'resolved';
    const nowIso = new Date().toISOString();
    const instantResolution = willBeResolved
      ? calculateResolutionTime(ticket.createdAt, nowIso)
      : (field === 'status' ? null : (ticket.resolution || ticket.resolutionTime));

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              [field]: value,
              ...(field === 'status'
                ? {
                    status: value,
                    resolvedAt: willBeResolved ? nowIso : null,
                    resolution: instantResolution,
                    resolutionTime: instantResolution,
                    resolvedBy: willBeResolved ? (t.assignedTo || 'Employee') : null,
                  }
                : {}),
              ...(field === 'assignedToId'
                ? {
                    assignedToId: value ? Number(value) : null,
                    assignedTo: value ? (employees.find((e) => String(e.id) === String(value))?.name || null) : null,
                  }
                : {}),
            }
          : t
      )
    );

    try {
      const res = await fetch(`${API}/tickets/${encodeURIComponent(ticket.id)}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ [field]: value }),
      });
      const data = await readResponse(res);
      if (!res.ok) {
        throw new Error(data.error || `Failed to update ${field}.`);
      }
      if (data.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticket.id ? { ...t, ...data.ticket } : t))
        );
      }

      window.dispatchEvent(
        new CustomEvent('tickets-updated', { detail: data.ticket || { id: ticket.id, [field]: value } })
      );
      if (data.notification) {
        window.dispatchEvent(
          new CustomEvent('notifications-updated', { detail: data.notification })
        );
      }
      try {
        localStorage.setItem('tickets_last_sync', String(Date.now()));
      } catch (e) {}

      const fieldTitle =
        field === 'priority'
          ? 'Priority'
          : field === 'status'
          ? 'Status'
          : field === 'assignedToId'
          ? 'Assignment'
          : capitalize(field);
      const oldFormatted =
        field === 'priority'
          ? capitalize(oldValue)
          : field === 'status'
          ? formatStatus(oldValue)
          : field === 'assignedToId'
          ? (ticket.assignedTo || 'Unassigned')
          : capitalize(oldValue);
      const newFormatted =
        field === 'priority'
          ? capitalize(value)
          : field === 'status'
          ? formatStatus(value)
          : field === 'assignedToId'
          ? (value ? (employees.find((e) => String(e.id) === String(value))?.name || 'Assigned') : 'Unassigned')
          : capitalize(value);

      setMessage(
        `✓ Ticket #${ticket.id}: ${fieldTitle} changed from "${oldFormatted}" to "${newFormatted}".`
      );
    } catch (err) {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id
            ? {
                ...t,
                [field]: oldValue,
                ...(field === 'assignedToId'
                  ? {
                      assignedToId: ticket.assignedToId,
                      assignedTo: ticket.assignedTo,
                    }
                  : {}),
              }
            : t
        )
      );
      setActionError(err.message || `Failed to update ${field}.`);
    }
  }

  /* ---------- Derived data ---------- */

  function isTicketUnassigned(ticket) {
    if (!ticket) return true;
    const hasValidId =
      ticket.assignedToId !== null &&
      ticket.assignedToId !== undefined &&
      ticket.assignedToId !== '' &&
      ticket.assignedToId !== 0;
    const hasValidName =
      Boolean(ticket.assignedTo) &&
      String(ticket.assignedTo).trim().toLowerCase() !== 'unassigned' &&
      String(ticket.assignedTo).trim() !== '';

    return !hasValidId && !hasValidName;
  }

  function getAssignedName(ticket) {
    return (
      ticket.assignedTo ||
      employees.find(
        (employee) => String(employee.id) === String(ticket.assignedToId)
      )?.name ||
      'Unassigned'
    );
  }

  const searchText = search.trim().toLowerCase();

  const filteredTickets = [...tickets]
    .filter((ticket) => {
      const matchesStatus =
        statusFilter === 'all' || ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'all' || ticket.priority === priorityFilter;

      const matchesCategory =
        categoryFilter === 'all' || ticket.category === categoryFilter;

      const matchesAssignment =
        assignmentFilter === 'all'
          ? true
          : assignmentFilter === 'unassigned'
          ? isTicketUnassigned(ticket)
          : !isTicketUnassigned(ticket);

      let matchesStaff = true;
      if (staffFilter === 'unassigned') {
        matchesStaff = isTicketUnassigned(ticket);
      } else if (staffFilter !== 'all') {
        const emp = employees.find((e) => String(e.id) === String(staffFilter));
        const empName = emp ? emp.name.toLowerCase() : '';
        matchesStaff =
          String(ticket.assignedToId) === String(staffFilter) ||
          (ticket.assignedTo && empName && ticket.assignedTo.toLowerCase() === empName);
      }

      const assignedName = getAssignedName(ticket);

      const matchesSearch =
        !searchText ||
        [
          ticket.id,
          ticket.createdBy,
          assignedName,
        ].some((value) =>
          String(value || '').toLowerCase().includes(searchText)
        );

      return (
        matchesStatus &&
        matchesPriority &&
        matchesCategory &&
        matchesAssignment &&
        matchesStaff &&
        matchesSearch
      );
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
        return timeB - timeA;
      }
      return String(b.id || '').localeCompare(String(a.id || ''), undefined, {
        numeric: true,
      });
    });

  /* ---------- Render ---------- */

  return (
    <div className="ticket-management">
      <div className="ticket-page-header">
        <div>
          <h1 className="db-page-title">Manage Tickets</h1>
        </div>

        <div className="ticket-header-actions">
          {/* Create Ticket Button */}
          <button
            type="button"
            className="ticket-create-button"
            onClick={openCreateDialog}
          >
            + Create Ticket
          </button>
        </div>
      </div>

      {isAdmin ? (
        <div className="ticket-controls">
          <input
            className="ticket-search"
            type="search"
            placeholder="Search ticket ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search tickets"
          />

          <div className="ticket-filters-column">
            <select
              className="ticket-filter-select select-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              className="ticket-filter-select select-category-filter"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              <option value="recharge">Recharge</option>
              <option value="payment">Payment</option>
              <option value="wallet">Wallet</option>
              <option value="technical">Technical Issue</option>
            </select>

            <select
              className="ticket-filter-select select-priority-filter"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label="Filter by priority"
            >
              <option value="all">All priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select
              className="ticket-filter-select select-staff-filter"
              value={staffFilter}
              onChange={(event) => setStaffFilter(event.target.value)}
              aria-label="Choose support staff"
            >
              <option value="all">All Employees</option>
              <option value="unassigned">Unassigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.name}
                </option>
              ))}
            </select>

            {(search || statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || staffFilter !== 'all') && (
              <button
                type="button"
                className="ticket-clear-filters-btn client-clear-filters-btn"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setPriorityFilter('all');
                  setStaffFilter('all');
                }}
                title="Reset all filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="ticket-employee-controls"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 20,
            flexWrap: 'wrap',
            background: '#ffffff',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>
              Choose All Employees:
            </span>
            <select
              id="employee-staff-filter"
              className="ticket-filter-select select-staff-filter"
              value={staffFilter}
              onChange={(event) => setStaffFilter(event.target.value)}
              aria-label="Choose support staff from the dropdown"
              style={{ minWidth: 220 }}
            >
              <option value="all">All Employees</option>
              <option value="unassigned">Unassigned Tickets</option>
              {employees.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.name} ({emp.mobileNumber || 'Support'})
                </option>
              ))}
            </select>
          </div>
          {staffFilter !== 'all' && (
            <button
              type="button"
              className="db-clear-card-filter-btn"
              onClick={() => setStaffFilter('all')}
              style={{ padding: '6px 12px' }}
            >
              ✕ Reset to All Support Staff
            </button>
          )}
        </div>
      )}

      {message && (
        <div className="ticket-notice ticket-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="ticket-notice ticket-error" role="alert">
          {error}
        </div>
      )}

      {employeeError && employees.length === 0 && (
        <div className="ticket-notice ticket-error" role="alert">
          {employeeError} Use Refresh to try loading employees again.
        </div>
      )}

      {isAdmin && !employeesLoading && !employeeError && employees.length === 0 && (
        <div className="ticket-notice">
          No employees found. Create an employee before assigning tickets.
        </div>
      )}

      <div className="db-card ticket-table-card">
        {loading ? (
          <div className="ticket-message">Loading tickets...</div>
        ) : error && tickets.length === 0 ? (
          <div className="ticket-message ticket-error">
            Could not load tickets.
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="ticket-empty-state">
            <div className="ticket-empty-icon">◇</div>
            <h3>
              {tickets.length === 0 ? 'No tickets yet' : 'No matching tickets'}
            </h3>
            <p>
              {tickets.length === 0
                ? 'Tickets will appear here when support requests are submitted.'
                : 'Try changing your search or filter selections.'}
            </p>
          </div>
        ) : (
          <>
            <div className="ticket-results-count">
              Showing {filteredTickets.length}{' '}
              {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
            </div>

            <div className="ticket-table-scroll">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Client</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th style={{ width: 140 }}>Resolution time</th>
                    <th style={{ minWidth: 150 }}>Assigned To</th>
                    <th>Created at / Solved at</th>
                    <th className="ticket-actions-header">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTickets.map((ticket) => {
                    const isResolved = ticket.status === 'resolved';
                    const isNew = !isResolved && isTicketNew(ticket.createdAt, ticket.status);
                    const isJustCreated = !isResolved && newlyCreatedTicketId === ticket.id;

                    const currentAssignedId = (() => {
                      if (
                        ticket.assignedToId !== null &&
                        ticket.assignedToId !== undefined &&
                        ticket.assignedToId !== '' &&
                        ticket.assignedToId !== 0
                      ) {
                        return String(ticket.assignedToId);
                      }
                      if (
                        ticket.assignedTo &&
                        String(ticket.assignedTo).trim().toLowerCase() !== 'unassigned'
                      ) {
                        const matched = employees.find(
                          (e) =>
                            String(e.name).trim().toLowerCase() ===
                            String(ticket.assignedTo).trim().toLowerCase()
                        );
                        if (matched) return String(matched.id);
                        return `custom_${ticket.assignedTo}`;
                      }
                      return '';
                    })();

                    return (
                      <tr
                        key={ticket.id}
                        className={`${isResolved ? 'db-row-resolved' : ''} ${isNew ? 'db-row-new' : ''} ${isJustCreated ? 'ticket-row-just-created' : ''}`.trim()}
                      >
                        {/* 1. Ticket ID */}
                        <td className="db-mono">
                          <div className="ticket-id-cell">
                            <span
                              className="ticket-id-text"
                              style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
                              title="Click to view ticket details"
                              onClick={() => setViewingTicket(ticket)}
                            >
                              {ticket.id}
                            </span>
                            {isNew && (
                              <span className="ticket-new-badge" title="Created recently">
                                NEW
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Client */}
                        <td>
                          <div className="ticket-client-cell">
                            <div
                              className="ticket-client-avatar"
                              title={ticket.client || ticket.customer || ticket.createdBy || 'Client'}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            </div>
                            <div className="ticket-client-info">
                              <span className="ticket-client-name">
                                {ticket.client || ticket.customer || ticket.createdBy || '—'}
                              </span>
                              {(ticket.clientMobile || ticket.customerMobile) && (
                                <button
                                  type="button"
                                  className="ticket-client-phone"
                                  title={`Contact ${ticket.client || ticket.customer || 'client'} (${ticket.clientMobile || ticket.customerMobile})`}
                                  aria-label={`Contact ${ticket.client || ticket.customer || 'client'} at ${ticket.clientMobile || ticket.customerMobile}`}
                                  onClick={() =>
                                    setContactDialog({
                                      name: ticket.client || ticket.customer || ticket.createdBy || 'Client',
                                      phone: ticket.clientMobile || ticket.customerMobile,
                                      email: ticket.clientEmail || ticket.customerEmail || ticket.email || '',
                                    })
                                  }
                                >
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                  </svg>
                                  <span>{ticket.clientMobile || ticket.customerMobile}</span>
                                </button>
                              )}
                              {(ticket.clientEmail || ticket.customerEmail || ticket.email) && (
                                <a
                                  href={`mailto:${ticket.clientEmail || ticket.customerEmail || ticket.email}`}
                                  className="ticket-client-email"
                                  title={`Send email to ${ticket.client || ticket.customer || 'client'} (${ticket.clientEmail || ticket.customerEmail || ticket.email})`}
                                  aria-label={`Send email to ${ticket.client || ticket.customer || 'client'} at ${ticket.clientEmail || ticket.customerEmail || ticket.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <rect width="20" height="16" x="2" y="4" rx="2" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                  </svg>
                                  <span>{ticket.clientEmail || ticket.customerEmail || ticket.email}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Category */}
                        <td>
                          <div className="ticket-row-cell-wrap" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                            <select
                              className="ticket-row-badge-select"
                              style={{
                                color: '#334155',
                                backgroundColor: '#ffffff',
                                borderColor: '#e2e8f0',
                              }}
                              value={
                                ['recharge', 'payment', 'wallet', 'technical'].includes(
                                  String(ticket.category || '').toLowerCase()
                                )
                                  ? String(ticket.category).toLowerCase()
                                  : 'custom_current'
                              }
                              onChange={(e) =>
                                handleInlineUpdate(ticket, 'category', e.target.value)
                              }
                              title="Select category"
                            >
                              <option value="recharge">Recharge</option>
                              <option value="payment">Payment</option>
                              <option value="wallet">Wallet</option>
                              <option value="technical">Technical</option>
                              {!['recharge', 'payment', 'wallet', 'technical'].includes(
                                String(ticket.category || '').toLowerCase()
                              ) && (
                                <option value="custom_current">
                                  {capitalize(ticket.category || 'Custom')}
                                </option>
                              )}
                            </select>
                            {(ticket.providerName || ticket.operator) && (
                              <span
                                className="ticket-provider-badge"
                                title={`Provider: ${ticket.providerName || ticket.operator}`}
                                style={{
                                  fontSize: '11px',
                                  color: '#475569',
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontWeight: 500,
                                  maxWidth: '130px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'inline-block',
                                }}
                              >
                                {ticket.providerName || ticket.operator}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Priority */}
                        <td>
                          <div className="ticket-row-cell-wrap">
                            <select
                              className="ticket-row-badge-select"
                              style={{
                                color: ticket.priority === 'high' ? '#dc2626' : '#334155',
                                backgroundColor: '#ffffff',
                                borderColor: ticket.priority === 'high' ? '#fecaca' : '#e2e8f0',
                                fontWeight: ticket.priority === 'high' ? 600 : 500,
                              }}
                              value={ticket.priority || 'medium'}
                              onChange={(e) =>
                                handleInlineUpdate(ticket, 'priority', e.target.value)
                              }
                              title="Select priority"
                            >
                              <option value="low">● Low</option>
                              <option value="medium">● Medium</option>
                              <option value="high">● High</option>
                            </select>
                          </div>
                        </td>

                        {/* 5. Status */}
                        <td>
                          <div className="ticket-row-cell-wrap">
                            {ticket.status === 'resolved' && !isAdmin ? (
                              <span
                                className="ticket-status-locked-badge"
                                title="Resolved tickets can only be changed by an administrator."
                              >
                                <svg
                                  width="11"
                                  height="11"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ marginRight: 4, flexShrink: 0 }}
                                >
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Resolved
                              </span>
                            ) : (
                              <select
                                className="ticket-row-badge-select"
                                style={{
                                  color: '#334155',
                                  backgroundColor: '#ffffff',
                                  borderColor: '#e2e8f0',
                                }}
                                value={ticket.status || 'open'}
                                onChange={(e) =>
                                  handleInlineUpdate(ticket, 'status', e.target.value)
                                }
                                title="Select status"
                              >
                                <option value="open">Open</option>
                                <option value="in-progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                              </select>
                            )}
                          </div>
                        </td>

                        {/* 6. Resolution time */}
                        <td>
                          {ticket.status === 'resolved' ? (
                            <span
                              className="db-resolution-badge resolved"
                              title={
                                ticket.resolvedAt
                                  ? `Resolved at ${formatDate(ticket.resolvedAt)}${
                                      ticket.resolvedBy ? ` by ${ticket.resolvedBy}` : ''
                                    }`
                                  : 'Resolved'
                              }
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              {ticket.resolution ||
                                ticket.resolutionTime ||
                                (ticket.resolvedAt
                                  ? calculateResolutionTime(ticket.createdAt, ticket.resolvedAt)
                                  : '< 1 min')}
                            </span>
                          ) : (
                            <span className="db-resolution-badge pending">
                              Pending
                            </span>
                          )}
                        </td>

                        {/* 7. Assigned To */}
                        <td>
                          {isAdmin ? (
                            <div className="ticket-row-cell-wrap">
                              <select
                                className="ticket-row-badge-select ticket-row-assigned-select"
                                style={{
                                  color: currentAssignedId ? '#1e293b' : '#94a3b8',
                                  backgroundColor: '#ffffff',
                                  borderColor: '#e2e8f0',
                                  fontWeight: currentAssignedId ? 600 : 400,
                                }}
                                value={currentAssignedId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val || val.startsWith('custom_')) {
                                    handleInlineUpdate(ticket, 'assignedToId', '');
                                  } else {
                                    handleInlineUpdate(ticket, 'assignedToId', Number(val));
                                  }
                                }}
                                title="Assign support staff"
                              >
                                <option value="" style={{ color: '#94a3b8' }}>
                                  Unassigned
                                </option>
                                {employees.map((emp) => (
                                  <option
                                    key={emp.id}
                                    value={String(emp.id)}
                                    style={{ color: '#1e293b' }}
                                  >
                                    {emp.name}
                                  </option>
                                ))}
                                {currentAssignedId.startsWith('custom_') && (
                                  <option value={currentAssignedId} style={{ color: '#1e293b' }}>
                                    {ticket.assignedTo}
                                  </option>
                                )}
                              </select>
                            </div>
                          ) : (
                            <span>{getAssignedName(ticket)}</span>
                          )}
                        </td>

                        {/* 8. Created at / Solved at */}
                        <td>
                          <div className="ticket-dates-wrap">
                            <div
                              className="ticket-date-row created"
                              title={`Created: ${formatDate(ticket.createdAt)}`}
                            >
                              <span className="ticket-date-label">Created:</span>
                              <span className="ticket-date-val">
                                {formatDate(ticket.createdAt)}
                              </span>
                            </div>
                            <div
                              className={`ticket-date-row solved ${
                                ticket.resolvedAt || ticket.solvedAt ? 'is-resolved' : 'is-pending'
                              }`}
                              title={
                                ticket.resolvedAt || ticket.solvedAt
                                  ? `Solved: ${formatDate(ticket.resolvedAt || ticket.solvedAt)}`
                                  : 'Not solved yet'
                              }
                            >
                              <span className="ticket-date-label">Solved:</span>
                              <span className="ticket-date-val">
                                {ticket.resolvedAt || ticket.solvedAt
                                  ? formatDate(ticket.resolvedAt || ticket.solvedAt)
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 9. Actions */}
                        <td className="ticket-actions-cell">
                          <div className="ticket-row-actions">
                            {/* Column 1: View & Transfer History (Log) */}
                            <div className="ticket-action-col">
                              <button
                                type="button"
                                className="ticket-icon-button ticket-view-icon"
                                title="View ticket details"
                                aria-label={`View ticket ${ticket.id} details`}
                                onClick={() => setViewingTicket(ticket)}
                              >
                                <TicketIcon type="view" />
                              </button>

                              <button
                                type="button"
                                className="ticket-icon-button ticket-log-icon"
                                title="View Transfer History"
                                aria-label={`View transfer history for ticket ${ticket.id}`}
                                onClick={() => setViewingLogsTicket(ticket)}
                              >
                                <TicketIcon type="log" />
                              </button>
                            </div>

                            {/* Column 2: Edit & Delete */}
                            <div className="ticket-action-col">
                              <button
                                type="button"
                                className="ticket-icon-button ticket-edit-icon"
                                title="Edit ticket"
                                aria-label={`Edit ticket ${ticket.id}`}
                                onClick={() => openEditTicket(ticket)}
                              >
                                <TicketIcon type="edit" />
                              </button>

                              <button
                                type="button"
                                className="ticket-icon-button ticket-delete-icon"
                                title="Delete ticket"
                                aria-label={`Delete ticket ${ticket.id}`}
                                onClick={() => openDeleteTicket(ticket)}
                              >
                                <TicketIcon type="delete" />
                              </button>
                            </div>

                            {/* Column 3: Query & Transfer */}
                            <div className="ticket-action-col">
                              {!isAdmin ? (
                                <button
                                  type="button"
                                  className="ticket-icon-button ticket-ask-admin-icon"
                                  title="Ask Admin for Help"
                                  aria-label={`Ask admin for help on ticket ${ticket.id}`}
                                  onClick={() => setAskAdminTicket(ticket)}
                                >
                                  <TicketIcon type="ask-admin" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="ticket-icon-button ticket-ask-employee-icon"
                                  title="Ask Employee / Query"
                                  aria-label={`Ask employee on ticket ${ticket.id}`}
                                  onClick={() => setAskEmployeeTicket(ticket)}
                                >
                                  <TicketIcon type="ask-admin" />
                                </button>
                              )}

                              {!isAdmin && (
                                <button
                                  type="button"
                                  className="ticket-icon-button ticket-transfer-icon"
                                  title="Transfer To"
                                  aria-label={`Transfer ticket ${ticket.id} to another employee`}
                                  onClick={() => setTransferringTicket(ticket)}
                                >
                                  <TicketIcon type="transfer" />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* CREATE TICKET DIALOG */}
      {showCreateDialog && (
        <div
          className="ticket-dialog-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateDialog();
          }}
        >
          <section
            className="ticket-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-ticket-title"
          >
            <div className="ticket-dialog-header">
              <div>
                <h2 id="create-ticket-title">Create Ticket</h2>
                <p>Enter the details of the support request.</p>
              </div>

              <button
                type="button"
                className="ticket-dialog-close"
                onClick={closeCreateDialog}
                disabled={creatingTicket}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            {formError && (
              <div className="ticket-dialog-error" role="alert">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTicket}>
              <TicketFormFields
                idPrefix="create"
                values={ticketForm}
                onChange={updateTicketForm}
                employees={employees}
                isAdmin={isAdmin}
              />

              {employeeError && (
                <p className="ticket-form-hint">
                  Employee list unavailable. You can create the ticket without
                  assigning an employee.
                </p>
              )}

              <div className="ticket-dialog-actions">
                <button
                  type="button"
                  className="ticket-cancel-button"
                  onClick={closeCreateDialog}
                  disabled={creatingTicket}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ticket-create-button"
                  disabled={creatingTicket}
                >
                  {creatingTicket ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* EDIT TICKET DIALOG */}
      {editingTicket && (
        <div className="ticket-dialog-overlay">
          <section
            className="ticket-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-ticket-title"
          >
            <div className="ticket-dialog-header">
              <div>
                <h2 id="edit-ticket-title">Edit Ticket</h2>
                <p>Update ticket #{editingTicket.id} details.</p>
              </div>

              <button
                type="button"
                className="ticket-dialog-close"
                onClick={closeEditTicket}
                disabled={savingTicket}
                aria-label="Close edit dialog"
              >
                ×
              </button>
            </div>

            {actionError && (
              <div className="ticket-dialog-error" role="alert">
                {actionError}
              </div>
            )}

            <form onSubmit={handleUpdateTicket}>
              <TicketFormFields
                idPrefix="edit"
                values={editingTicket}
                onChange={updateEditingTicket}
                employees={employees}
                isAdmin={isAdmin}
              />

              <div className="ticket-dialog-actions">
                <button
                  type="button"
                  className="ticket-cancel-button"
                  onClick={closeEditTicket}
                  disabled={savingTicket}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ticket-create-button"
                  disabled={savingTicket}
                >
                  {savingTicket ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {ticketToDelete && (
        <div className="ticket-dialog-overlay">
          <section
            className="ticket-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ticket-title"
          >
            <div className="ticket-delete-symbol">
              <TicketIcon type="delete" />
            </div>

            <h2 id="delete-ticket-title">Delete Ticket?</h2>

            <p>
              Are you sure you want to delete ticket{' '}
              <strong>#{ticketToDelete.id}</strong>?{' '}
              This action cannot be undone.
            </p>

            {actionError && (
              <div className="ticket-dialog-error" role="alert">
                {actionError}
              </div>
            )}

            <div className="ticket-dialog-actions">
              <button
                type="button"
                className="ticket-cancel-button"
                onClick={closeDeleteTicket}
                disabled={deletingTicket}
              >
                Cancel
              </button>

              <button
                type="button"
                className="ticket-confirm-delete"
                onClick={handleDeleteTicket}
                disabled={deletingTicket}
              >
                {deletingTicket ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* VIEW DESCRIPTION DIALOG */}
      {viewingTicket && (
        <div
          className="ticket-dialog-overlay"
          onClick={() => setViewingTicket(null)}
        >
          <section
            className="ticket-dialog ticket-desc-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-desc-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ticket-dialog-header">
              <div>
                <h2 id="view-desc-title">Ticket Details</h2>
                <p>
                  Ticket #{viewingTicket.id}
                </p>
              </div>

              <button
                type="button"
                className="ticket-dialog-close"
                onClick={() => setViewingTicket(null)}
                aria-label="Close details dialog"
              >
                ×
              </button>
            </div>

            <div className="ticket-desc-content">
              <div className="ticket-desc-meta">
                <div className="ticket-desc-meta-item">
                  <span className="ticket-desc-meta-label">Category:</span>
                  <span
                    className="ticket-category"
                    style={{
                      color: '#334155',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '2px 8px',
                      fontSize: '11px',
                    }}
                  >
                    {capitalize(viewingTicket.category)}
                  </span>
                </div>

                {(viewingTicket.providerName || viewingTicket.operator) && (
                  <div className="ticket-desc-meta-item">
                    <span className="ticket-desc-meta-label">Provider:</span>
                    <span
                      style={{
                        color: '#0f172a',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {viewingTicket.providerName || viewingTicket.operator}
                    </span>
                  </div>
                )}

                <div className="ticket-desc-meta-item">
                  <span className="ticket-desc-meta-label">Priority:</span>
                  <span
                    className="ticket-priority"
                    style={{
                      color: viewingTicket.priority === 'high' ? '#dc2626' : '#334155',
                      fontWeight: viewingTicket.priority === 'high' ? 600 : 500,
                    }}
                  >
                    <span
                      className="ticket-status-dot"
                      style={{
                        background: viewingTicket.priority === 'high' ? '#dc2626' : '#94a3b8',
                      }}
                    />
                    {capitalize(viewingTicket.priority)}
                  </span>
                </div>

                <div className="ticket-desc-meta-item">
                  <span className="ticket-desc-meta-label">Status:</span>
                  <span
                    className="ticket-status"
                    style={{
                      color: '#334155',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '2px 8px',
                      fontSize: '11px',
                    }}
                  >
                    {formatStatus(viewingTicket.status)}
                  </span>
                </div>

                <div className="ticket-desc-meta-item">
                  <span className="ticket-desc-meta-label">Assigned:</span>
                  <span
                    className="ticket-assigned-status"
                    style={{
                      color: viewingTicket.assignedTo ? '#0f172a' : '#64748b',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '2px 8px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: viewingTicket.assignedTo ? 600 : 500,
                    }}
                  >
                    <span
                      className="ticket-status-dot"
                      style={{
                        background: viewingTicket.assignedTo ? '#10b981' : '#94a3b8',
                      }}
                    />
                    {viewingTicket.assignedTo
                      ? `Assigned (${viewingTicket.assignedTo})`
                      : 'Not Assigned'}
                  </span>
                </div>

                {(viewingTicket.client || viewingTicket.customer) && (
                  <div className="ticket-desc-meta-item">
                    <span className="ticket-desc-meta-label">Client:</span>
                    <span>{viewingTicket.client || viewingTicket.customer}</span>
                  </div>
                )}

                {(viewingTicket.clientMobile || viewingTicket.customerMobile) && (
                  <div className="ticket-desc-meta-item">
                    <span className="ticket-desc-meta-label">Mobile:</span>
                    <button
                      type="button"
                      className="ticket-client-phone"
                      title={`Contact ${viewingTicket.client || viewingTicket.customer || 'client'} (${viewingTicket.clientMobile || viewingTicket.customerMobile})`}
                      onClick={() =>
                        setContactDialog({
                          name: viewingTicket.client || viewingTicket.customer || 'Client',
                          phone: viewingTicket.clientMobile || viewingTicket.customerMobile,
                          email: viewingTicket.clientEmail || viewingTicket.customerEmail || viewingTicket.email || '',
                        })
                      }
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span>{viewingTicket.clientMobile || viewingTicket.customerMobile}</span>
                    </button>
                  </div>
                )}

                {(viewingTicket.clientEmail || viewingTicket.customerEmail || viewingTicket.email) && (
                  <div className="ticket-desc-meta-item">
                    <span className="ticket-desc-meta-label">Email:</span>
                    <a
                      href={`mailto:${viewingTicket.clientEmail || viewingTicket.customerEmail || viewingTicket.email}`}
                      className="ticket-client-email"
                      title={`Send email to ${viewingTicket.client || viewingTicket.customer || 'client'} (${viewingTicket.clientEmail || viewingTicket.customerEmail || viewingTicket.email})`}
                      aria-label={`Send email to ${viewingTicket.client || viewingTicket.customer || 'client'} at ${viewingTicket.clientEmail || viewingTicket.customerEmail || viewingTicket.email}`}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      <span>{viewingTicket.clientEmail || viewingTicket.customerEmail || viewingTicket.email}</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="ticket-desc-body">
                <label className="ticket-desc-label">Description</label>
                <div className="ticket-desc-text">
                  {viewingTicket.description || 'No description provided.'}
                </div>

                {/* Conditional Transaction Details if ticket was raised with transaction info */}
                {(viewingTicket.transactionId || viewingTicket.amount || viewingTicket.providerName || viewingTicket.operator) && (
                  <div style={{ marginTop: '12px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect width="20" height="14" x="2" y="5" rx="2" />
                        <line x1="2" x2="22" y1="10" y2="10" />
                      </svg>
                      <span>Transaction & Payment Details</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px 14px', fontSize: '12px' }}>
                      {viewingTicket.transactionId && (
                        <div>
                          <span style={{ color: '#64748b' }}>Txn / UTR: </span>
                          <strong style={{ color: '#0f172a' }}>{viewingTicket.transactionId}</strong>
                        </div>
                      )}
                      {viewingTicket.amount !== undefined && viewingTicket.amount !== null && viewingTicket.amount !== '' && (
                        <div>
                          <span style={{ color: '#64748b' }}>Amount: </span>
                          <strong style={{ color: '#0f172a' }}>₹{Number(viewingTicket.amount).toLocaleString('en-IN')}</strong>
                        </div>
                      )}
                      {(viewingTicket.providerName || viewingTicket.operator) && (
                        <div>
                          <span style={{ color: '#64748b' }}>Provider / Operator: </span>
                          <strong style={{ color: '#0f172a' }}>{viewingTicket.providerName || viewingTicket.operator}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Optional Screenshot Attachment */}
                {viewingTicket.screenshot && (
                  <div style={{ marginTop: '12px' }}>
                    <label className="ticket-desc-label">Attachment / Screenshot</label>
                    <div style={{ marginTop: '6px' }}>
                      <a
                        href={viewingTicket.screenshot}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Click to view full image in a new tab"
                        style={{ display: 'inline-block' }}
                      >
                        <img
                          src={viewingTicket.screenshot}
                          alt="Ticket Attachment Preview"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '200px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="ticket-dialog-actions ticket-view-dialog-actions">
              <button
                type="button"
                className="ticket-view-logs-btn"
                onClick={() => {
                  const t = viewingTicket;
                  setViewingTicket(null);
                  setViewingLogsTicket(t);
                }}
                title="View complete audit & change logs for this ticket"
              >
                <TicketIcon type="log" />
                <span>View Ticket Logs</span>
              </button>

              <button
                type="button"
                className="ticket-view-close-btn"
                onClick={() => setViewingTicket(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════
          TICKET LOGS POP-UP DIALOG
      ═══════════════════════════════════════ */}
      {viewingLogsTicket && (
        <TicketLogsDialog
          ticket={viewingLogsTicket}
          onClose={() => setViewingLogsTicket(null)}
        />
      )}

      {/* ═══════════════════════════════════════
          TRANSFER TICKET POP-UP DIALOG (EMPLOYEE)
      ═══════════════════════════════════════ */}
      {transferringTicket && (
        <TransferTicketDialog
          ticket={transferringTicket}
          onClose={() => setTransferringTicket(null)}
        />
      )}

      {/* ═══════════════════════════════════════
          ASK ADMIN FOR HELP POP-UP DIALOG (EMPLOYEE)
      ═══════════════════════════════════════ */}
      {askAdminTicket && (
        <AskAdminDialog
          ticket={askAdminTicket}
          onClose={() => setAskAdminTicket(null)}
        />
      )}

      {/* ═══════════════════════════════════════
          ASK EMPLOYEE POP-UP DIALOG (ADMIN)
      ═══════════════════════════════════════ */}
      {askEmployeeTicket && (
        <AskEmployeeDialog
          ticket={askEmployeeTicket}
          employees={employees}
          onClose={() => setAskEmployeeTicket(null)}
        />
      )}

      {/* ═══════════════════════════════════════
          CONTACT CLIENT POP-UP DIALOG
      ═══════════════════════════════════════ */}
      <ContactClientDialog
        contact={contactDialog}
        onClose={() => setContactDialog(null)}
      />
    </div>
  );
}
