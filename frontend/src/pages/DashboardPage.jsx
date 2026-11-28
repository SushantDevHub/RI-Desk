import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import {
  clearToken,
  getToken,
  changePassword,
} from '../api/authApi.js';
import { API_BASE } from '../config/api.js';
import TicketManagementPage, {
  validateTicket,
  buildPayload,
  TicketIcon,
  TicketFormFields,
} from './TicketManagementPage.jsx';
import { getActiveAnnouncements } from '../api/announcementApi.js';
import ContactClientDialog from '../components/ContactClientDialog.jsx';
import TicketLogsDialog from '../components/TicketLogsDialog.jsx';
import TransferTicketDialog from '../components/TransferTicketDialog.jsx';
import AskAdminDialog from '../components/AskAdminDialog.jsx';
import AskEmployeeDialog from '../components/AskEmployeeDialog.jsx';

const EmployeeListPage = lazy(() => import('./EmployeeListPage.jsx'));
const CreateEmployeePage = lazy(() => import('./CreateEmployeePage.jsx'));
const ClientManagementPage = lazy(() => import('./ClientManagementPage.jsx'));
const ExtrasPage = lazy(() => import('./ExtrasPage.jsx'));
import './TicketManagementPage.css';
import './DashboardPage.css';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

async function safeReadJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text && !text.includes('<!DOCTYPE') ? text : `Request failed (${res.status})` };
  }
}

