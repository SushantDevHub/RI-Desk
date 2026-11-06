import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  clearToken,
  getToken,
  changePassword,
} from '../api/authApi.js';
import TicketManagementPage from './TicketManagementPage.jsx';
import EmployeeListPage from './EmployeeListPage.jsx';
import CreateEmployeePage from './CreateEmployeePage.jsx';
import ContactCustomerDialog from '../components/ContactCustomerDialog.jsx';
import './DashboardPage.css';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function initials(name = '') {
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Priority styles
───────────────────────────────────────────── */

const PRIORITY_ORDER = {
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_STYLE = {
  high: {
    bg: '#fff1f2',
    color: '#e11d48',
    dot: '#e11d48',
  },

  medium: {
    bg: '#fffbeb',
    color: '#d97706',
    dot: '#d97706',
  },

  low: {
    bg: '#ecfdf5',
    color: '#059669',
    dot: '#059669',
  },
};

const STATUS_COLORS = {
  open: '#2563eb',
  'in-progress': '#d97706',
  resolved: '#059669',
};

const STATUS_BACKGROUNDS = {
  open: '#eff6ff',
  'in-progress': '#fffbeb',
  resolved: '#ecfdf5',
};

const CATEGORY_COLORS = {
  recharge: '#7c3aed',
  payment: '#0891b2',
  wallet: '#d97706',
  technical: '#e11d48',
};

const CATEGORY_BACKGROUNDS = {
  recharge: '#f5f3ff',
  payment: '#ecfeff',
  wallet: '#fffbeb',
  technical: '#fff1f2',
};

function getCategoryColor(cat = '') {
  const key = String(cat).toLowerCase();
  return CATEGORY_COLORS[key] || '#4f46e5';
}

function getCategoryBg(cat = '') {
  const key = String(cat).toLowerCase();
  return CATEGORY_BACKGROUNDS[key] || '#eef2ff';
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

/* ─────────────────────────────────────────────
   Main navigation
───────────────────────────────────────────── */

const NAV = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
];

/* ─────────────────────────────────────────────
   Dashboard Page
───────────────────────────────────────────── */

export default function DashboardPage({
  user,
  onLogout,
}) {
  const navigate = useNavigate();

  /* ── Navigation state ── */

  const [active, setActive] = useState('dashboard');
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactDialog, setContactDialog] = useState(null);

  /* ── User dropdown & change password modal state ── */
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const userDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  function resetPasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError('');
    setPasswordSuccess('');
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await changePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      setPasswordSuccess(res.message || 'Password changed successfully!');

      setTimeout(() => {
        resetPasswordForm();
        setShowPasswordModal(false);
      }, 1000);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  }

  /* ── Ticket state ── */

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [resolvingId, setResolvingId] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [viewingTicket, setViewingTicket] = useState(null);
  const [selectedStat, setSelectedStat] = useState(null);

  /* ── Role ── */

  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  /* ── Auto-dismiss notice ── */

  useEffect(() => {
    if (!noticeMessage) return;
    const timer = setTimeout(() => setNoticeMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [noticeMessage]);

  /* ─────────────────────────────────────────────
     Fetch tickets
  ───────────────────────────────────────────── */

  useEffect(() => {
    let isMounted = true;

    async function fetchTickets(isBackground = false) {
      try {
        if (!isBackground) {
          setLoading(true);
        }

        const res = await fetch(
          'http://localhost:4000/api/tickets',
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error || 'Failed to load tickets.'
          );
        }

        if (isMounted) {
          setTickets(data.tickets || []);
        }
      } catch (err) {
        if (isMounted && !isBackground) {
          setError(err.message);
        }
      } finally {
        if (isMounted && !isBackground) {
          setLoading(false);
        }
      }
    }

    fetchTickets(false);

    // Live auto-refresh every 5 seconds so changes reflect on both panels
    const interval = setInterval(() => {
      fetchTickets(true);
    }, 5000);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  /* ─────────────────────────────────────────────
     Logout
  ───────────────────────────────────────────── */

  function handleConfirmLogout() {
    setShowLogoutDialog(false);
    clearToken();

    if (onLogout) {
      onLogout();
    }

    navigate('/login');
  }

  function handleCancelLogout() {
    setShowLogoutDialog(false);
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (showLogoutDialog) setShowLogoutDialog(false);
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutDialog, mobileMenuOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ─────────────────────────────────────────────
     Dashboard tickets & Statistics
     (Clicking any stat card shows that list; otherwise shows unassigned open tickets)
  ───────────────────────────────────────────── */

  const openStatTickets = tickets.filter(
    (ticket) => ticket.status !== 'resolved'
  );

  const resolvedStatTickets = tickets.filter(
    (ticket) => ticket.status === 'resolved'
  );

  const highStatTickets = openStatTickets.filter(
    (ticket) => ticket.priority === 'high'
  );

  const mediumStatTickets = openStatTickets.filter(
    (ticket) => ticket.priority === 'medium'
  );

  const lowStatTickets = openStatTickets.filter(
    (ticket) => ticket.priority === 'low'
  );

  const unassignedOpenTickets = tickets.filter(
    (ticket) => ticket.status === 'open' && isTicketUnassigned(ticket)
  );

  // When a stat card is selected, show that list; otherwise show unassigned open tickets
  const dashboardTableTickets =
    selectedStat === 'open'
      ? openStatTickets
      : selectedStat === 'high'
      ? highStatTickets
      : selectedStat === 'medium'
      ? mediumStatTickets
      : selectedStat === 'low'
      ? lowStatTickets
      : selectedStat === 'resolved'
      ? resolvedStatTickets
      : unassignedOpenTickets;

  /* ─────────────────────────────────────────────
     Dashboard statistics
  ───────────────────────────────────────────── */

  const STAT_CARDS = [
    {
      key: 'open',
      label: 'Open Tickets',
      num: openStatTickets.length,
      accent: '#4f46e5',
      sub: 'Total unresolved',
    },
    {
      key: 'high',
      label: 'High Priority',
      num: highStatTickets.length,
      accent: '#e11d48',
      sub: 'Open high priority',
    },
    {
      key: 'medium',
      label: 'Medium Priority',
      num: mediumStatTickets.length,
      accent: '#d97706',
      sub: 'Open medium priority',
    },
    {
      key: 'low',
      label: 'Low Priority',
      num: lowStatTickets.length,
      accent: '#059669',
      sub: 'Open low priority',
    },
    {
      key: 'resolved',
      label: 'Resolved Tickets',
      num: resolvedStatTickets.length,
      accent: '#0891b2',
      sub: 'Closed conversations',
    },
  ];

  /* ─────────────────────────────────────────────
     Update ticket status handler (Dropdown or Tickbar)
  ───────────────────────────────────────────── */

  async function handleStatusChange(ticket, newStatus) {
    if (!newStatus || ticket.status === newStatus) return;

    const oldStatus = ticket.status;
    const nowIso = new Date().toISOString();
    const willBeResolved = newStatus === 'resolved';
    const instantResolution = willBeResolved
      ? calculateResolutionTime(ticket.createdAt, nowIso)
      : null;

    // Optimistically update tickets state so stats, status badge, and resolution time update instantly
    setTickets((previous) =>
      previous.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              status: newStatus,
              resolvedAt: willBeResolved ? nowIso : null,
              resolution: instantResolution,
              resolutionTime: instantResolution,
              resolvedBy: willBeResolved ? (user?.name || t.assignedTo) : null,
              resolvedById: willBeResolved ? user?.id : null,
            }
          : t
      )
    );
    setResolvingId(ticket.id);

    try {
      const res = await fetch(
        `http://localhost:4000/api/tickets/${encodeURIComponent(ticket.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update ticket status.');
      }

      if (data.ticket) {
        setTickets((previous) =>
          previous.map((t) => (t.id === ticket.id ? { ...t, ...data.ticket } : t))
        );
      }

      setNoticeMessage(
        newStatus === 'resolved'
          ? `✓ Ticket #${ticket.id} marked as resolved (${instantResolution}).`
          : `✓ Ticket #${ticket.id} status changed to ${formatStatus(newStatus)}.`
      );
    } catch (err) {
      // Rollback on failure
      setTickets((previous) =>
        previous.map((t) =>
          t.id === ticket.id ? { ...t, status: oldStatus } : t
        )
      );
      setError(err.message || 'Failed to update ticket status.');
    } finally {
      setResolvingId(null);
    }
  }

  const displayedTickets = [...dashboardTableTickets].sort((a, b) => {
    const pA = PRIORITY_ORDER[String(a.priority).toLowerCase()] || 4;
    const pB = PRIORITY_ORDER[String(b.priority).toLowerCase()] || 4;
    if (pA !== pB) {
      return pA - pB;
    }

    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
      return timeB - timeA;
    }
    return String(b.id || '').localeCompare(String(a.id || ''), undefined, {
      numeric: true,
    });
  });

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */

  return (
    <div className="db-shell">

      {/* ═══════════════════════════════════════
          TOPBAR
      ═══════════════════════════════════════ */}

      <div className="db-topbar">

        <button
          type="button"
          className="db-mobile-menu-btn"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {mobileMenuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        <div className="db-brand">
  <img
    src="img.jpg"
    className="login-brand-logo"
    alt="RI-Desk Logo"
  />

  <div className="db-brand-text">
    <div>
      <span className="db-brand-a">RI-</span>
      <span className="db-brand-b">Desk</span>
    </div>

    <div className="db-brand-slogan">
      One-stop Solution for all.
    </div>
  </div>
</div>
        <div className="db-topbar-right">

          <div className="db-user-dropdown-container" ref={userDropdownRef}>
            <button
              type="button"
              className={`db-user-pill ${userMenuOpen ? 'active' : ''}`}
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="Admin user menu"
            >
              <span className="db-avatar">
                {initials(user?.name)}
              </span>

              <span className="db-user-name">
                {user?.name || 'Admin User'}
              </span>

              <svg
                className={`db-user-chevron ${userMenuOpen ? 'open' : ''}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="db-user-dropdown-menu" role="menu">
                <div className="db-dropdown-header">
                  <div className="db-dropdown-user-info">
                    <span className="db-dropdown-name">{user?.name || 'Admin User'}</span>
                    <span className="db-dropdown-role-badge">
                      {user?.role ? user.role.toUpperCase() : 'ADMIN'}
                    </span>
                  </div>
                  {user?.mobileNumber && (
                    <span className="db-dropdown-subtext">{user.mobileNumber}</span>
                  )}
                </div>

                <div className="db-dropdown-divider" />

                <div className="db-dropdown-items">
                  <button
                    type="button"
                    className="db-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      resetPasswordForm();
                      setShowPasswordModal(true);
                    }}
                  >
                    <div className="db-dropdown-item-left">
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>Change Password</span>
                    </div>
                    <svg
                      className="db-dropdown-item-arrow"
                      width="13"
                      height="13"
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
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="db-logout-btn"
            onClick={() => setShowLogoutDialog(true)}
          >
            Log out
          </button>

        </div>

      </div>

      {/* ═══════════════════════════════════════
          BODY
      ═══════════════════════════════════════ */}

      <div className="db-body">

        {/* Backdrop for mobile drawer */}
        {mobileMenuOpen && (
          <div
            className="db-sidebar-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ─────────────────────────────────────
            SIDEBAR
        ───────────────────────────────────── */}

        <div className={`db-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>

          {/* Mobile drawer header */}
          <div className="db-sidebar-mobile-header">
            <span className="db-sidebar-mobile-title">Navigation</span>
            <button
              type="button"
              className="db-sidebar-close-btn"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
            >
              ✕
            </button>
          </div>

          {/* Main navigation */}

          {NAV.map((item) => (
            <button
              key={item.key}
              className={`db-nav-item ${
                active === item.key ? 'active' : ''
              }`}
              onClick={() => {
                setActive(item.key);
                setMobileMenuOpen(false);
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          {/* Admin-only Employees menu */}

          {isAdmin && (
            <button
              className={`db-nav-item ${
                active === 'employees' ||
                active === 'create-employee'
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                setActive('employees');
                setEmployeesOpen((prev) => !prev);
                setMobileMenuOpen(false);
              }}
            >
              <span className="db-nav-left">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Employees</span>
              </span>
            </button>
          )}

          {/* Tickets menu (available to both Admin and Employee) */}
          <button
            className={`db-nav-item ${
              active === 'tickets' ? 'active' : ''
            }`}
            onClick={() => {
              setActive('tickets');
              setMobileMenuOpen(false);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4h16v16H4z" />
              <path d="M8 9h8M8 13h8M8 17h5" />
            </svg>
            <span>Tickets</span>
          </button>
        </div>

        {/* ─────────────────────────────────────
            MAIN CONTENT
        ───────────────────────────────────── */}

        <div className="db-main">
          {active === 'tickets' ? (
            <TicketManagementPage />
          ) : active === 'employees' && isAdmin ? (
            <EmployeeListPage
              onCreateEmployee={() => setActive('create-employee')}
            />
          ) : active === 'create-employee' && isAdmin ? (
    <CreateEmployeePage
      onBack={() => setActive('employees')}
    />
  ) : (

            /* Dashboard / Assigned Tickets page */
            <>
              <h1 className="db-page-title">
                {isEmployee ? 'Employee Dashboard' : 'Dashboard'}
              </h1>

              <p className="db-page-sub">
                Here's what needs your attention right now.
              </p>

              {/* ── Notice Message ── */}
              {noticeMessage && (
                <div
                  className="ticket-notice ticket-success"
                  role="status"
                  style={{ marginBottom: 16 }}
                >
                  {noticeMessage}
                </div>
              )}

              {/* ── Statistics (Clickable for anyone to view as a list) ── */}

              <div className="db-stat-grid">
                {STAT_CARDS.map((stat) => {
                  const isSelected = selectedStat === stat.key;
                  return (
                    <div
                      key={stat.key}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      title={`Click to view ${stat.label} list (${stat.num} tickets)`}
                      className={`db-stat-card db-stat-card-clickable ${isSelected ? 'active' : ''}`}
                      style={{
                        '--accent': stat.accent,
                      }}
                      onClick={() => {
                        setSelectedStat((prev) => (prev === stat.key ? null : stat.key));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedStat((prev) => (prev === stat.key ? null : stat.key));
                        }
                      }}
                    >
                      <div className="db-stat-num">
                        {stat.num}
                      </div>

                      <div className="db-stat-label">
                        {stat.label}
                      </div>

                      <div className="db-stat-sub">
                        {isSelected ? '● Viewing list (Click to reset)' : stat.sub}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Tickets Table Header ── */}

              <div className="db-section-head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="db-section-title">
                      {selectedStat === 'open'
                        ? `Open Tickets List (${displayedTickets.length})`
                        : selectedStat === 'high'
                        ? `High Priority Tickets List (${displayedTickets.length})`
                        : selectedStat === 'medium'
                        ? `Medium Priority Tickets List (${displayedTickets.length})`
                        : selectedStat === 'low'
                        ? `Low Priority Tickets List (${displayedTickets.length})`
                        : selectedStat === 'resolved'
                        ? `Resolved Tickets List (${displayedTickets.length})`
                        : 'Unassigned Open Tickets'}
                    </span>
                    {selectedStat && (
                      <button
                        type="button"
                        className="db-clear-card-filter-btn"
                        onClick={() => setSelectedStat(null)}
                        title="Show unassigned open tickets"
                      >
                        ✕ Show Unassigned
                      </button>
                    )}
                  </div>
                  <span className="db-section-note">
                    {selectedStat === 'open'
                      ? 'Listing all unresolved tickets currently awaiting action'
                      : selectedStat === 'high'
                      ? 'Listing all urgent high-priority tickets'
                      : selectedStat === 'medium'
                      ? 'Listing all medium-priority tickets'
                      : selectedStat === 'low'
                      ? 'Listing all low-priority tickets'
                      : selectedStat === 'resolved'
                      ? 'Listing all closed and resolved conversations'
                      : 'Open tickets awaiting assignment — click any stat card above to view its ticket list'}
                  </span>
                </div>
                <button
                  type="button"
                  className="db-view-all-tickets-btn"
                  onClick={() => setActive('tickets')}
                >
                  View All in Tickets →
                </button>
              </div>

              <div
                className="db-card"
                style={{ marginBottom: 28 }}
              >

                {/* Loading */}

                {loading && (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}
                  >
                    Loading tickets…
                  </div>
                )}

                {/* Error */}

                {error && (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: '#e11d48',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* No tickets */}

                {!loading &&
                  !error &&
                  displayedTickets.length === 0 && (
                    <div
                      style={{
                        padding: 40,
                        textAlign: 'center',
                        color: '#94a3b8',
                      }}
                    >
                      {selectedStat
                        ? 'No tickets found matching this list.'
                        : 'No unassigned open tickets right now. All tickets are assigned.'}
                      {selectedStat && (
                        <div style={{ marginTop: 12 }}>
                          <button
                            type="button"
                            className="db-clear-card-filter-btn"
                            onClick={() => setSelectedStat(null)}
                          >
                            Reset to Unassigned Tickets
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                {/* Tickets table */}

                {!loading &&
                  !error &&
                  displayedTickets.length > 0 && (
                    <div className="db-table-scroll">
                      <table className="db-table">

                        <thead>
                          <tr>
                            <th>Ticket ID</th>
                            <th>Category</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th style={{ width: 140 }}>Resolution time</th>
                            <th>Assigned To</th>
                            <th>Customer</th>
                            <th>Created at</th>
                          </tr>
                        </thead>

                        <tbody>

                          {displayedTickets.map(
                            (ticket) => {
                              const isResolved = ticket.status === 'resolved';
                              const isNew = !isResolved && isTicketNew(ticket.createdAt, ticket.status);

                              return (
                                <tr
                                  key={ticket.id}
                                  className={`${isResolved ? 'db-row-resolved' : ''} ${isNew ? 'db-row-new' : ''}`.trim()}
                                >
                                  <td className="db-mono">
                                    <div className="ticket-id-cell">
                                      <span className="ticket-id-text">{ticket.id}</span>
                                      {isNew && (
                                        <span className="ticket-new-badge" title="Created recently">
                                          NEW
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td>
                                    <div className="ticket-category-cell">
                                      <span
                                        className="ticket-category"
                                        style={{
                                          color: getCategoryColor(ticket.category),
                                          background: getCategoryBg(ticket.category),
                                        }}
                                      >
                                        {capitalize(ticket.category)}
                                      </span>
                                      <button
                                        type="button"
                                        className="ticket-desc-button"
                                        title="View ticket description"
                                        aria-label={`View description for ticket ${ticket.id}`}
                                        onClick={() => setViewingTicket(ticket)}
                                      >
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                          <polyline points="14 2 14 8 20 8" />
                                          <line x1="16" y1="13" x2="8" y2="13" />
                                          <line x1="16" y1="17" x2="8" y2="17" />
                                          <line x1="10" y1="9" x2="8" y2="9" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>

                                  <td>
                                    <span
                                      className="ticket-priority"
                                      style={{
                                        color:
                                          PRIORITY_STYLE[ticket.priority]?.color ||
                                          '#64748b',
                                      }}
                                    >
                                      <span
                                        className="ticket-status-dot"
                                        style={{
                                          background:
                                            PRIORITY_STYLE[ticket.priority]?.dot ||
                                            '#64748b',
                                        }}
                                      />
                                      {capitalize(ticket.priority)}
                                    </span>
                                  </td>

                                  <td>
                                    <span
                                      className="ticket-status"
                                      style={{
                                        color:
                                          STATUS_COLORS[ticket.status] || '#64748b',
                                        background:
                                          STATUS_BACKGROUNDS[ticket.status] ||
                                          '#eff6ff',
                                      }}
                                    >
                                      {formatStatus(ticket.status)}
                                    </span>
                                  </td>

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

                                  <td>
                                    {ticket.assignedTo || 'Unassigned'}
                                  </td>

                                  <td>
                                    <div className="ticket-customer-cell">
                                      <div
                                        className="ticket-customer-avatar"
                                        title={ticket.customer || ticket.createdBy || 'Customer'}
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
                                      <div className="ticket-customer-info">
                                        <span className="ticket-customer-name">
                                          {ticket.customer || ticket.createdBy || '—'}
                                        </span>
                                        {ticket.customerMobile && (
                                          <button
                                            type="button"
                                            className="ticket-customer-phone"
                                            title={`Contact ${ticket.customer || 'customer'} (${ticket.customerMobile})`}
                                            aria-label={`Contact ${ticket.customer || 'customer'} at ${ticket.customerMobile}`}
                                            onClick={() =>
                                              setContactDialog({
                                                name: ticket.customer || ticket.createdBy || 'Customer',
                                                phone: ticket.customerMobile,
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
                                            <span>{ticket.customerMobile}</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  <td>
                                    <span className="ticket-created-at">
                                      {formatDate(ticket.createdAt)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            }
                          )}

                        </tbody>

                      </table>
                    </div>
                  )}

              </div>
            </>
          )}

        </div>

      </div>

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
                  {viewingTicket.subject ? ` — ${viewingTicket.subject}` : ''}
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
                      color: getCategoryColor(viewingTicket.category),
                      background: getCategoryBg(viewingTicket.category),
                      padding: '2px 8px',
                      fontSize: '11px',
                    }}
                  >
                    {capitalize(viewingTicket.category)}
                  </span>
                </div>

                <div className="ticket-desc-meta-item">
                  <span className="ticket-desc-meta-label">Priority:</span>
                  <span
                    className="ticket-priority"
                    style={{
                      color:
                        PRIORITY_STYLE[viewingTicket.priority]?.color ||
                        '#64748b',
                    }}
                  >
                    <span
                      className="ticket-status-dot"
                      style={{
                        background:
                          PRIORITY_STYLE[viewingTicket.priority]?.dot ||
                          '#64748b',
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
                      color: STATUS_COLORS[viewingTicket.status] || '#64748b',
                      background:
                        STATUS_BACKGROUNDS[viewingTicket.status] || '#eff6ff',
                      padding: '2px 8px',
                      fontSize: '11px',
                    }}
                  >
                    {formatStatus(viewingTicket.status)}
                  </span>
                </div>

                {viewingTicket.customer && (
                  <div className="ticket-desc-meta-item">
                    <span className="ticket-desc-meta-label">Customer:</span>
                    <span>{viewingTicket.customer}</span>
                  </div>
                )}

                {viewingTicket.customerMobile && (
                  <div className="ticket-desc-meta-item">
                    <span className="ticket-desc-meta-label">Mobile:</span>
                    <button
                      type="button"
                      className="ticket-customer-phone"
                      title={`Contact ${viewingTicket.customer || 'customer'} (${viewingTicket.customerMobile})`}
                      onClick={() =>
                        setContactDialog({
                          name: viewingTicket.customer || 'Customer',
                          phone: viewingTicket.customerMobile,
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
                      <span>{viewingTicket.customerMobile}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="ticket-desc-body">
                <label className="ticket-desc-label">Description</label>
                <div className="ticket-desc-text">
                  {viewingTicket.description || 'No description provided.'}
                </div>
              </div>
            </div>

            <div className="ticket-dialog-actions">
              <button
                type="button"
                className="ticket-create-button"
                onClick={() => setViewingTicket(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
      {/* ═══════════════════════════════════════
          CHANGE PASSWORD POP-UP DIALOG
      ═══════════════════════════════════════ */}
      {showPasswordModal && (
        <div
          className="pwd-dialog-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !passwordLoading) {
              resetPasswordForm();
              setShowPasswordModal(false);
            }
          }}
        >
          <div
            className="pwd-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwd-dialog-title"
          >
            <div className="pwd-dialog-header">
              <div className="pwd-dialog-header-left">
                <div className="pwd-dialog-icon" aria-hidden="true">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h2 id="pwd-dialog-title">Change Password</h2>
                  <p>Update password for {user?.name || 'Admin User'}.</p>
                </div>
              </div>

              <button
                type="button"
                className="pwd-dialog-close"
                onClick={() => {
                  resetPasswordForm();
                  setShowPasswordModal(false);
                }}
                disabled={passwordLoading}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="pwd-dialog-form">
              {passwordError && (
                <div className="pwd-dialog-notice error" role="alert">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="pwd-dialog-notice success" role="status">
                  <span className="pwd-dialog-notice-check">✓</span> {passwordSuccess}
                </div>
              )}

              <div className="pwd-dialog-field">
                <label htmlFor="modal-current-password">Current Password</label>
                <div className="pwd-dialog-input-wrap">
                  <input
                    id="modal-current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="pwd-dialog-eye-btn"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    title={showCurrentPassword ? 'Hide password' : 'Show password'}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showCurrentPassword} />
                  </button>
                </div>
              </div>

              <div className="pwd-dialog-field">
                <label htmlFor="modal-new-password">New Password *</label>
                <div className="pwd-dialog-input-wrap">
                  <input
                    id="modal-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="pwd-dialog-eye-btn"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showNewPassword} />
                  </button>
                </div>
              </div>

              <div className="pwd-dialog-field">
                <label htmlFor="modal-confirm-password">Confirm Password *</label>
                <div className="pwd-dialog-input-wrap">
                  <input
                    id="modal-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="pwd-dialog-eye-btn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showConfirmPassword} />
                  </button>
                </div>
              </div>

              <div className="pwd-dialog-actions">
                <button
                  type="button"
                  className="pwd-dialog-cancel-btn"
                  onClick={() => {
                    resetPasswordForm();
                    setShowPasswordModal(false);
                  }}
                  disabled={passwordLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pwd-dialog-submit-btn"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LOGOUT CONFIRMATION DIALOG
      ═══════════════════════════════════════ */}
      {showLogoutDialog && (
        <div
          className="logout-dialog-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCancelLogout();
            }
          }}
        >
          <section
            className="logout-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            aria-describedby="logout-dialog-desc"
          >
            <div className="logout-dialog-icon" aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <h2 id="logout-dialog-title">Log Out?</h2>

            <p id="logout-dialog-desc">
              Are you sure you want to log out of <strong>RI-Desk</strong>? You will need to sign in again to access your dashboard.
            </p>

            <div className="logout-dialog-actions">
              <button
                type="button"
                className="logout-cancel-btn"
                onClick={handleCancelLogout}
                autoFocus
              >
                Cancel
              </button>

              <button
                type="button"
                className="logout-confirm-btn"
                onClick={handleConfirmLogout}
              >
                Yes, Log Out
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════
          CONTACT CUSTOMER POP-UP DIALOG
      ═══════════════════════════════════════ */}
      <ContactCustomerDialog
        contact={contactDialog}
        onClose={() => setContactDialog(null)}
      />
    </div>
  );
}