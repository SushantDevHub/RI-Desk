import { useState, useEffect } from 'react';
import { getToken } from '../api/authApi.js';
import {
  getAllAnnouncementsAdmin,
  createAnnouncement,
  toggleAnnouncementStatus,
  deleteAnnouncement,
} from '../api/announcementApi.js';
import './ExtrasPage.css';
import './DashboardPage.css';

export const EXTRAS_MODULE_CONFIG = [
  {
    id: 'manage_news',
    title: 'Manage News',
    tag: 'Announcements',
    tagColor: '#3b82f6',
    accentColor: '#2563eb',
    iconBg: '#eff6ff',
    iconColor: '#1d4ed8',
    description:
      'Publish company announcements, bulletins, service schedules, and real-time news updates across the portal.',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" />
        <path d="M15 18h-5" />
        <path d="M10 6h8v4h-8V6Z" />
      </svg>
    ),
  },
  {
    id: 'send_sms',
    title: 'Send SMS',
    tag: 'SMS Gateway',
    tagColor: '#0ea5e9',
    accentColor: '#0284c7',
    iconBg: '#f0f9ff',
    iconColor: '#0369a1',
    description:
      'Dispatch immediate transactional text messages, alert broadcasts, and verification SMS to client phone numbers.',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="13" y2="13" />
      </svg>
    ),
  },
  {
    id: 'send_whatsapp',
    title: 'Send Whatsapp',
    tag: 'WhatsApp Connect',
    tagColor: '#10b981',
    accentColor: '#059669',
    iconBg: '#ecfdf5',
    iconColor: '#047857',
    description:
      'Engage clients directly with WhatsApp template notifications, service updates, and interactive alerts.',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <path d="m9 10 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'send_email',
    title: 'Send Email',
    tag: 'Email Broadcast',
    tagColor: '#f59e0b',
    accentColor: '#d97706',
    iconBg: '#fffbeb',
    iconColor: '#b45309',
    description:
      'Compose, schedule, and distribute formal emails, service notices, newsletters, and reports directly to inboxes.',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
];

function formatTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