function initials(name = '') {
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatNotifTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function TransferNotificationLogo({ size = 20, className = 'db-notif-icon' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function WhatsAppNotificationLogo({ size = 19, className = 'db-notif-icon' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function EmailNotificationLogo({ size = 19, className = 'db-notif-icon' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,6 12,13 2,6" />
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
    bg: '#ffffff',
    color: '#dc2626',
    dot: '#dc2626',
    borderColor: '#fecaca',
    fontWeight: 600,
  },

  medium: {
    bg: '#ffffff',
    color: '#334155',
    dot: '#94a3b8',
    borderColor: '#e2e8f0',
    fontWeight: 500,
  },

  low: {
    bg: '#ffffff',
    color: '#334155',
    dot: '#94a3b8',
    borderColor: '#e2e8f0',
    fontWeight: 500,
  },
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

function getActiveTabFromPath(pathname = '') {
  const p = pathname.toLowerCase();
  if (p.includes('/employees/create')) return 'create-employee';
  if (p.includes('/employees')) return 'employees';
  if (p.includes('/clients')) return 'clients';
  if (p.includes('/tickets')) return 'tickets';
  if (p.includes('/extras')) return 'extras';
  return 'dashboard';
}

/* ─────────────────────────────────────────────
   Dashboard Page
───────────────────────────────────────────── */

export default function DashboardPage({
  user,
  onLogout,
}) {
  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  const navigate = useNavigate();
  const location = useLocation();

  /* ── Navigation state synchronized with browser URL & history ── */

  const active = getActiveTabFromPath(location.pathname);

  function setActive(targetTab) {
    let targetPath = '/dashboard';
    if (targetTab === 'employees') targetPath = '/employees';
    else if (targetTab === 'create-employee') targetPath = '/employees/create';
    else if (targetTab === 'clients') targetPath = '/clients';
    else if (targetTab === 'tickets') targetPath = '/tickets';
    else if (targetTab === 'extras') targetPath = '/extras';

    if (location.pathname.toLowerCase() !== targetPath.toLowerCase()) {
      navigate(targetPath);
    }
  }

  // Normalize root path to /dashboard
  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Prevent non-admin access to admin tabs
  useEffect(() => {
    if (user && user.role !== 'admin') {
      if (
        active === 'employees' ||
        active === 'create-employee' ||
        active === 'extras'
      ) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, active, navigate]);

  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactDialog, setContactDialog] = useState(null);

  /* ── Dashboard ticket pagination ── */
  const [ticketPageSize, setTicketPageSize] = useState(25);
  const [selectedStatPage, setSelectedStatPage] = useState(1);
  const [unassignedPage, setUnassignedPage] = useState(1);
  const [openPage, setOpenPage] = useState(1);

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
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [resolvingId, setResolvingId] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [liveAnnouncements, setLiveAnnouncements] = useState([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState([]);
  const [viewingLogsTicket, setViewingLogsTicket] = useState(null);
  const [transferringTicket, setTransferringTicket] = useState(null);
  const [askAdminTicket, setAskAdminTicket] = useState(null);
  const [askEmployeeTicket, setAskEmployeeTicket] = useState(null);
  const [selectedStat, setSelectedStat] = useState(null);

  useEffect(() => {
    setSelectedStatPage(1);
    setUnassignedPage(1);
    setOpenPage(1);
  }, [ticketPageSize, selectedStat]);

  const [viewingTicket, setViewingTicket] = useState(null);
  const [editingTicket, setEditingTicket] = useState(null);
  const [savingTicket, setSavingTicket] = useState(false);
  const [editActionError, setEditActionError] = useState('');

  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [deleteActionError, setDeleteActionError] = useState('');

  /* ── Notifications state (topbar notification logos with counts) ── */
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);

  const [whatsappNotifications, setWhatsappNotifications] = useState([]);
  const [whatsappUnreadCount, setWhatsappUnreadCount] = useState(0);
  const [waMenuOpen, setWaMenuOpen] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState([]);
  const [emailUnreadCount, setEmailUnreadCount] = useState(0);
  const [emailMenuOpen, setEmailMenuOpen] = useState(false);

  const [activeMobileNotifModal, setActiveMobileNotifModal] = useState(null);
  const notifDropdownRef = useRef(null);
  const waDropdownRef = useRef(null);
  const emailDropdownRef = useRef(null);
  const notifsInFlightRef = useRef(false);
  const lastNotifsFingerprintRef = useRef('');

  const fetchNotifications = useCallback(async (isBackground = false) => {
    if (isBackground && (notifsInFlightRef.current || document.visibilityState !== 'visible')) {
      return;
    }
    notifsInFlightRef.current = true;
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const text = await res.text();
      if (isBackground && text && text === lastNotifsFingerprintRef.current) {
        return;
      }
      lastNotifsFingerprintRef.current = text;

      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadNotifCount(
          typeof data.unreadCount === 'number' ? data.unreadCount : 0
        );
      }
      if (data && Array.isArray(data.whatsappNotifications)) {
        setWhatsappNotifications(data.whatsappNotifications);
        setWhatsappUnreadCount(
          typeof data.whatsappUnreadCount === 'number' ? data.whatsappUnreadCount : 0
        );
      }
      if (data && Array.isArray(data.emailNotifications)) {
        setEmailNotifications(data.emailNotifications);
        setEmailUnreadCount(
          typeof data.emailUnreadCount === 'number' ? data.emailUnreadCount : 0
        );
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      notifsInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications(false);
      const interval = setInterval(() => fetchNotifications(true), 10000);

      const handleNotifUpdate = () => {
        fetchNotifications(false);
      };
      const handleStorage = (e) => {
        if (e.key === 'ri_desk_notif_sync') {
          fetchNotifications();
        }
      };

      window.addEventListener('notifications-updated', handleNotifUpdate);
      window.addEventListener('tickets-updated', handleNotifUpdate);
      window.addEventListener('storage', handleStorage);

      return () => {
        clearInterval(interval);
        window.removeEventListener('notifications-updated', handleNotifUpdate);
        window.removeEventListener('tickets-updated', handleNotifUpdate);
        window.removeEventListener('storage', handleStorage);
      };
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(event.target)
      ) {
        setNotifMenuOpen(false);
      }
      if (
        waDropdownRef.current &&
        !waDropdownRef.current.contains(event.target)
      ) {
        setWaMenuOpen(false);
      }
      if (
        emailDropdownRef.current &&
        !emailDropdownRef.current.contains(event.target)
      ) {
        setEmailMenuOpen(false);
      }
    }
    if (notifMenuOpen || waMenuOpen || emailMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notifMenuOpen, waMenuOpen, emailMenuOpen]);

  async function handleMarkNotifRead(notifId, e, channel = null) {
    if (e) {
      e.stopPropagation();
    }
    if (channel === 'whatsapp') {
      setWhatsappNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setWhatsappUnreadCount((prev) => Math.max(0, prev - 1));
    } else if (channel === 'email') {
      setEmailNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setEmailUnreadCount((prev) => Math.max(0, prev - 1));
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    }

    try {
      const token = getToken();
      if (!token) return;
      await fetch(`${API_BASE}/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      lastNotifsFingerprintRef.current = '';
    } catch (err) {
      console.error('Mark notification read error:', err);
    }
  }

  async function handleMarkAllNotifsRead(channel = null) {
    if (channel === 'whatsapp') {
      setWhatsappNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setWhatsappUnreadCount(0);
    } else if (channel === 'email') {
      setEmailNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setEmailUnreadCount(0);
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotifCount(0);
    }

    try {
      const token = getToken();
      if (!token) return;
      await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(channel ? { channel } : {}),
      });
      lastNotifsFingerprintRef.current = '';
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  }

  async function handleNotificationClick(notif, channel = null) {
    if (!notif.read) {
      handleMarkNotifRead(notif.id, null, channel);
    }
    setNotifMenuOpen(false);
    setWaMenuOpen(false);
    setEmailMenuOpen(false);

    if (notif.type === 'mobile_notification') {
      setActiveMobileNotifModal(notif);
      return;
    }

    if (!notif.ticketId) {
      return;
    }

    let targetTicket = tickets.find(
      (t) => String(t.id) === String(notif.ticketId)
    );

    try {
      const token = getToken();
      if (token) {
        const res = await fetch(
          `${API_BASE}/tickets/${notif.ticketId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await safeReadJson(res);
          if (data && data.ticket) {
            targetTicket = data.ticket;
          }
        }
      }
    } catch (err) {
      console.error('Fetch ticket details error:', err);
    }

    if (targetTicket) {
      setViewingLogsTicket(targetTicket);
    }
  }

  /* ── Load real-time active announcements ── */
  useEffect(() => {
    let isMounted = true;
    async function loadLiveAnnouncements() {
      try {
        const list = await getActiveAnnouncements();
        if (isMounted) {
          setLiveAnnouncements(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        // silent fallback
      }
    }
    loadLiveAnnouncements();
    const interval = setInterval(loadLiveAnnouncements, 20000); // Poll every 20s for real-time announcements
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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
    let inFlight = false;
    let lastTicketsRaw = '';

    async function fetchTickets(isBackground = false) {
      if (isBackground && (inFlight || document.visibilityState !== 'visible')) {
        return;
      }
      inFlight = true;
      try {
        if (!isBackground) {
          setLoading(true);
        }

        const res = await fetch(
          `${API_BASE}/tickets`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }
        );

        const text = await res.text();
        if (isBackground && res.ok && text && text === lastTicketsRaw) {
          return;
        }

        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }

        if (!res.ok) {
          throw new Error(
            data.error || 'Failed to load tickets.'
          );
        }

        lastTicketsRaw = text;
        if (isMounted) {
          setTickets(data.tickets || []);
        }
      } catch (err) {
        if (isMounted && !isBackground) {
          setError(err.message);
        }
      } finally {
        inFlight = false;
        if (isMounted && !isBackground) {
          setLoading(false);
        }
      }
    }

    async function fetchEmployees() {
      try {
        let res = await fetch(`${API_BASE}/tickets/employees`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.employees) && data.employees.length > 0) {
            if (isMounted) setEmployees(data.employees);
            return;
          }
        }
        res = await fetch(`${API_BASE}/users`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          const empList = Array.isArray(data.users)
            ? data.users.filter((u) => u.role === 'employee')
            : Array.isArray(data)
            ? data.filter((u) => u.role === 'employee')
            : [];
          if (isMounted) setEmployees(empList);
        }
      } catch (err) {
        // silent fallback
      }
    }

    fetchTickets(false);
    fetchEmployees();

    // Poll tickets smoothly when tab is active (local mutations sync instantly via events)
    const interval = setInterval(() => {
      fetchTickets(true);
    }, 6000);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
        fetchEmployees();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    function handleFastSync() {
      fetchTickets(true);
      fetchEmployees();
    }
    window.addEventListener('tickets-updated', handleFastSync);
    window.addEventListener('storage', handleFastSync);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('tickets-updated', handleFastSync);
      window.removeEventListener('storage', handleFastSync);
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

  function sortDescending(a, b) {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
      return timeB - timeA;
    }
    return String(b.id || '').localeCompare(String(a.id || ''), undefined, {
      numeric: true,
    });
  }

  const unassignedOpenTickets = tickets
    .filter((ticket) => {
      if (ticket.status === 'resolved') return false;
      return isTicketUnassigned(ticket);
    })
    .sort(sortDescending);

  // Open tickets slab only includes assigned open tickets so unassigned tickets are not duplicated
  const openTicketsDescending = openStatTickets
    .filter((ticket) => !isTicketUnassigned(ticket))
    .sort(sortDescending);

  const allOpenTicketsDescending = openStatTickets.slice().sort(sortDescending);

  const selectedStatTickets =
    selectedStat === 'open'
      ? allOpenTicketsDescending
      : selectedStat === 'high'
      ? highStatTickets.slice().sort(sortDescending)
      : selectedStat === 'medium'
      ? mediumStatTickets.slice().sort(sortDescending)
      : selectedStat === 'low'
      ? lowStatTickets.slice().sort(sortDescending)
      : selectedStat === 'resolved'
      ? resolvedStatTickets.slice().sort(sortDescending)
      : [];

  /* ─────────────────────────────────────────────
     Dashboard statistics
  ───────────────────────────────────────────── */

  const STAT_CARDS = [
    {
      key: 'open',
      label: 'Open Tickets',
      num: openStatTickets.length,
      accent: '#4f46e5',
      bg: '#f5f3ff',
      border: '#c7d2fe',
    },
    {
      key: 'high',
      label: 'High Priority',
      num: highStatTickets.length,
      accent: '#e11d48',
      bg: '#fff1f2',
      border: '#fecdd3',
    },
    {
      key: 'medium',
      label: 'Medium Priority',
      num: mediumStatTickets.length,
      accent: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
    },
    {
      key: 'low',
      label: 'Low Priority',
      num: lowStatTickets.length,
      accent: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
    },
    {
      key: 'resolved',
      label: 'Resolved Tickets',
      num: resolvedStatTickets.length,
      accent: '#0891b2',
      bg: '#ecfeff',
      border: '#a5f3fc',
    },
  ];

  /* ─────────────────────────────────────────────
     Inline ticket updates handler (Category, Priority, Status, Assignment)
  ───────────────────────────────────────────── */

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
      setNoticeMessage('⚠️ Only administrators can re-open or change the status of a resolved ticket.');
      return;
    }

    const oldValue = ticket[field];
    const willBeResolved = field === 'status' && value === 'resolved';
    const nowIso = new Date().toISOString();
    const instantResolution = willBeResolved
      ? calculateResolutionTime(ticket.createdAt, nowIso)
      : (field === 'status' ? null : (ticket.resolution || ticket.resolutionTime));

    setTickets((previous) =>
      previous.map((t) =>
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
                    resolvedBy: willBeResolved ? (user?.name || t.assignedTo) : null,
                    resolvedById: willBeResolved ? user?.id : null,
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
    if (field === 'status') {
      setResolvingId(ticket.id);
    }

    try {
      const res = await fetch(
        `${API_BASE}/tickets/${encodeURIComponent(ticket.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ [field]: value }),
        }
      );

      const data = await safeReadJson(res);
      if (!res.ok) {
        throw new Error(data.error || `Failed to update ${field}.`);
      }

      if (data.ticket) {
        setTickets((previous) =>
          previous.map((t) => (t.id === ticket.id ? { ...t, ...data.ticket } : t))
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

      setNoticeMessage(
        field === 'status' && value === 'resolved'
          ? `✓ Ticket #${ticket.id}: Status changed from "${oldFormatted}" to "Resolved" (${instantResolution}).`
          : `✓ Ticket #${ticket.id}: ${fieldTitle} changed from "${oldFormatted}" to "${newFormatted}".`
      );
    } catch (err) {
      setTickets((previous) =>
        previous.map((t) =>
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
      setError(err.message || `Failed to update ${field}.`);
    } finally {
      if (field === 'status') {
        setResolvingId(null);
      }
    }
  }

  /* ---------- Edit Ticket Modal Handlers ---------- */
  function openEditTicket(ticket) {
    setEditActionError('');
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
    setEditActionError('');
  }

  function updateEditingTicket(field, value) {
    setEditingTicket((previous) => ({ ...previous, [field]: value }));
  }

  async function handleUpdateTicket(event) {
    event.preventDefault();
    if (!editingTicket) return;

    setEditActionError('');

    if (
      editingTicket.originalStatus === 'resolved' &&
      editingTicket.status !== 'resolved' &&
      !isAdmin
    ) {
      setEditActionError(
        'Only administrators can re-open or change the status of a resolved ticket.'
      );
      return;
    }

    const validationError = validateTicket(editingTicket);
    if (validationError) {
      setEditActionError(validationError);
      return;
    }

    try {
      setSavingTicket(true);
      const matchedEmployee = employees.find(
        (e) => String(e.id) === String(editingTicket.assignedToId)
      );

      const payload = buildPayload(editingTicket);
      const optimisticUpdate = {
        ...editingTicket,
        ...payload,
        assignedTo: matchedEmployee ? matchedEmployee.name : null,
      };

      setTickets((prev) =>
        prev.map((t) => (t.id === editingTicket.id ? { ...t, ...optimisticUpdate } : t))
      );

      const response = await fetch(
        `${API_BASE}/tickets/${encodeURIComponent(editingTicket.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await safeReadJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update ticket.');
      }

      if (data.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === editingTicket.id ? { ...t, ...data.ticket } : t))
        );
      }

      window.dispatchEvent(
        new CustomEvent('tickets-updated', {
          detail: data.ticket || optimisticUpdate,
        })
      );
      if (data.notification) {
        window.dispatchEvent(
          new CustomEvent('notifications-updated', { detail: data.notification })
        );
      }
      try {
        localStorage.setItem('tickets_last_sync', String(Date.now()));
      } catch (e) {}

      closeEditTicket();
      await fetchTickets(true);
      setNoticeMessage(`✓ Ticket #${editingTicket.id} updated successfully.`);
    } catch (err) {
      setEditActionError(err.message || 'Failed to update ticket.');
    } finally {
      setSavingTicket(false);
    }
  }

  /* ---------- Delete Ticket Modal Handlers ---------- */
  function openDeleteTicket(ticket) {
    setDeleteActionError('');
    setTicketToDelete(ticket);
  }

  function closeDeleteTicket() {
    if (deletingTicket) return;
    setTicketToDelete(null);
    setDeleteActionError('');
  }

  async function handleDeleteTicket() {
    if (!ticketToDelete) return;

    try {
      setDeletingTicket(true);
      setDeleteActionError('');

      const response = await fetch(
        `${API_BASE}/tickets/${encodeURIComponent(ticketToDelete.id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await safeReadJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete ticket.');
      }

      setTickets((prev) => prev.filter((t) => t.id !== ticketToDelete.id));

      window.dispatchEvent(
        new CustomEvent('tickets-updated', {
          detail: { id: ticketToDelete.id, deleted: true },
        })
      );
      try {
        localStorage.setItem('tickets_last_sync', String(Date.now()));
      } catch (e) {}

      closeDeleteTicket();
    } catch (err) {
      setDeleteActionError(err.message || 'Failed to delete ticket.');
    } finally {
      setDeletingTicket(false);
    }
  }

  function renderTicketTable(ticketList, emptyText, currentPage = 1, onPageChange = null) {
    if (loading) {
      return (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
          Loading tickets…
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: '#e11d48' }}>
          {error}
        </div>
      );
    }
    if (!ticketList || ticketList.length === 0) {
      const isUnassigned = typeof emptyText === 'string' && emptyText.toLowerCase().includes('unassigned');
      return (
        <div className="db-empty-state">
          <div className="db-empty-icon-box">
            {isUnassigned ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            )}
          </div>
          <div className="db-empty-title">
            {isUnassigned ? 'No Unassigned Tickets' : 'No Tickets to Display'}
          </div>
          <div className="db-empty-subtext">
            {isUnassigned
              ? ''
              : typeof emptyText === 'string'
              ? emptyText.replace(/^[✓•\s]+/, '')
              : 'There are currently no tickets matching this view.'}
          </div>
        </div>
      );
    }

    const effectiveSize = ticketPageSize === 'all' ? Math.max(1, ticketList.length) : ticketPageSize;
    const totalPages = Math.max(1, Math.ceil(ticketList.length / effectiveSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safePage - 1) * effectiveSize;
    const displayedTickets =
      ticketPageSize === 'all' ? ticketList : ticketList.slice(startIndex, startIndex + effectiveSize);

    return (
      <>
        <div className="db-table-scroll">
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
                <th style={{ width: 105, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedTickets.map((ticket) => {
              const isResolved = ticket.status === 'resolved';
              const isNew = !isResolved && isTicketNew(ticket.createdAt, ticket.status);

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
                  className={`${isResolved ? 'db-row-resolved' : ''} ${isNew ? 'db-row-new' : ''}`.trim()}
                >
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

                  <td>
                    <div className="ticket-row-cell-wrap" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                      <select
                        className="ticket-row-badge-select"
                        style={{
                          color: '#334155',
                          backgroundColor: '#ffffff',
                          borderColor: '#e2e8f0',
                          fontWeight: 500,
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
                        <option value="low" style={{ color: '#334155' }}>● Low</option>
                        <option value="medium" style={{ color: '#334155' }}>● Medium</option>
                        <option value="high" style={{ color: '#dc2626', fontWeight: 600 }}>● High</option>
                      </select>
                    </div>
                  </td>

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
                            fontWeight: 500,
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
                      <span>{ticket.assignedTo || 'Unassigned'}</span>
                    )}
                  </td>

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

                  <td className="ticket-actions-cell" style={{ textAlign: 'center' }}>
                    <div className="ticket-row-actions" style={{ justifyContent: 'center' }}>
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
        {onPageChange && totalPages > 1 && (
          <div className="ticket-pagination-bar">
            <div className="ticket-pagination-info">
              Showing{' '}
              <strong>
                {startIndex + 1}–{Math.min(startIndex + displayedTickets.length, ticketList.length)}
              </strong>{' '}
              of <strong>{ticketList.length}</strong> ticket
              {ticketList.length === 1 ? '' : 's'}
            </div>

            <div className="ticket-page-btns">
              <button
                type="button"
                className="ticket-page-btn"
                onClick={() => onPageChange(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
              >
                ‹ Prev
              </button>
              <span className="ticket-page-indicator">
                Page <strong>{safePage}</strong> / {totalPages}
              </span>
              <button
                type="button"
                className="ticket-page-btn"
                onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

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
            src="/img.jpg"
            className="db-brand-logo"
            alt="RI-Desk Logo"
            onError={(e) => {
              e.currentTarget.src = 'img.jpg';
            }}
          />

          <div className="db-brand-text">
            <div className="db-brand-title">
              <span className="db-brand-a">RI-</span>
              <span className="db-brand-b">Desk</span>
            </div>

            <div className="db-brand-slogan">
              One-stop Solution for all.
            </div>
          </div>
        </div>
        <div className="db-topbar-right">

          {/* ── WhatsApp Notification Icon with Count (Admin only) ── */}
          {user && isAdmin && (
            <div className="db-notif-container" ref={waDropdownRef}>
              <button
                type="button"
                className={`db-notif-btn db-notif-btn-whatsapp ${waMenuOpen ? 'active' : ''} ${whatsappUnreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => {
                  setWaMenuOpen((prev) => !prev);
                  setEmailMenuOpen(false);
                  setNotifMenuOpen(false);
                }}
                aria-label="WhatsApp Notifications"
                aria-expanded={waMenuOpen}
                title={
                  whatsappUnreadCount > 0
                    ? `${whatsappUnreadCount} unread WhatsApp notification${whatsappUnreadCount > 1 ? 's' : ''}`
                    : 'WhatsApp Notifications'
                }
              >
                <WhatsAppNotificationLogo size={19} />
                {whatsappUnreadCount > 0 && (
                  <span className="db-notif-badge db-notif-badge-wa">
                    {whatsappUnreadCount > 99 ? '99+' : whatsappUnreadCount}
                  </span>
                )}
              </button>

              {waMenuOpen && (
                <div className="db-notif-dropdown" role="menu">
                  <div className="db-notif-header">
                    <div className="db-notif-header-title db-notif-header-with-tag">
                      <span>WhatsApp</span>
                      {whatsappUnreadCount > 0 && (
                        <span className="db-notif-channel-tag wa">{whatsappUnreadCount} new</span>
                      )}
                    </div>
                    {whatsappUnreadCount > 0 && (
                      <button
                        type="button"
                        className="db-notif-mark-all"
                        onClick={() => handleMarkAllNotifsRead('whatsapp')}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="db-notif-list">
                    {whatsappNotifications.length === 0 ? (
                      <div className="db-notif-empty">
                        <div className="db-notif-empty-title">No WhatsApp notifications</div>
                        <div className="db-notif-empty-desc">
                          Incoming WhatsApp alerts and queries will appear here.
                        </div>
                      </div>
                    ) : (
                      whatsappNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`db-notif-item ${!notif.read ? 'unread unread-wa' : ''}`}
                          onClick={() => handleNotificationClick(notif, 'whatsapp')}
                          role="menuitem"
                          tabIndex={0}
                        >
                          <div className="db-notif-item-body">
                            <div className="db-notif-item-title">
                              <strong>{notif.senderName || 'Team Member'}</strong>
                              {notif.ticketId ? (
                                <>
                                  {' '}via WhatsApp on{' '}
                                  <span className="db-notif-ticket-id">
                                    #{notif.ticketNumber || notif.ticketId}
                                  </span>
                                </>
                              ) : (
                                <> — {notif.title || 'WhatsApp Alert'}</>
                              )}
                            </div>
                            {notif.message && (
                              <div className="db-notif-item-desc">{notif.message}</div>
                            )}
                            <div className="db-notif-item-meta">
                              {notif.clientName ? `${notif.clientName} • ` : ''}
                              {formatNotifTime(notif.createdAt)}
                            </div>
                          </div>
                          {!notif.read && (
                            <span className="db-notif-dot wa" title="Unread" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Email Notification Icon with Count (Admin only) ── */}
          {user && isAdmin && (
            <div className="db-notif-container" ref={emailDropdownRef}>
              <button
                type="button"
                className={`db-notif-btn db-notif-btn-email ${emailMenuOpen ? 'active' : ''} ${emailUnreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => {
                  setEmailMenuOpen((prev) => !prev);
                  setWaMenuOpen(false);
                  setNotifMenuOpen(false);
                }}
                aria-label="Email Notifications"
                aria-expanded={emailMenuOpen}
                title={
                  emailUnreadCount > 0
                    ? `${emailUnreadCount} unread Email notification${emailUnreadCount > 1 ? 's' : ''}`
                    : 'Email Notifications'
                }
              >
                <EmailNotificationLogo size={19} />
                {emailUnreadCount > 0 && (
                  <span className="db-notif-badge db-notif-badge-email">
                    {emailUnreadCount > 99 ? '99+' : emailUnreadCount}
                  </span>
                )}
              </button>

              {emailMenuOpen && (
                <div className="db-notif-dropdown" role="menu">
                  <div className="db-notif-header">
                    <div className="db-notif-header-title db-notif-header-with-tag">
                      <span>Email</span>
                      {emailUnreadCount > 0 && (
                        <span className="db-notif-channel-tag email">{emailUnreadCount} new</span>
                      )}
                    </div>
                    {emailUnreadCount > 0 && (
                      <button
                        type="button"
                        className="db-notif-mark-all"
                        onClick={() => handleMarkAllNotifsRead('email')}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="db-notif-list">
                    {emailNotifications.length === 0 ? (
                      <div className="db-notif-empty">
                        <div className="db-notif-empty-title">No Email notifications</div>
                        <div className="db-notif-empty-desc">
                          Incoming email alerts and queries will appear here.
                        </div>
                      </div>
                    ) : (
                      emailNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`db-notif-item ${!notif.read ? 'unread unread-email' : ''}`}
                          onClick={() => handleNotificationClick(notif, 'email')}
                          role="menuitem"
                          tabIndex={0}
                        >
                          <div className="db-notif-item-body">
                            <div className="db-notif-item-title">
                              <strong>{notif.senderName || 'Team Member'}</strong>
                              {notif.ticketId ? (
                                <>
                                  {' '}via Email on{' '}
                                  <span className="db-notif-ticket-id">
                                    #{notif.ticketNumber || notif.ticketId}
                                  </span>
                                </>
                              ) : (
                                <> — {notif.title || 'Email Alert'}</>
                              )}
                            </div>
                            {notif.message && (
                              <div className="db-notif-item-desc">{notif.message}</div>
                            )}
                            <div className="db-notif-item-meta">
                              {notif.clientName ? `${notif.clientName} • ` : ''}
                              {formatNotifTime(notif.createdAt)}
                            </div>
                          </div>
                          {!notif.read && (
                            <span className="db-notif-dot email" title="Unread" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notification Bell Logo with Count (Employees & Admin) ── */}
          {user && (
            <div className="db-notif-container" ref={notifDropdownRef}>
              <button
                type="button"
                className={`db-notif-btn ${notifMenuOpen ? 'active' : ''} ${unreadNotifCount > 0 ? 'has-unread' : ''}`}
                onClick={() => {
                  setNotifMenuOpen((prev) => !prev);
                  setWaMenuOpen(false);
                  setEmailMenuOpen(false);
                }}
                aria-label="Notifications"
                aria-expanded={notifMenuOpen}
                title={
                  unreadNotifCount > 0
                    ? `${unreadNotifCount} unread notification${unreadNotifCount > 1 ? 's' : ''}`
                    : 'Notifications'
                }
              >
                <TransferNotificationLogo size={21} />
                {unreadNotifCount > 0 && (
                  <span className="db-notif-badge">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {notifMenuOpen && (
                <div className="db-notif-dropdown" role="menu">
                  <div className="db-notif-header">
                    <div className="db-notif-header-title">
                      <span>Notifications</span>
                    </div>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        className="db-notif-mark-all"
                        onClick={() => handleMarkAllNotifsRead(null)}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="db-notif-list">
                    {notifications.length === 0 ? (
                      <div className="db-notif-empty">
                        <div className="db-notif-empty-title">No notifications</div>
                        <div className="db-notif-empty-desc">
                          Ticket assignments & transfers will appear here.
                        </div>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const isMobile = notif.type === 'mobile_notification';
                        const isAssigned = notif.type === 'ticket_assigned';
                        return (
                          <div
                            key={notif.id}
                            className={`db-notif-item ${!notif.read ? 'unread' : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                            role="menuitem"
                            tabIndex={0}
                          >
                            <div className="db-notif-item-body">
                              {isMobile ? (
                                <>
                                  <div className="db-notif-item-title">
                                    <strong>{notif.title || 'Notification'}</strong>
                                  </div>
                                  <div className="db-notif-item-desc">
                                    {notif.message}
                                  </div>
                                  <div className="db-notif-item-meta">
                                    {notif.senderName || 'Admin'} • {formatNotifTime(notif.createdAt)}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="db-notif-item-title">
                                    {isAssigned ? (
                                      String(notif.senderId) === String(user?.id) ? (
                                        <>
                                          <strong>You</strong> assigned ticket{' '}
                                          <span className="db-notif-ticket-id">
                                            #{notif.ticketNumber || notif.ticketId}
                                          </span>{' '}
                                          to <strong>{notif.recipientName || 'assigned employee'}</strong>
                                        </>
                                      ) : String(notif.recipientId) === String(user?.id) ? (
                                        <>
                                          <strong>{notif.senderName || 'Admin'}</strong> assigned ticket{' '}
                                          <span className="db-notif-ticket-id">
                                            #{notif.ticketNumber || notif.ticketId}
                                          </span>{' '}
                                          to you
                                        </>
                                      ) : (
                                        <>
                                          <strong>{notif.senderName || 'Admin'}</strong> assigned ticket{' '}
                                          <span className="db-notif-ticket-id">
                                            #{notif.ticketNumber || notif.ticketId}
                                          </span>{' '}
                                          to <strong>{notif.recipientName || 'assigned employee'}</strong>
                                        </>
                                      )
                                    ) : (
                                      String(notif.senderId) === String(user?.id) ? (
                                        <>
                                          <strong>You</strong> transferred ticket{' '}
                                          <span className="db-notif-ticket-id">
                                            #{notif.ticketNumber || notif.ticketId}
                                          </span>{' '}
                                          to <strong>{notif.recipientName || 'assigned employee'}</strong>
                                        </>
                                      ) : String(notif.recipientId) === String(user?.id) ? (
                                        <>
                                          <strong>{notif.senderName}</strong> transferred ticket{' '}
                                          <span className="db-notif-ticket-id">
                                            #{notif.ticketNumber || notif.ticketId}
                                          </span>{' '}
                                          to you
                                        </>
                                      ) : (
                                        <>
                                          <strong>{notif.senderName}</strong> transferred ticket{' '}
                                          <span className="db-notif-ticket-id">
                                            #{notif.ticketNumber || notif.ticketId}
                                          </span>{' '}
                                          to <strong>{notif.recipientName || 'assigned employee'}</strong>
                                        </>
                                      )
                                    )}
                                  </div>
                                  {notif.ticketSubject && (
                                    <div className="db-notif-item-desc">
                                      Subject: {notif.ticketSubject}
                                    </div>
                                  )}
                                  {notif.workLeft && (
                                    <div className="db-notif-item-desc">
                                      Note: {notif.workLeft}
                                    </div>
                                  )}
                                  <div className="db-notif-item-meta">
                                    {formatNotifTime(notif.createdAt)}
                                  </div>
                                </>
                              )}
                            </div>
                            {!notif.read && (
                              <span className="db-notif-dot" title="Unread" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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

                  <button
                    type="button"
                    className="db-dropdown-item db-dropdown-item-logout"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowLogoutDialog(true);
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
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>Log Out</span>
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
              <span>{item.label}</span>
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
            </button>
          )}

          {/* Client menu */}
          <button
            className={`db-nav-item ${
              active === 'clients' ? 'active' : ''
            }`}
            onClick={() => {
              setActive('clients');
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
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-3" />
              <path d="M9 9h1" />
              <path d="M9 13h1" />
              <path d="M9 17h1" />
            </svg>
            <span>Clients</span>
          </button>

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

          {/* Extras menu (just below tickets in admin sidebar) */}
          {isAdmin && (
            <button
              type="button"
              className={`db-nav-item ${
                active === 'extras' ? 'active' : ''
              }`}
              onClick={() => {
                setActive('extras');
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
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect x="2" y="7" width="20" height="5" />
                <line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
              <span>Extras</span>
            </button>
          )}
        </div>
        


        
        {/* ─────────────────────────────────────
            MAIN CONTENT
        ───────────────────────────────────── */}

        <div className="db-main">
          {active === 'tickets' ? (
            <TicketManagementPage />
          ) : active === 'clients' ? (
            <Suspense fallback={<div className="db-empty-state" style={{ padding: 48 }}>Loading Manage Clients...</div>}>
              <ClientManagementPage isAdmin={isAdmin} />
            </Suspense>
          ) : active === 'employees' && isAdmin ? (
            <Suspense fallback={<div className="db-empty-state" style={{ padding: 48 }}>Loading Employees...</div>}>
              <EmployeeListPage
                onCreateEmployee={() => setActive('create-employee')}
              />
            </Suspense>
          ) : active === 'create-employee' && isAdmin ? (
            <Suspense fallback={<div className="db-empty-state" style={{ padding: 48 }}>Loading Add Employee...</div>}>
              <CreateEmployeePage
                onBack={() => setActive('employees')}
              />
            </Suspense>
          ) : active === 'extras' && isAdmin ? (
            <Suspense fallback={<div className="db-empty-state" style={{ padding: 48 }}>Loading Extras...</div>}>
              <ExtrasPage isAdmin={isAdmin} />
            </Suspense>
          ) : (

            /* Dashboard / Assigned Tickets page */
            <>
              <h1 className="db-page-title">
                {isEmployee ? 'Employee Dashboard' : 'Dashboard'}
              </h1>

              {/* ── Real-Time Announcements Moving Ticker (Right to Left) ── */}
              {(() => {
                const activeAlerts = liveAnnouncements.filter(
                  (item) => !dismissedAnnouncements.includes(item.id)
                );
                if (activeAlerts.length === 0) return null;
                const hasUrgent = activeAlerts.some((item) => item.priority === 'Urgent');

                return (
                  <div
                    className={`db-announcement-ticker ${hasUrgent ? 'urgent' : ''}`}
                  >
                    <div className="db-ticker-tag" title="Live Announcements">
                      <span className="db-ticker-pulse-dot" />
                      <svg
                        className="db-ticker-icon"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m3 11 18-5v12L3 14v-3z" />
                        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                      </svg>
                    </div>

                    <div className="db-ticker-track-wrap" title="Hover to pause scroll">
                      <div className="db-ticker-track">
                        {activeAlerts.map((announcement, idx) => (
                          <span key={announcement.id} className="db-ticker-item">
                            {idx > 0 && (
                              <span className="db-ticker-bulk-divider">✦</span>
                            )}
                            <span className="db-ticker-title">
                              {announcement.title}
                            </span>
                            {announcement.content && (
                              <>
                                <span className="db-ticker-separator">—</span>
                                <span className="db-ticker-content">
                                  {announcement.content}
                                </span>
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

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

              <div className="db-stat-grid" role="region" aria-label="Dashboard statistics overview">
                {STAT_CARDS.map((stat) => {
                  const isSelected = selectedStat === stat.key;
                  return (
                    <div
                      key={stat.key}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${stat.label}: ${stat.num}. Click to view list.`}
                      title={`Click to view ${stat.label} list (${stat.num} tickets)`}
                      className={`db-stat-card db-stat-card-clickable ${isSelected ? 'active' : ''}`}
                      style={{
                        '--accent': stat.accent,
                        '--accent-bg': stat.bg,
                        '--accent-border': stat.border,
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
                      <div className="db-stat-label">{stat.label}</div>
                      <div className="db-stat-num">{stat.num}</div>
                    </div>
                  );
                })}
              </div>

              {/* ── Single Common View All in Tickets + Rows Bar ── */}
              <div
                className="db-tickets-rows-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 4,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  className="db-view-all-tickets-btn"
                  onClick={() => setActive('tickets')}
                >
                  View All in Tickets →
                </button>

                <label className="ticket-pagesize-label">
                  <span>Rows:</span>
                  <select
                    className="ticket-pagesize-select"
                    value={ticketPageSize}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTicketPageSize(val === 'all' ? 'all' : Number(val));
                    }}
                    aria-label="Dashboard ticket rows per page"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">All</option>
                  </select>
                </label>
              </div>

              {/* If a stat card is selected, show that specific list */}
              {selectedStat ? (
                <div className="db-card" style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #e2e8f0',
                      background: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 100%)',
                      borderLeft: `4px solid ${
                        selectedStat === 'open'
                          ? '#4f46e5'
                          : selectedStat === 'high'
                          ? '#e11d48'
                          : selectedStat === 'medium'
                          ? '#d97706'
                          : selectedStat === 'low'
                          ? '#059669'
                          : '#0891b2'
                      }`,
                      borderRadius: '12px 12px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                          {selectedStat === 'open'
                            ? 'Open Tickets List'
                            : selectedStat === 'high'
                            ? 'High Priority Tickets List'
                            : selectedStat === 'medium'
                            ? 'Medium Priority Tickets List'
                            : selectedStat === 'low'
                            ? 'Low Priority Tickets List'
                            : 'Resolved Tickets List'}
                        </span>
                        <span
                          style={{
                            background: selectedStat === 'high' ? '#fee2e2' : '#e0e7ff',
                            color: selectedStat === 'high' ? '#b91c1c' : '#3730a3',
                            border: `1px solid ${selectedStat === 'high' ? '#fca5a5' : '#c7d2fe'}`,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: 9999,
                          }}
                        >
                          {selectedStatTickets.length} {selectedStatTickets.length === 1 ? 'ticket' : 'tickets'}
                        </span>
                      </div>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: '#64748b' }}>
                        {selectedStat === 'open'
                          ? ''
                          : selectedStat === 'high'
                          ? ''
                          : selectedStat === 'medium'
                          ? ''
                          : selectedStat === 'low'
                          ? ''
                          : ''}
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="db-clear-card-filter-btn"
                        onClick={() => setSelectedStat(null)}
                      >
                        ✕ Reset to Dashboard Slabs
                      </button>
                    </div>
                  </div>

                  {renderTicketTable(
                    selectedStatTickets,
                    'No tickets found matching this list.',
                    selectedStatPage,
                    setSelectedStatPage
                  )}
                </div>
              ) : (
                /* Default Dashboard view: Two Slabs (Unassigned on top, Open tickets below in descending order) */
                <>
                  {/* SLAB 1: Unassigned Tickets (On Top) */}
                  <div className="db-card" style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #f1f5f9',
                        background: '#fafafa',
                        borderRadius: '12px 12px 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                            Unassigned Tickets
                          </span>
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 9999,
                            }}
                          >
                            {unassignedOpenTickets.length}{' '}
                            {unassignedOpenTickets.length === 1 ? 'ticket' : 'tickets'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {renderTicketTable(
                      unassignedOpenTickets,
                      '✓ No unassigned tickets.',
                      unassignedPage,
                      setUnassignedPage
                    )}
                  </div>

                  {/* SLAB 2: Open Tickets (In Descending Order) */}
                  <div className="db-card" style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #f1f5f9',
                        background: '#fafafa',
                        borderRadius: '12px 12px 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                            Open Tickets
                          </span>
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 9999,
                            }}
                          >
                            {openTicketsDescending.length}{' '}
                            {openTicketsDescending.length === 1 ? 'ticket' : 'tickets'}
                          </span>
                          <span
                            style={{
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            ↓ Descending
                          </span>
                        </div>
                      </div>
                    </div>

                    {renderTicketTable(
                      openTicketsDescending,
                      '✓ No assigned open tickets.',
                      openPage,
                      setOpenPage
                    )}
                  </div>
                </>
              )}
            </>
          )}

        </div>

      </div>



      {/* ═══════════════════════════════════════
          MOBILE NOTIFICATION DETAIL MODAL
      ═══════════════════════════════════════ */}
      {activeMobileNotifModal && (
        <div
          className="ticket-dialog-overlay"
          onClick={() => setActiveMobileNotifModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="ticket-dialog"
            style={{ maxWidth: '480px', padding: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ticket-dialog-header" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: '#ede9fe',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                    {activeMobileNotifModal.title || 'Mobile Notification'}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ fontSize: '10.5px', background: '#ede9fe', color: '#6d28d9', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      Target: {activeMobileNotifModal.targetName || activeMobileNotifModal.target || 'All Users'}
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      By {activeMobileNotifModal.senderName || 'Admin'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="ticket-dialog-close"
                onClick={() => setActiveMobileNotifModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '13.5px',
              color: '#334155',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              marginBottom: '16px',
            }}>
              {activeMobileNotifModal.message}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                {formatNotifTime(activeMobileNotifModal.createdAt)}
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                {activeMobileNotifModal.ticketId && (
                  <button
                    type="button"
                    className="ticket-form-btn submit"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                    onClick={() => {
                      const t = tickets.find((item) => String(item.id) === String(activeMobileNotifModal.ticketId));
                      setActiveMobileNotifModal(null);
                      if (t) setViewingLogsTicket(t);
                    }}
                  >
                    View Ticket #{activeMobileNotifModal.ticketNumber || activeMobileNotifModal.ticketId}
                  </button>
                )}
                <button
                  type="button"
                  className="ticket-form-btn cancel"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  onClick={() => setActiveMobileNotifModal(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
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
          currentUser={user}
          onClose={() => setTransferringTicket(null)}
        />
      )}

      {/* ═══════════════════════════════════════
          ASK ADMIN FOR HELP POP-UP DIALOG (EMPLOYEE)
      ═══════════════════════════════════════ */}
      {askAdminTicket && (
        <AskAdminDialog
          ticket={askAdminTicket}
          currentUser={user}
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
          currentUser={user}
          onClose={() => setAskEmployeeTicket(null)}
        />
      )}

      {/* ═══════════════════════════════════════
          VIEW TICKET DETAILS POP-UP DIALOG
      ═══════════════════════════════════════ */}
      {viewingTicket && (
        <div
          className="ticket-dialog-overlay"
          onClick={() => setViewingTicket(null)}
        >
          <section
            className="ticket-dialog ticket-desc-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-view-desc-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ticket-dialog-header">
              <div>
                <h2 id="dashboard-view-desc-title">Ticket Details</h2>
                <p>Ticket #{viewingTicket.id}</p>
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
          EDIT TICKET POP-UP DIALOG
      ═══════════════════════════════════════ */}
      {editingTicket && (
        <div className="ticket-dialog-overlay" onClick={closeEditTicket}>
          <section
            className="ticket-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-edit-ticket-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ticket-dialog-header">
              <div>
                <h2 id="dashboard-edit-ticket-title">Edit Ticket</h2>
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

            {editActionError && (
              <div className="ticket-dialog-error" role="alert">
                {editActionError}
              </div>
            )}

            <form onSubmit={handleUpdateTicket}>
              <TicketFormFields
                idPrefix="db-edit"
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

      {/* ═══════════════════════════════════════
          DELETE CONFIRMATION DIALOG
      ═══════════════════════════════════════ */}
      {ticketToDelete && (
        <div className="ticket-dialog-overlay" onClick={closeDeleteTicket}>
          <section
            className="ticket-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-delete-ticket-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ticket-delete-symbol">
              <TicketIcon type="delete" />
            </div>

            <h2 id="dashboard-delete-ticket-title">Delete Ticket?</h2>

            <p>
              Are you sure you want to delete ticket{' '}
              <strong>#{ticketToDelete.id}</strong>?{' '}
              This action cannot be undone.
            </p>

            {deleteActionError && (
              <div className="ticket-dialog-error" role="alert">
                {deleteActionError}
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
              Are you sure you want to log out of <strong>RI-Desk</strong>?
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
          CONTACT CLIENT POP-UP DIALOG
      ═══════════════════════════════════════ */}
      <ContactClientDialog
        contact={contactDialog}
        onClose={() => setContactDialog(null)}
      />
    </div>
  );
}