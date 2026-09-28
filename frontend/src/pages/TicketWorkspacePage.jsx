 import { useState } from 'react';
import './TicketWorkspacePage.css';

const PRIORITY_STYLE = {
  high:   { bg: '#fff1f2', color: '#e11d48' },
  medium: { bg: '#fffbeb', color: '#d97706' },
  low:    { bg: '#ecfdf5', color: '#059669' },
};

function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Mock client profile — swap this for real ticket.client fields once
// the backend ticket model includes customer data (name/phone/email).
function getClientInfo(ticket) {
  return {
    name: 'Rahul Sharma',
    phone: '+91 98765 43210',
    email: 'rahul.sharma@example.com',
    accountType: 'Premium Retailer',
    memberSince: 'Jan 2024',
  };
}

export default function TicketWorkspacePage({ ticket, user, onBack }) {
  const [messages, setMessages] = useState([
    { from: 'client', text: `Hi, I'm having an issue: "${ticket?.subject || ''}"`, time: '10:02 AM' },
    { from: 'agent',  text: "Hi! Thanks for reaching out — let me look into this for you.", time: '10:03 AM' },
  ]);
  const [draft, setDraft] = useState('');

  function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages(prev => [...prev, { from: 'agent', text: draft.trim(), time: timeNow() }]);
    setDraft('');
  }

  if (!ticket) {
    return (
      <div className="tw-empty">
        <p>Select a ticket from the Dashboard to start the conversation.</p>
        <button onClick={onBack}>Back to Dashboard</button>
      </div>
    );
  }

  const p = PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.low;
  const client = getClientInfo(ticket);

  return (
    <div className="tw-main">
      {/* ── Header ── */}
      <div className="tw-header">
        <button className="tw-back" onClick={onBack} aria-label="Back to dashboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div className="tw-header-info">
          <div className="tw-header-id">{ticket.id}</div>
          <div className="tw-header-subject">{ticket.subject}</div>
        </div>
        <span className="db-badge" style={{ background: p.bg, color: p.color }}>
          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
        </span>
      </div>

      {/* ── Body: chat + client profile ── */}
      <div className="tw-body">

        {/* Chat column */}
        <div className="tw-chat-panel">
          <div className="tw-chat">
            {messages.map((m, i) => (
              <div key={i} className={`tw-bubble-row ${m.from}`}>
                <span className="tw-msg-avatar">
                  {m.from === 'agent' ? initials(user?.name || 'You') : initials(client.name)}
                </span>
                <div className="tw-bubble-col">
                  <div className="tw-bubble">{m.text}</div>
                  <div className="tw-bubble-meta">
                    {m.from === 'agent' ? (user?.name || 'You') : client.name} · {m.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form className="tw-composer" onSubmit={sendMessage}>
            <input
              type="text"
              placeholder="Type a reply…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" disabled={!draft.trim()}>Send</button>
          </form>
        </div>

        {/* Client profile column */}
        <div className="tw-client-panel">
          <div className="tw-client-avatar">{initials(client.name)}</div>
          <div className="tw-client-name">{client.name}</div>
          <div className="tw-client-tag">{client.accountType}</div>

          <div className="tw-client-divider" />

          <div className="tw-client-field">
            <span className="tw-client-label">Phone</span>
            <span className="tw-client-value">{client.phone}</span>
          </div>
          <div className="tw-client-field">
            <span className="tw-client-label">Email</span>
            <span className="tw-client-value">{client.email}</span>
          </div>
          <div className="tw-client-field">
            <span className="tw-client-label">Member since</span>
            <span className="tw-client-value">{client.memberSince}</span>
          </div>

          <div className="tw-client-divider" />

          <div className="tw-client-field">
            <span className="tw-client-label">Ticket raised by</span>
            <span className="tw-client-value">{ticket.createdBy}</span>
          </div>
          <div className="tw-client-field">
            <span className="tw-client-label">Resolution time</span>
            <span className="tw-client-value">{ticket.resolution}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