export default function ExtrasPage({
  activeSubTab: propSubTab,
  onSelectSubTab: propOnSelect,
}) {
  const [internalSubTab, setInternalSubTab] = useState('manage_news');
  const activeSubTab =
    propSubTab && propSubTab !== 'all'
      ? propSubTab
      : internalSubTab === 'all'
      ? 'manage_news'
      : internalSubTab;
  const onSelectSubTab = propOnSelect || setInternalSubTab;

  const [successBanner, setSuccessBanner] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Real-time News Announcements State (loaded from backend)
  const [newsList, setNewsList] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Form Fields
  const [newsTitle, setNewsTitle] = useState('');
  const [newsCategory, setNewsCategory] = useState('General');
  const [newsAudience, setNewsAudience] = useState('All');
  const [newsPriority, setNewsPriority] = useState('Normal');
  const [newsBody, setNewsBody] = useState('');

  // Fetch real-time announcements from backend
  const loadAnnouncements = async () => {
    setLoadingNews(true);
    setErrorMessage('');
    try {
      const data = await getAllAnnouncementsAdmin();
      setNewsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
      setErrorMessage(err.message || 'Failed to load announcements from server.');
    } finally {
      setLoadingNews(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const showSuccess = (msg) => {
    setSuccessBanner(msg);
    setTimeout(() => {
      setSuccessBanner('');
    }, 4000);
  };

  // Publish Announcement in real-time
  const handlePublishNews = async (e) => {
    if (e) e.preventDefault();
    const trimmed = newsBody.trim();
    if (!trimmed) return;

    setPublishing(true);
    setErrorMessage('');
    try {
      const derivedTitle = trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
      const created = await createAnnouncement({
        title: newsTitle.trim() || derivedTitle,
        category: newsCategory || 'General',
        audience: newsAudience || 'All',
        priority: newsPriority || 'Normal',
        content: trimmed,
        status: 'Active',
      });

      setNewsList((prev) => [created, ...prev]);
      setNewsTitle('');
      setNewsBody('');
      showSuccess('Announcement published live in real time!');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to publish announcement.');
    } finally {
      setPublishing(false);
    }
  };

  const handleResetNews = () => {
    setNewsAudience('All');
    setNewsTitle('');
    setNewsBody('');
  };

  // Toggle Announcement Status
  const handleToggleStatus = async (id) => {
    try {
      const updated = await toggleAnnouncementStatus(id);
      setNewsList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: updated.status } : item))
      );
      showSuccess(`Announcement status set to ${updated.status}.`);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update announcement status.');
    }
  };

  // Delete Announcement
  const handleDeleteNews = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      setNewsList((prev) => prev.filter((item) => item.id !== id));
      showSuccess('Announcement deleted successfully.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete announcement.');
    }
  };

  const handleSendSMS = (e) => {
    e.preventDefault();
    if (!smsPhone.trim() || !smsMessage.trim()) return;
    const entry = {
      id: Date.now(),
      phone: smsPhone.trim(),
      message: smsMessage.trim(),
      time: 'Just now',
      status: 'Sent',
    };
    setSmsLogs([entry, ...smsLogs]);
    setSmsPhone('');
    setSmsMessage('');
    showSuccess(`SMS message sent successfully to ${entry.phone}!`);
  };

  const handleSendWhatsApp = (e) => {
    e.preventDefault();
    if (!waPhone.trim() || !waMessage.trim()) return;
    const entry = {
      id: Date.now(),
      phone: waPhone.trim(),
      message: waMessage.trim(),
      time: 'Just now',
      status: 'Delivered',
    };
    setWaLogs([entry, ...waLogs]);
    setWaPhone('');
    setWaMessage('');
    showSuccess(`WhatsApp message dispatched to ${entry.phone}!`);
  };

  const handleSendEmail = (e) => {
    e.preventDefault();
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    const entry = {
      id: Date.now(),
      to: emailTo.trim(),
      subject: emailSubject.trim(),
      time: 'Just now',
      status: 'Delivered',
    };
    setEmailLogs([entry, ...emailLogs]);
    setEmailTo('');
    setEmailSubject('');
    setEmailBody('');
    showSuccess(`Email successfully delivered to ${entry.to}!`);
  };

  const currentModule = EXTRAS_MODULE_CONFIG.find((m) => m.id === activeSubTab);

  return (
    <div className="extras-page">
      {/* ── Tab Switcher Bar ── */}
      <div className="extras-tab-bar">
        {EXTRAS_MODULE_CONFIG.map((mod) => (
          <button
            key={mod.id}
            type="button"
            className={`extras-tab-btn ${
              activeSubTab === mod.id ? 'active' : ''
            }`}
            onClick={() => onSelectSubTab(mod.id)}
          >
            {mod.icon}
            <span>{mod.title}</span>
          </button>
        ))}
      </div>

      {/* ── Status Banners ── */}
      {successBanner && (
        <div className="extras-alert-banner success">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successBanner}</span>
        </div>
      )}

      {errorMessage && (
        <div className="extras-alert-banner" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 1: MANAGE NEWS MODULE (REAL-TIME ANNOUNCEMENTS)
      ═══════════════════════════════════════════════════════════ */}
      {activeSubTab === 'manage_news' && (
        <div className="extras-module-view">
          <div className="extras-screenshot-container">
            <h1 className="extras-screenshot-title">Add News</h1>

            <form onSubmit={handlePublishNews}>
              <div className="extras-screenshot-card">
                <h2 className="extras-screenshot-subtitle">News's Details</h2>

                <div className="extras-screenshot-field">
                  <label className="extras-screenshot-label">
                    Usertype <span className="extras-req-star">*</span>
                  </label>
                  <select
                    className="extras-screenshot-select"
                    value={newsAudience}
                    onChange={(e) => setNewsAudience(e.target.value)}
                    required
                  >
                    <option value="All">All Users</option>
                    <option value="Clients">Clients</option>
                    <option value="Employees">Employees</option>
                  </select>
                </div>

                <div className="extras-screenshot-field">
                  <label className="extras-screenshot-label">
                    Message <span className="extras-req-star">*</span>
                  </label>
                  <textarea
                    className="extras-screenshot-textarea"
                    placeholder="Type news message"
                    rows={2}
                    value={newsBody}
                    onChange={(e) => setNewsBody(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="extras-screenshot-actions">
                <button
                  type="submit"
                  className="extras-screenshot-submit"
                  disabled={publishing}
                >
                  {publishing ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  type="button"
                  className="extras-screenshot-reset"
                  onClick={handleResetNews}
                >
                  Reset
                </button>
              </div>
            </form>

            {/* Live Moving Ticker Preview (Right to Left) */}
            {newsList.some((item) => item.status === 'Active') && (
              <div
                className="extras-live-ticker-preview"
                title="Live Preview: Moving right to left (hover to pause)"
              >
                <div className="extras-live-ticker-label">
                  <span className="extras-pulse-dot" />
                  <span>LIVE TICKER</span>
                </div>
                <div className="extras-live-ticker-track-wrap">
                  <div className="extras-live-ticker-track">
                    {newsList
                      .filter((item) => item.status === 'Active')
                      .map((item, idx) => (
                        <span key={item.id} className="extras-live-ticker-item">
                          {idx > 0 && (
                            <span style={{ opacity: 0.6, margin: '0 4px' }}>✦</span>
                          )}
                          <strong>[{item.audience === 'All' ? 'All Users' : item.audience}]</strong> {item.content}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Announcements List */}
            <div className="extras-list-card" style={{ marginTop: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h3
                  className="extras-card-heading"
                  style={{ borderBottom: 0, paddingBottom: 0 }}
                >
                  Published Announcements ({newsList.length})
                </h3>
                <button
                  type="button"
                  className="extras-action-btn"
                  onClick={loadAnnouncements}
                  disabled={loadingNews}
                  title="Refresh from database"
                >
                  {loadingNews ? 'Refreshing...' : '↻ Refresh'}
                </button>
              </div>

              {loadingNews && newsList.length === 0 ? (
                <div className="extras-empty-state">
                  <p>Loading announcements from database...</p>
                </div>
              ) : newsList.length === 0 ? (
                <div className="extras-empty-state">
                  <svg
                    className="extras-empty-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" />
                    <line x1="8" y1="9" x2="16" y2="9" />
                    <line x1="8" y1="13" x2="14" y2="13" />
                  </svg>
                  <h4 className="extras-empty-title">No announcements published yet</h4>
                  <p className="extras-empty-sub">
                    Fill out the form above to broadcast your first real-time announcement.
                  </p>
                </div>
              ) : (
                <div className="extras-feed-list">
                  {newsList.map((item) => (
                    <div key={item.id} className="extras-feed-item">
                      <div className="extras-feed-item-top">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <h4 className="extras-feed-item-title">
                            {item.title || item.content}
                          </h4>
                          {item.priority === 'Urgent' && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#b91c1c',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}
                            >
                              URGENT
                            </span>
                          )}
                        </div>

                        <span
                          className={`extras-status-pill ${
                            item.status === 'Active' ? 'active' : 'inactive'
                          }`}
                        >
                          {item.status || 'Active'}
                        </span>
                      </div>

                      <p className="extras-feed-item-desc">{item.content}</p>

                      <div className="extras-feed-item-meta">
                        <span>
                          <strong>Audience:</strong>{' '}
                          {item.audience === 'All' ? 'All Users' : item.audience}
                        </span>
                        <span>{formatTime(item.createdAt)}</span>
                      </div>

                      <div className="extras-feed-actions">
                        <button
                          type="button"
                          className="extras-action-btn"
                          onClick={() => handleToggleStatus(item.id)}
                        >
                          {item.status === 'Active' ? 'Mark Inactive' : 'Set Active'}
                        </button>
                        <button
                          type="button"
                          className="extras-action-btn delete"
                          onClick={() => handleDeleteNews(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 4: SEND SMS MODULE
      ═══════════════════════════════════════════════════════════ */}
      {activeSubTab === 'send_sms' && (
        <div className="extras-module-view">
          <div className="extras-module-header">
            <div className="extras-module-header-left">
              <div
                className="extras-module-header-icon"
                style={{
                  backgroundColor: currentModule?.iconBg,
                  color: currentModule?.iconColor,
                }}
              >
                {currentModule?.icon}
              </div>
              <div>
                <h2 className="extras-module-title">Send SMS</h2>
                <p className="extras-module-subtitle">
                  Dispatch transactional and urgent text messages to mobile phones.
                </p>
              </div>
            </div>
          </div>

          <div className="extras-workspace-grid">
            <form className="extras-form-card" onSubmit={handleSendSMS}>
              <h3 className="extras-card-heading">Dispatch SMS Broadcast</h3>

              <div className="extras-form-group">
                <label className="extras-form-label">Recipient Mobile Number</label>
                <input
                  type="tel"
                  className="extras-form-input"
                  placeholder="+91 98765 43210"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  required
                />
              </div>

              <div className="extras-form-group">
                <label className="extras-form-label">Template</label>
                <select
                  className="extras-form-select"
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                >
                  <option value="General Alert">General Alert</option>
                  <option value="Ticket Update">Ticket Resolution Update</option>
                  <option value="Service Notice">Service Maintenance Notice</option>
                  <option value="Custom">Custom Text</option>
                </select>
              </div>

              <div className="extras-form-group">
                <label className="extras-form-label">
                  SMS Message ({smsMessage.length}/160 chars)
                </label>
                <textarea
                  className="extras-form-textarea"
                  placeholder="Enter text message..."
                  rows={3}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="extras-submit-btn">
                Send SMS Message
              </button>
            </form>

            <div className="extras-list-card">
              <h3 className="extras-card-heading">Recent SMS Dispatches ({smsLogs.length})</h3>
              {smsLogs.length === 0 ? (
                <div className="extras-empty-state">
                  <p className="extras-empty-sub">No SMS messages dispatched yet.</p>
                </div>
              ) : (
                <div className="extras-feed-list">
                  {smsLogs.map((log) => (
                    <div key={log.id} className="extras-feed-item">
                      <div className="extras-feed-item-top">
                        <h4 className="extras-feed-item-title">{log.phone}</h4>
                        <span className="extras-feed-item-badge">{log.status}</span>
                      </div>
                      <p className="extras-feed-item-desc">{log.message}</p>
                      <div className="extras-feed-item-meta">
                        <span>{log.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 5: SEND WHATSAPP MODULE
      ═══════════════════════════════════════════════════════════ */}
      {activeSubTab === 'send_whatsapp' && (
        <div className="extras-module-view">
          <div className="extras-module-header">
            <div className="extras-module-header-left">
              <div
                className="extras-module-header-icon"
                style={{
                  backgroundColor: currentModule?.iconBg,
                  color: currentModule?.iconColor,
                }}
              >
                {currentModule?.icon}
              </div>
              <div>
                <h2 className="extras-module-title">Send Whatsapp</h2>
                <p className="extras-module-subtitle">
                  Communicate with clients directly via official WhatsApp messages.
                </p>
              </div>
            </div>
          </div>

          <div className="extras-workspace-grid">
            <form className="extras-form-card" onSubmit={handleSendWhatsApp}>
              <h3 className="extras-card-heading">Send WhatsApp Message</h3>

              <div className="extras-form-group">
                <label className="extras-form-label">Client Mobile (WhatsApp)</label>
                <input
                  type="tel"
                  className="extras-form-input"
                  placeholder="+91 98200 12345"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  required
                />
              </div>

              <div className="extras-form-group">
                <label className="extras-form-label">Message Template</label>
                <select
                  className="extras-form-select"
                  value={waTemplate}
                  onChange={(e) => setWaTemplate(e.target.value)}
                >
                  <option value="Ticket Update">Ticket Status Update</option>
                  <option value="Service Reminder">Service Reminder</option>
                  <option value="Welcome">Client Welcome Greeting</option>
                  <option value="Custom">Custom Direct Chat</option>
                </select>
              </div>

              <div className="extras-form-group">
                <label className="extras-form-label">WhatsApp Text</label>
                <textarea
                  className="extras-form-textarea"
                  placeholder="Type WhatsApp message..."
                  rows={4}
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="extras-submit-btn">
                Send WhatsApp Message
              </button>
            </form>

            <div className="extras-list-card">
              <h3 className="extras-card-heading">WhatsApp Activity Log ({waLogs.length})</h3>
              {waLogs.length === 0 ? (
                <div className="extras-empty-state">
                  <p className="extras-empty-sub">No WhatsApp messages sent yet.</p>
                </div>
              ) : (
                <div className="extras-feed-list">
                  {waLogs.map((log) => (
                    <div key={log.id} className="extras-feed-item">
                      <div className="extras-feed-item-top">
                        <h4 className="extras-feed-item-title">{log.phone}</h4>
                        <span className="extras-feed-item-badge">{log.status}</span>
                      </div>
                      <p className="extras-feed-item-desc">{log.message}</p>
                      <div className="extras-feed-item-meta">
                        <span>{log.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 6: SEND EMAIL MODULE
      ═══════════════════════════════════════════════════════════ */}
      {activeSubTab === 'send_email' && (
        <div className="extras-module-view">
          <div className="extras-module-header">
            <div className="extras-module-header-left">
              <div
                className="extras-module-header-icon"
                style={{
                  backgroundColor: currentModule?.iconBg,
                  color: currentModule?.iconColor,
                }}
              >
                {currentModule?.icon}
              </div>
              <div>
                <h2 className="extras-module-title">Send Email</h2>
                <p className="extras-module-subtitle">
                  Compose formal announcements, client notices, and support digest emails.
                </p>
              </div>
            </div>
          </div>

          <div className="extras-workspace-grid">
            <form className="extras-form-card" onSubmit={handleSendEmail}>
              <h3 className="extras-card-heading">Compose Email Broadcast</h3>

              <div className="extras-form-group">
                <label className="extras-form-label">Recipient Email</label>
                <input
                  type="email"
                  className="extras-form-input"
                  placeholder="client@company.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  required
                />
              </div>

              <div className="extras-form-group">
                <label className="extras-form-label">Subject</label>
                <input
                  type="text"
                  className="extras-form-input"
                  placeholder="e.g., Monthly Service & Support Report"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  required
                />
              </div>

              <div className="extras-form-group">
                <label className="extras-form-label">Email Body</label>
                <textarea
                  className="extras-form-textarea"
                  placeholder="Write your email message here..."
                  rows={4}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="extras-submit-btn">
                Send Email
              </button>
            </form>

            <div className="extras-list-card">
              <h3 className="extras-card-heading">Recent Email Broadcasts ({emailLogs.length})</h3>
              {emailLogs.length === 0 ? (
                <div className="extras-empty-state">
                  <p className="extras-empty-sub">No email broadcasts dispatched yet.</p>
                </div>
              ) : (
                <div className="extras-feed-list">
                  {emailLogs.map((log) => (
                    <div key={log.id} className="extras-feed-item">
                      <div className="extras-feed-item-top">
                        <h4 className="extras-feed-item-title">{log.to}</h4>
                        <span className="extras-feed-item-badge">{log.status}</span>
                      </div>
                      <p className="extras-feed-item-desc">
                        <strong>Subject:</strong> {log.subject}
                      </p>
                      <div className="extras-feed-item-meta">
                        <span>{log.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
