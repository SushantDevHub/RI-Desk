import { useState, useEffect } from 'react';
import {
  getAllAnnouncementsAdmin,
  createAnnouncement,
  toggleAnnouncementStatus,
  deleteAnnouncement,
} from '../api/announcementApi.js';
import './ExtrasPage.css';
import './DashboardPage.css';
import './TicketManagementPage.css';

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

  // Delete Announcement Modal State
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  // Delete Announcement Confirmation
  const confirmDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    setDeletingAnnouncement(true);
    setDeleteError('');
    try {
      await deleteAnnouncement(announcementToDelete.id);
      setNewsList((prev) => prev.filter((item) => item.id !== announcementToDelete.id));
      showSuccess('Announcement deleted successfully.');
      setAnnouncementToDelete(null);
    } catch (err) {
      console.error('Failed to delete announcement:', err);
      setDeleteError(err.message || 'Failed to delete announcement.');
    } finally {
      setDeletingAnnouncement(false);
    }
  };

  return (
    <div className="extras-page">
      {/* ── Tab Switcher Bar (Only rendered if multiple modules exist) ── */}
      {EXTRAS_MODULE_CONFIG.length > 1 && (
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
      )}

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="extras-screenshot-label" style={{ margin: 0 }}>
                      Message <span className="extras-req-star">*</span>
                    </label>
                    <span style={{ fontSize: '11.5px', color: newsBody.length >= 250 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                      {newsBody.length}/250
                    </span>
                  </div>
                  <textarea
                    className="extras-screenshot-textarea"
                    placeholder="Type news message (max 250 characters)..."
                    rows={2}
                    maxLength={250}
                    value={newsBody}
                    onChange={(e) => setNewsBody(e.target.value.slice(0, 250))}
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
                          onClick={() => {
                            setAnnouncementToDelete(item);
                            setDeleteError('');
                          }}
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

      {/* ────────────────────────────────────────────────────────
          DELETE CONFIRMATION DIALOG (UNIFIED SYSTEM DELETE DIALOG)
      ──────────────────────────────────────────────────────── */}
      {announcementToDelete && (
        <div
          className="ticket-dialog-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deletingAnnouncement) {
              setAnnouncementToDelete(null);
              setDeleteError('');
            }
          }}
        >
          <section
            className="ticket-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-announcement-title"
          >
            <div className="ticket-delete-symbol">
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v5M14 11v5" />
              </svg>
            </div>

            <h2 id="delete-announcement-title">Delete Announcement?</h2>

            <p>
              Are you sure you want to delete announcement{' '}
              <strong>
                "{announcementToDelete.title || announcementToDelete.content?.slice(0, 40) || 'this announcement'}"
              </strong>?{' '}
              This action cannot be undone.
            </p>

            {deleteError && (
              <div className="ticket-dialog-error" role="alert" style={{ marginBottom: 16 }}>
                {deleteError}
              </div>
            )}

            <div className="ticket-dialog-actions">
              <button
                type="button"
                className="ticket-cancel-button"
                onClick={() => {
                  setAnnouncementToDelete(null);
                  setDeleteError('');
                }}
                disabled={deletingAnnouncement}
              >
                Cancel
              </button>

              <button
                type="button"
                className="ticket-confirm-delete"
                onClick={confirmDeleteAnnouncement}
                disabled={deletingAnnouncement}
              >
                {deletingAnnouncement ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
