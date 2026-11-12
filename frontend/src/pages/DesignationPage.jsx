import { useState, useEffect } from 'react';
import { getToken } from '../api/authApi.js';
import './DashboardPage.css';

const API_URL = 'http://localhost:4000/api/designations';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

async function readResponse(res) {
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error:
        text && text.includes('<!DOCTYPE')
          ? 'Backend endpoint returned HTML. Please ensure backend server is restarted and running.'
          : text || `HTTP ${res.status}`,
    };
  }
  if (!res.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `Request failed with status ${res.status}`
    );
  }
  return data;
}

export default function DesignationPage({ isAdmin = true }) {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [form, setForm] = useState({
    title: '',
    code: '',
    department: 'Support',
    description: '',
    status: 'active',
  });
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  // Fetch real designations from backend API on mount
  useEffect(() => {
    // Purge any legacy dummy data from localStorage
    try {
      localStorage.removeItem('ri_desk_designations');
    } catch {
      // ignore
    }
    fetchDesignations();
  }, []);

  async function fetchDesignations() {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = await readResponse(res);
      setDesignations(Array.isArray(data.designations) ? data.designations : []);
    } catch (err) {
      setError(err.message || 'Failed to load designations.');
    } finally {
      setLoading(false);
    }
  }

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  }

  function openCreate() {
    setEditingItem(null);
    setForm({
      title: '',
      code: '',
      department: 'Support',
      description: '',
      status: 'active',
    });
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm({
      title: item.title,
      code: item.code || '',
      department: item.department || 'Support',
      description: item.description || '',
      status: item.status || 'active',
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const titleTrimmed = form.title.trim();
    if (!titleTrimmed) {
      setFormError('Designation title is required.');
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      const payload = {
        title: titleTrimmed,
        code: form.code.trim().toUpperCase() || titleTrimmed.slice(0, 3).toUpperCase(),
        department: form.department,
        description: form.description.trim(),
        status: form.status,
      };

      if (editingItem) {
        const res = await fetch(`${API_URL}/${editingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await readResponse(res);

        setDesignations((prev) =>
          prev.map((d) => (d.id === editingItem.id ? data.designation : d))
        );
        showNotice(`✓ Designation "${titleTrimmed}" updated.`);
      } else {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await readResponse(res);

        setDesignations((prev) => [data.designation, ...prev]);
        showNotice(`✓ Designation "${titleTrimmed}" created.`);
      }

      setDialogOpen(false);
    } catch (err) {
      setFormError(err.message || 'Failed to save designation.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!itemToDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(`${API_URL}/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      await readResponse(res);

      setDesignations((prev) => prev.filter((d) => d.id !== itemToDelete.id));
      showNotice(`✓ Designation "${itemToDelete.title}" removed.`);
      setItemToDelete(null);
    } catch (err) {
      showNotice(`✕ ${err.message || 'Failed to delete designation.'}`);
    } finally {
      setDeleting(false);
    }
  }

  const departments = Array.from(
    new Set(designations.map((d) => d.department).filter(Boolean))
  );

  const filtered = designations.filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      d.title.toLowerCase().includes(q) ||
      (d.code && d.code.toLowerCase().includes(q)) ||
      (d.department && d.department.toLowerCase().includes(q)) ||
      (d.description && d.description.toLowerCase().includes(q));

    const matchesDept =
      departmentFilter === 'all' || d.department === departmentFilter;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="employee-page designation-page">
      {/* Header */}
      <header className="employee-page-header">
        <div>
          <h1>Designation Management</h1>
          <p>Create, organize, and manage employee designations across departments.</p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="create-employee-top-btn"
            onClick={openCreate}
          >
            + Add Designation
          </button>
        )}
      </header>

      {/* Notice Banner */}
      {notice && (
        <div className="employee-success" role="status">
          {notice}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="employee-error" role="alert" style={{ marginBottom: 16 }}>
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchDesignations}
            style={{
              marginLeft: 12,
              background: 'none',
              border: 'none',
              color: 'inherit',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="db-stats" style={{ marginBottom: 24 }}>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="12" cy="10" r="3" />
              <path d="M7 17a5 5 0 0 1 10 0" />
            </svg>
          </div>
          <div>
            <div className="db-stat-num">{loading ? '…' : designations.length}</div>
            <div className="db-stat-label">Total Designations</div>
          </div>
        </div>

        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <div className="db-stat-num">{loading ? '…' : departments.length}</div>
            <div className="db-stat-label">Departments</div>
          </div>
        </div>

        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className="db-stat-num">
              {loading ? '…' : designations.filter((d) => d.status === 'active').length}
            </div>
            <div className="db-stat-label">Active Roles</div>
          </div>
        </div>
      </div>

      {/* Filter / Search toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="ticket-search-input"
            style={{ width: 240, padding: '8px 12px', fontSize: 13 }}
            placeholder="Search designation or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="ticket-filter-select"
            style={{ padding: '8px 12px', fontSize: 13 }}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>
        </div>

        <div style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
          Showing {filtered.length} {filtered.length === 1 ? 'designation' : 'designations'}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
          Loading designations…
        </div>
      ) : filtered.length === 0 ? (
        <div className="employee-empty" style={{ padding: '40px 20px' }}>
          <h2>No designations found</h2>
          <p>
            {search || departmentFilter !== 'all'
              ? 'Try adjusting your search query or filter.'
              : 'Add your first organization designation to get started.'}
          </p>
          {isAdmin && !search && departmentFilter === 'all' && (
            <button
              type="button"
              className="create-employee-empty-btn"
              onClick={openCreate}
            >
              + Create First Designation
            </button>
          )}
        </div>
      ) : (
        <div className="employee-table-card">
          <table className="employee-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Designation Title</th>
                <th>Code</th>
                <th>Department</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created Date</th>
                {isAdmin && <th style={{ width: 100, textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <tr key={item.id}>
                  <td className="db-mono" style={{ color: '#94a3b8' }}>
                    {index + 1}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {item.title}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: 11.5,
                        background: '#f1f5f9',
                        color: '#475569',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {item.code}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        background: '#e0e7ff',
                        color: '#3730a3',
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 9999,
                      }}
                    >
                      {item.department}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: 13, maxWidth: 280 }}>
                    {item.description || '—'}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: item.status === 'active' ? '#ecfdf5' : '#f1f5f9',
                        color: item.status === 'active' ? '#059669' : '#64748b',
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 9999,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: item.status === 'active' ? '#10b981' : '#94a3b8',
                        }}
                      />
                      {item.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: 12.5 }}>
                    {formatDate(item.createdAt)}
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="ticket-icon-button ticket-edit-icon"
                          title="Edit designation"
                          aria-label={`Edit ${item.title}`}
                          onClick={() => openEdit(item)}
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
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="ticket-icon-button ticket-delete-icon"
                          title="Delete designation"
                          aria-label={`Delete ${item.title}`}
                          onClick={() => setItemToDelete(item)}
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
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      {dialogOpen && (
        <div
          className="ticket-dialog-overlay"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="ticket-dialog"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="ticket-dialog-header">
              <h2>{editingItem ? 'Edit Designation' : 'Create Designation'}</h2>
              <button
                type="button"
                className="ticket-dialog-close"
                onClick={() => setDialogOpen(false)}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="ticket-form-field">
                  <label>Designation Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Support Specialist"
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="ticket-form-field">
                    <label>Code (Abbr)</label>
                    <input
                      type="text"
                      placeholder="e.g. SS"
                      maxLength={6}
                      value={form.code}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, code: e.target.value }))
                      }
                    />
                  </div>

                  <div className="ticket-form-field">
                    <label>Department *</label>
                    <select
                      value={form.department}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, department: e.target.value }))
                      }
                    >
                      <option value="Support">Support</option>
                      <option value="Technical">Technical</option>
                      <option value="Billing">Billing</option>
                      <option value="Operations">Operations</option>
                      <option value="Customer Service">Customer Service</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                </div>

                <div className="ticket-form-field">
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="ticket-form-field">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of the designation responsibilities..."
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="ticket-dialog-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="ticket-button-secondary"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="ticket-create-button" disabled={saving}>
                  {saving
                    ? 'Saving…'
                    : editingItem
                    ? 'Save Changes'
                    : 'Create Designation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div
          className="ticket-dialog-overlay"
          onClick={() => setItemToDelete(null)}
        >
          <div
            className="ticket-dialog"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="ticket-dialog-header">
              <h2>Confirm Deletion</h2>
              <button
                type="button"
                className="ticket-dialog-close"
                onClick={() => setItemToDelete(null)}
              >
                ✕
              </button>
            </div>
            <p style={{ color: '#475569', fontSize: 14, margin: '12px 0 20px' }}>
              Are you sure you want to delete designation{' '}
              <strong>"{itemToDelete.title}"</strong>? This action cannot be undone.
            </p>
            <div className="ticket-dialog-actions">
              <button
                type="button"
                className="ticket-button-secondary"
                onClick={() => setItemToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ticket-delete-confirm-btn"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
