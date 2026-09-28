 import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearToken, getToken } from '../api/authApi.js';
import TicketWorkspacePage from './TicketWorkspacePage.jsx';
import './DashboardPage.css';

/* ── helpers ── */
function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const PRIORITY_STYLE = {
  high:   { bg: '#fff1f2', color: '#e11d48', dot: '#e11d48', accent: '#e11d48' },
  medium: { bg: '#fffbeb', color: '#d97706', dot: '#d97706', accent: '#d97706' },
  low:    { bg: '#ecfdf5', color: '#059669', dot: '#059669', accent: '#059669' },
};

const NAV = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/>
        <rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
      </svg>
    ),
  },
  {
    key: 'ticket-workspace',
    label: 'Ticket Workspace',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
];

export default function DashboardPage({ user }) {
  const navigate = useNavigate();
  const [active, setActive]   = useState('dashboard');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats]     = useState({ open: 0, high: 0, medium: 0, low: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // ── Fetch real tickets from backend on mount ──
  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await fetch('http://localhost:4000/api/tickets', {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load tickets.');
        setTickets(data.tickets);
        setStats(data.stats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  function handleOpenTicket(ticket) {
    setSelectedTicket(ticket);
    setActive('ticket-workspace');
  }

  const openTickets     = tickets.filter(t => t.status === 'open');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  const STAT_CARDS = [
    { label: 'Open Tickets',      num: stats.open,           accent: '#4f46e5', sub: 'Total unresolved' },
    { label: 'High Priority',     num: stats.high,           accent: '#e11d48', sub: 'Open high priority' },
    { label: 'Medium Priority',   num: stats.medium,         accent: '#d97706', sub: 'Open medium priority' },
    { label: 'Low Priority',      num: stats.low,             accent: '#059669', sub: 'Open low priority' },
    { label: 'Resolved Tickets',  num: resolvedTickets.length, accent: '#0891b2', sub: 'Closed conversations' },
  ];

  return (
    <div className="db-shell">

      {/* ── Topbar ── */}
      <div className="db-topbar">
        <div className="db-brand">
        <img src="data:image/png;base64,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" alt="rambhiya infotech" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain' }} />
          <span>
            <span className="db-brand-a">Recharge</span>
            <span className="db-brand-b">Desk</span>
          </span>
        </div>
        <div className="db-topbar-right">
          <div className="db-user-pill">
            <span className="db-avatar">{initials(user?.name)}</span>
            <span className="db-user-name">{user?.name || 'Agent'}</span>
          </div>
          <button className="db-logout-btn" onClick={handleLogout}>Log out</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="db-body">

        {/* ── Sidebar ── */}
        <div className="db-sidebar">
          {NAV.map(item => (
            <button
              key={item.key}
              className={`db-nav-item ${active === item.key ? 'active' : ''}`}
              onClick={() => setActive(item.key)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Main ── */}
        <div className="db-main">
          {active === 'ticket-workspace' ? (
            <TicketWorkspacePage
              ticket={selectedTicket}
              user={user}
              onBack={() => setActive('dashboard')}
            />
          ) : (
            <>
              <h1 className="db-page-title">Dashboard</h1>
              <p className="db-page-sub">Here's what needs your attention right now.</p>

              {/* Stat cards */}
              <div className="db-stat-grid">
                {STAT_CARDS.map(s => (
                  <div key={s.label} className="db-stat-card" style={{ '--accent': s.accent }}>
                    <div className="db-stat-num">{s.num}</div>
                    <div className="db-stat-label">{s.label}</div>
                    <div className="db-stat-sub">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Open tickets table */}
              <div className="db-section-head">
                <span className="db-section-title">Open tickets</span>
                <span className="db-section-note">Click "Open" to chat with the client</span>
              </div>

              <div className="db-card" style={{ marginBottom: 28 }}>
                {loading && (
                  <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                    Loading tickets…
                  </div>
                )}

                {error && (
                  <div style={{ padding: 24, textAlign: 'center', color: '#e11d48' }}>
                    {error}
                  </div>
                )}

                {!loading && !error && openTickets.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                    No open tickets right now.
                  </div>
                )}

                {!loading && !error && openTickets.length > 0 && (
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th>Ticket ID</th>
                        <th>Subject</th>
                        <th>Priority</th>
                        <th>Resolution time</th>
                        <th>Created by</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {openTickets.map(t => {
                        const p = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.low;
                        return (
                          <tr key={t.id}>
                            <td className="db-mono">{t.id}</td>
                            <td>{t.subject}</td>
                            <td>
                              <span className="db-badge" style={{ background: p.bg, color: p.color }}>
                                <span className="db-dot" style={{ background: p.dot }} />
                                {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                              </span>
                            </td>
                            <td className="db-mono">{t.resolution}</td>
                            <td style={{ color: '#94a3b8', fontSize: 12.5 }}>{t.createdBy}</td>
                            <td>
                              <button className="db-open-btn" onClick={() => handleOpenTicket(t)}>
                                Open
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
