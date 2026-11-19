import { useState, useEffect, useMemo } from 'react';
import { getToken } from '../api/authApi.js';
import './ClientManagementPage.css';

const API_URL = 'http://localhost:4000/api/clients';

// Predefined catalog for Services (Alphabetical order matching filter dropdown)
const PREDEFINED_SERVICES = [
  'Broadband',
  'Cable TV',
  'DTH',
  'Electricity',
  'Fastag',
  'Finance',
  'Gift Cards',
  'Insurance',
  'LPG Booking',
  'Landline',
  'Mobile',
  'Payment',
  'Pipe Gas',
  'Postpaid',
  'Recharge',
  'Technical',
  'Wallet',
  'Water',
];

const SERVICES_VERSION = 'v2_recharge_utilities';

// Predefined catalog for Features
const PREDEFINED_FEATURES = [
  'WhatsApp',
  'Email',
  'SMS',
];

const EMPTY_FORM = {
  name: '',
  companyName: '',
  address: '',
  website: '',
  mobileNumber: '',
  email: '',
  whatsappNumber: '',
  cityState: '',
  monthlyRental: '',
  services: [],
  features: [],
  status: 'active',
};

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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
    data = { error: text || `HTTP ${res.status}` };
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

export default function ClientManagementPage({ isAdmin = true }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [featureFilter, setFeatureFilter] = useState('all');

  // Modals
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);

  // Form state
  const [form, setForm] = useState(EMPTY_FORM);
  const [customFeatureInput, setCustomFeatureInput] = useState('');
  const [showCustomFeature, setShowCustomFeature] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await readResponse(res);
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (err) {
      setError(err.message || 'Failed to load clients.');
    } finally {
      setLoading(false);
    }
  }

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  }

  function openCreateDialog() {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setCustomFeatureInput('');
    setShowCustomFeature(false);
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(client) {
    setEditingClient(client);
    const clientServices = Array.isArray(client.services)
      ? [...client.services]
      : Array.isArray(client.servicesFeatures)
      ? [...client.servicesFeatures]
      : [];
    const clientFeatures = Array.isArray(client.features) ? [...client.features] : [];

    setForm({
      name: client.name || '',
      companyName: client.companyName || '',
      address: client.address || '',
      website: client.website || '',
      mobileNumber: client.mobileNumber || '',
      email: client.email || '',
      whatsappNumber: client.whatsappNumber || client.mobileNumber || '',
      cityState: client.cityState || '',
      monthlyRental: client.monthlyRental !== undefined ? String(client.monthlyRental) : '',
      services: clientServices,
      features: clientFeatures,
      status: client.status || 'active',
    });

    setCustomFeatureInput('');
    setShowCustomFeature(false);
    setFormError('');
    setDialogOpen(true);
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSameAsMobile() {
    setForm((prev) => ({ ...prev, whatsappNumber: prev.mobileNumber }));
  }

  // ── Service tag handlers ──
  function toggleService(service) {
    setForm((prev) => {
      const exists = prev.services.includes(service);
      const updated = exists
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service];
      return { ...prev, services: updated };
    });
  }

  function removeService(serviceToRemove) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s !== serviceToRemove),
    }));
  }

  // ── Feature tag handlers ──
  function handleAddCustomFeature(e) {
    if (e) e.preventDefault();
    const trimmed = customFeatureInput.trim();
    if (!trimmed) return;
    if (!form.features.includes(trimmed)) {
      setForm((prev) => ({
        ...prev,
        features: [...prev.features, trimmed],
      }));
    }
    setCustomFeatureInput('');
    setShowCustomFeature(false);
  }

  function removeFeature(featureToRemove) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== featureToRemove),
    }));
  }

  function handleFeatureDropdownChange(e) {
    const val = e.target.value;
    if (val === '__custom__') {
      setShowCustomFeature(true);
      return;
    }
    if (!val) {
      setForm((prev) => ({ ...prev, features: [] }));
      return;
    }
    if (form.features.length <= 1) {
      setForm((prev) => ({ ...prev, features: [val] }));
    } else {
      if (!form.features.includes(val)) {
        setForm((prev) => ({
          ...prev,
          features: [...prev.features, val],
        }));
      }
    }
  }

  async function handleSaveClient(e) {
    e.preventDefault();
    setFormError('');

    const trimmedName = form.name.trim();
    const trimmedCompany = form.companyName.trim();
    const trimmedMobile = form.mobileNumber.trim();

    if (!trimmedName) {
      setFormError('Contact person name is required.');
      return;
    }
    if (!trimmedCompany) {
      setFormError('Company name is required.');
      return;
    }
    if (!trimmedMobile) {
      setFormError('Mobile number is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: trimmedName,
        companyName: trimmedCompany,
        address: form.address.trim(),
        website: form.website.trim(),
        mobileNumber: trimmedMobile,
        email: form.email.trim(),
        whatsappNumber: form.whatsappNumber.trim() || trimmedMobile,
        cityState: form.cityState.trim(),
        monthlyRental: Number(form.monthlyRental) || 0,
        services: form.services,
        features: form.features,
        status: form.status,
      };

      if (editingClient) {
        const res = await fetch(`${API_URL}/${encodeURIComponent(editingClient.id)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await readResponse(res);
        setClients((prev) =>
          prev.map((c) => (c.id === editingClient.id ? data.client : c))
        );
        showNotice(`✓ Client "${trimmedCompany}" updated successfully.`);
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
        setClients((prev) => [data.client, ...prev]);
        showNotice(`✓ Client "${trimmedCompany}" created successfully.`);
      }

      setDialogOpen(false);
      setEditingClient(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err.message || 'Failed to save client.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClient() {
    if (!clientToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API_URL}/${encodeURIComponent(clientToDelete.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      await readResponse(res);
      setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      showNotice(`✓ Client "${clientToDelete.companyName}" deleted.`);
      setClientToDelete(null);
    } catch (err) {
      alert(err.message || 'Failed to delete client.');
    } finally {
      setDeleting(false);
    }
  }

  // Catalogs across active clients for filter dropdowns
  const allUsedServices = useMemo(() => {
    const set = new Set(PREDEFINED_SERVICES);
    clients.forEach((c) => {
      if (Array.isArray(c.services)) c.services.forEach((s) => set.add(s));
    });
    return Array.from(set).sort();
  }, [clients]);

  const allUsedFeatures = useMemo(() => {
    const set = new Set(PREDEFINED_FEATURES);
    clients.forEach((c) => {
      if (Array.isArray(c.features)) {
        c.features.forEach((f) => {
          if (f && typeof f === 'string') set.add(f.trim());
        });
      }
    });
    return Array.from(set).filter(Boolean).sort();
  }, [clients]);

  // Statistics
  const totalRevenue = useMemo(() => {
    return clients
      .filter((c) => c.status === 'active')
      .reduce((sum, c) => sum + (Number(c.monthlyRental) || 0), 0);
  }, [clients]);

  const activeClientsCount = useMemo(() => {
    return clients.filter((c) => c.status === 'active').length;
  }, [clients]);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (statusFilter !== 'all' && client.status !== statusFilter) return false;

      if (serviceFilter !== 'all') {
        const hasService =
          Array.isArray(client.services) && client.services.includes(serviceFilter);
        if (!hasService) return false;
      }

      if (featureFilter !== 'all') {
        const hasFeature =
          Array.isArray(client.features) && client.features.includes(featureFilter);
        if (!hasFeature) return false;
      }

      if (!q) return true;
      const matchName = String(client.name || '').toLowerCase().includes(q);
      const matchCompany = String(client.companyName || '').toLowerCase().includes(q);
      const matchMobile = String(client.mobileNumber || '').toLowerCase().includes(q);
      const matchEmail = String(client.email || '').toLowerCase().includes(q);
      const matchCityState = String(client.cityState || '').toLowerCase().includes(q);
      const matchWebsite = String(client.website || '').toLowerCase().includes(q);
      const matchServices =
        Array.isArray(client.services) &&
        client.services.some((s) => String(s || '').toLowerCase().includes(q));
      const matchFeatures =
        Array.isArray(client.features) &&
        client.features.some((f) => String(f || '').toLowerCase().includes(q));

      return (
        matchName ||
        matchCompany ||
        matchMobile ||
        matchEmail ||
        matchCityState ||
        matchWebsite ||
        matchServices ||
        matchFeatures
      );
    });
  }, [clients, search, statusFilter, serviceFilter, featureFilter]);

  return (
    <div className="client-page">
      {/* ── Page Header ── */}
      <div className="client-page-header">
        <div>
          <h1 className="db-page-title">Client Management</h1>
          <p className="db-page-sub">
            Manage company profiles, monthly rentals, subscribed services, and active features.
          </p>
        </div>

        <div className="client-header-actions ticket-header-actions">
          <button
            type="button"
            className="ticket-create-button client-create-btn"
            onClick={openCreateDialog}
          >
            + Create Client
          </button>
        </div>
      </div>

      {/* ── Notice Toast ── */}
      {notice && (
        <div className="client-notice" role="status">
          {notice}
        </div>
      )}

      {/* ── Overview Statistics Cards ── */}
      <div className="client-stat-grid">
        <div className="client-stat-card">
          <div className="client-stat-label">Total Clients</div>
          <div className="client-stat-num">{clients.length}</div>
          <div className="client-stat-sub">Registered accounts</div>
        </div>

        <div className="client-stat-card stat-accent-green">
          <div className="client-stat-label">Active Clients</div>
          <div className="client-stat-num">{activeClientsCount}</div>
          <div className="client-stat-sub">Active billing accounts</div>
        </div>

        <div className="client-stat-card stat-accent-indigo">
          <div className="client-stat-label">Monthly Rental Revenue</div>
          <div className="client-stat-num">{formatCurrency(totalRevenue)}</div>
          <div className="client-stat-sub">Recurring monthly billings</div>
        </div>

        <div className="client-stat-card stat-accent-blue">
          <div className="client-stat-label">Total Services</div>
          <div className="client-stat-num">{allUsedServices.length}</div>
          <div className="client-stat-sub">Active solution types</div>
        </div>

        <div className="client-stat-card stat-accent-emerald">
          <div className="client-stat-label">Total Features</div>
          <div className="client-stat-num">{allUsedFeatures.length}</div>
          <div className="client-stat-sub">Add-ons deployed</div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="client-toolbar">
        <div className="client-search-wrap">
          <svg
            className="client-search-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="client-search-input"
            placeholder="Search by name, company, mobile, email, services or features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
          />
        </div>

        <div className="client-filters-wrap">
          <select
            className="client-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <select
            className="client-filter-select select-services-filter"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            aria-label="Filter by service"
          >
            <option value="all">All Services</option>
            {allUsedServices.map((svc) => (
              <option key={svc} value={svc}>
                {svc}
              </option>
            ))}
          </select>

          <select
            className="client-filter-select select-features-filter"
            value={featureFilter}
            onChange={(e) => setFeatureFilter(e.target.value)}
            aria-label="Filter by feature"
          >
            <option value="all">All Features</option>
            {allUsedFeatures.map((feat) => (
              <option key={feat} value={feat}>
                {feat}
              </option>
            ))}
          </select>

          {(search || statusFilter !== 'all' || serviceFilter !== 'all' || featureFilter !== 'all') && (
            <button
              type="button"
              className="client-clear-filters-btn"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setServiceFilter('all');
                setFeatureFilter('all');
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="client-error-banner" role="alert">
          {error}
        </div>
      )}

      {/* ── Main Clients Table ── */}
      {loading ? (
        <div className="client-empty-state">
          <div className="client-spinner" />
          <p>Loading clients...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="client-empty-state">
          <div className="client-empty-icon">🏢</div>
          <h3>No clients found</h3>
          <p>
            {search || statusFilter !== 'all' || serviceFilter !== 'all' || featureFilter !== 'all'
              ? 'No clients match your filter criteria. Try adjusting your search query.'
              : 'Get started by creating your first client profile with company details, services, and features.'}
          </p>
          <button
            type="button"
            className="ticket-create-button client-create-btn"
            style={{ marginTop: 12 }}
            onClick={openCreateDialog}
          >
            + Create Client
          </button>
        </div>
      ) : (
        <div className="client-table-card">
          <div className="client-table-scroll">
            <table className="client-table">
              <thead>
                <tr>
                  <th style={{ width: 95 }}>Client ID</th>
                  <th>Company &amp; Contact Person</th>
                  <th>Contact Details</th>
                  <th>City / State</th>
                  <th style={{ width: 135 }}>Monthly Rental</th>
                  {/* Distinct Block 1: Services */}
                  <th style={{ minWidth: 170 }}>Services</th>
                  {/* Distinct Block 2: Features */}
                  <th style={{ minWidth: 180 }}>Features</th>
                  <th style={{ width: 85, textAlign: 'center' }}>Status</th>
                  <th style={{ width: 105, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const servicesList = Array.isArray(client.services) ? client.services : [];
                  const featuresList = Array.isArray(client.features) ? client.features : [];

                  const dispServices = servicesList.slice(0, 2);
                  const extraServices = servicesList.length - dispServices.length;

                  const dispFeatures = featuresList.slice(0, 2);
                  const extraFeatures = featuresList.length - dispFeatures.length;

                  return (
                    <tr key={client.id} className="client-table-row">
                      {/* ID */}
                      <td>
                        <span className="client-id-badge">{client.id}</span>
                      </td>

                      {/* Company & Name */}
                      <td>
                        <div className="client-company-cell">
                          <button
                            type="button"
                            className="client-name-btn"
                            onClick={() => setViewingClient(client)}
                            title="View full profile"
                          >
                            {client.companyName}
                          </button>
                          <div className="client-contact-person">
                            <span className="client-person-dot">•</span>
                            <span>{client.name}</span>
                            {client.ticketCount !== undefined && client.ticketCount > 0 && (
                              <span
                                className="client-ticket-pill"
                                title={`${client.ticketCount} ticket(s) registered in RI-Desk`}
                              >
                                🎫 {client.ticketCount} {client.ticketCount === 1 ? 'ticket' : 'tickets'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td>
                        <div className="client-contacts-block">
                          <div className="client-contact-line">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            <strong>{client.mobileNumber}</strong>
                            {client.whatsappNumber && (
                              <span
                                className="client-wa-badge"
                                title={`WhatsApp: ${client.whatsappNumber}`}
                              >
                                WA
                              </span>
                            )}
                          </div>
                          {client.email && (
                            <div className="client-contact-subline">{client.email}</div>
                          )}
                          {client.website && (
                            <a
                              href={
                                client.website.startsWith('http')
                                  ? client.website
                                  : `https://${client.website}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="client-website-link"
                            >
                              {client.website.replace(/^https?:\/\//i, '')} ↗
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td>
                        <div className="client-location-cell">
                          <span className="client-city-text">
                            {client.cityState || '—'}
                          </span>
                          {client.address && (
                            <span className="client-address-text" title={client.address}>
                              {client.address}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Monthly Rental */}
                      <td>
                        <span className="client-rental-badge">
                          {formatCurrency(client.monthlyRental)}
                          <span className="client-rental-period">/mo</span>
                        </span>
                      </td>

                      {/* ── Dedicated Block 1: Services ── */}
                      <td>
                        <div className="client-tags-cell-block services-cell-block">
                          {dispServices.map((svc) => (
                            <span key={svc} className="client-service-pill">
                              <span className="service-bullet">◆</span>
                              {svc}
                            </span>
                          ))}
                          {extraServices > 0 && (
                            <span
                              className="client-service-pill pill-more"
                              title={servicesList.slice(2).join(', ')}
                            >
                              +{extraServices} more
                            </span>
                          )}
                          {servicesList.length === 0 && (
                            <span className="client-no-items">None</span>
                          )}
                        </div>
                      </td>

                      {/* ── Dedicated Block 2: Features ── */}
                      <td>
                        <div className="client-tags-cell-block features-cell-block">
                          {dispFeatures.map((feat) => (
                            <span key={feat} className="client-feature-pill">
                              <span className="feature-bullet">✓</span>
                              {feat}
                            </span>
                          ))}
                          {extraFeatures > 0 && (
                            <span
                              className="client-feature-pill pill-more"
                              title={featuresList.slice(2).join(', ')}
                            >
                              +{extraFeatures} more
                            </span>
                          )}
                          {featuresList.length === 0 && (
                            <span className="client-no-items">None</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`client-status-badge ${
                            client.status === 'active' ? 'status-active' : 'status-inactive'
                          }`}
                        >
                          <span className="client-status-dot" />
                          {client.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="client-row-actions">
                          <button
                            type="button"
                            className="client-icon-btn view-btn"
                            onClick={() => setViewingClient(client)}
                            title="View Client Details"
                            aria-label="View Details"
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
                              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className="ticket-icon-button ticket-edit-icon client-icon-btn edit-btn"
                            onClick={() => openEditDialog(client)}
                            title="Edit Client"
                            aria-label="Edit Client"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className="ticket-icon-button ticket-delete-icon client-icon-btn delete-btn"
                            onClick={() => setClientToDelete(client)}
                            title="Delete Client"
                            aria-label="Delete Client"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v5M14 11v5" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          CREATE / EDIT CLIENT MODAL DIALOG
      ──────────────────────────────────────────────────────── */}
      {dialogOpen && (
        <div
          className="client-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setDialogOpen(false);
          }}
        >
          <div className="client-modal-box">
            <div className="client-modal-header">
              <div>
                <h2 className="client-modal-title">
                  {editingClient ? `Edit Client: ${editingClient.companyName}` : 'Add New Client'}
                </h2>
                <p className="client-modal-sub">
                  Fill in company details, contact information, monthly rental, and configure Services &amp; Features.
                </p>
              </div>
              <button
                type="button"
                className="client-modal-close-btn"
                onClick={() => !saving && setDialogOpen(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="client-modal-form">
              {formError && (
                <div className="client-form-error" role="alert">
                  {formError}
                </div>
              )}

              {/* Grid Section 1: Basic Company & Contact Person */}
              <div className="client-form-row">
                <div className="client-form-field">
                  <label htmlFor="client-company-name">
                    Company Name <span className="req-star">*</span>
                  </label>
                  <input
                    id="client-company-name"
                    type="text"
                    required
                    placeholder="e.g. Acme Corp"
                    value={form.companyName}
                    onChange={(e) => handleFormChange('companyName', e.target.value)}
                  />
                </div>

                <div className="client-form-field">
                  <label htmlFor="client-contact-name">
                    Contact Person Name <span className="req-star">*</span>
                  </label>
                  <input
                    id="client-contact-name"
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                  />
                </div>
              </div>

              {/* Grid Section 2: Contact Details */}
              <div className="client-form-row">
                <div className="client-form-field">
                  <label htmlFor="client-mobile">
                    Mobile Number <span className="req-star">*</span>
                  </label>
                  <input
                    id="client-mobile"
                    type="tel"
                    required
                    placeholder="e.g. 9823456789"
                    value={form.mobileNumber}
                    onChange={(e) => handleFormChange('mobileNumber', e.target.value)}
                  />
                </div>

                <div className="client-form-field">
                  <div className="client-label-with-action">
                    <label htmlFor="client-whatsapp">WhatsApp Number</label>
                    <button
                      type="button"
                      className="client-same-mobile-btn"
                      onClick={handleSameAsMobile}
                    >
                      Same as Mobile
                    </button>
                  </div>
                  <input
                    id="client-whatsapp"
                    type="tel"
                    placeholder="e.g. 9823456789"
                    value={form.whatsappNumber}
                    onChange={(e) => handleFormChange('whatsappNumber', e.target.value)}
                  />
                </div>
              </div>

              {/* Grid Section 3: Email & Website */}
              <div className="client-form-row">
                <div className="client-form-field">
                  <label htmlFor="client-email">Email Address</label>
                  <input
                    id="client-email"
                    type="email"
                    placeholder="e.g. contact@company.com"
                    value={form.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                  />
                </div>

                <div className="client-form-field">
                  <label htmlFor="client-website">Website URL</label>
                  <input
                    id="client-website"
                    type="url"
                    placeholder="e.g. https://company.com"
                    value={form.website}
                    onChange={(e) => handleFormChange('website', e.target.value)}
                  />
                </div>
              </div>

              {/* Grid Section 4: Location & City/State */}
              <div className="client-form-row">
                <div className="client-form-field">
                  <label htmlFor="client-city-state">City / State</label>
                  <input
                    id="client-city-state"
                    type="text"
                    placeholder="e.g. Noida, Uttar Pradesh"
                    value={form.cityState}
                    onChange={(e) => handleFormChange('cityState', e.target.value)}
                  />
                </div>

                <div className="client-form-field">
                  <label htmlFor="client-monthly-rental">
                    Monthly Rental (₹)
                  </label>
                  <input
                    id="client-monthly-rental"
                    type="number"
                    min="0"
                    step="500"
                    placeholder="e.g. 18500"
                    value={form.monthlyRental}
                    onChange={(e) => handleFormChange('monthlyRental', e.target.value)}
                  />
                </div>
              </div>

              {/* Full Width: Address */}
              <div className="client-form-field">
                <label htmlFor="client-address">Office Address</label>
                <input
                  id="client-address"
                  type="text"
                  placeholder="e.g. 4th Floor, Infinity Tower, Sector 62"
                  value={form.address}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                />
              </div>

              {/* Status Radio / Select */}
              <div className="client-form-field">
                <label>Account Status</label>
                <div className="client-status-radios">
                  <label className="client-radio-opt">
                    <input
                      type="radio"
                      name="client-status"
                      value="active"
                      checked={form.status === 'active'}
                      onChange={() => handleFormChange('status', 'active')}
                    />
                    <span className="client-radio-label">
                      <span className="client-status-dot dot-active" /> Active
                    </span>
                  </label>
                  <label className="client-radio-opt">
                    <input
                      type="radio"
                      name="client-status"
                      value="inactive"
                      checked={form.status === 'inactive'}
                      onChange={() => handleFormChange('status', 'inactive')}
                    />
                    <span className="client-radio-label">
                      <span className="client-status-dot dot-inactive" /> Inactive
                    </span>
                  </label>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════
                  SERVICES & FEATURES ROW (DROPDOWNS)
              ════════════════════════════════════════════════════════ */}
              <div className="client-form-row">
                {/* ── Services Dropdown ── */}
                <div className="client-form-field">
                  <label htmlFor="client-services-select">
                    Services <span className="req-star">*</span>
                  </label>
                  <select
                    id="client-services-select"
                    className="client-form-select"
                    value={Array.isArray(form.services) && form.services.length > 0 ? form.services[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        services: val ? [val] : [],
                      }));
                    }}
                    required
                  >
                    <option value="">Select Service</option>
                    {PREDEFINED_SERVICES.map((svc) => (
                      <option key={svc} value={svc}>
                        {svc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ── Features Dropdown (WhatsApp, Email, SMS, Custom) ── */}
                <div className="client-form-field">
                  <div className="client-label-with-action">
                    <label htmlFor="client-features-select">
                      Features
                    </label>
                    {!showCustomFeature && (
                      <button
                        type="button"
                        className="client-same-mobile-btn"
                        onClick={() => setShowCustomFeature(true)}
                        title="Add a custom feature"
                      >
                        + Add Custom
                      </button>
                    )}
                  </div>
                  <select
                    id="client-features-select"
                    className="client-form-select"
                    value={
                      form.features.length === 1 && PREDEFINED_FEATURES.includes(form.features[0])
                        ? form.features[0]
                        : ''
                    }
                    onChange={handleFeatureDropdownChange}
                  >
                    <option value="">Select Feature</option>
                    {PREDEFINED_FEATURES.map((feat) => (
                      <option key={feat} value={feat}>
                        {feat}
                      </option>
                    ))}
                    <option value="__custom__">+ Custom Feature...</option>
                  </select>
                </div>
              </div>

              {/* Custom Feature Input Bar (when toggled or selected) */}
              {showCustomFeature && (
                <div className="client-custom-tag-bar">
                  <input
                    type="text"
                    placeholder="Type custom feature (e.g. Webhook, CRM Sync, IVR)..."
                    value={customFeatureInput}
                    onChange={(e) => setCustomFeatureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomFeature();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="client-add-tag-btn btn-feature-add"
                    onClick={handleAddCustomFeature}
                    disabled={!customFeatureInput.trim()}
                  >
                    + Add Feature
                  </button>
                  <button
                    type="button"
                    className="client-modal-cancel-btn"
                    style={{ padding: '0 12px', minHeight: 35, height: 35, fontSize: 12 }}
                    onClick={() => {
                      setShowCustomFeature(false);
                      setCustomFeatureInput('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Selected Feature Badges with remove cross */}
              {form.features.length > 0 && (
                <div
                  className="client-selected-tags-box feature-tags-box"
                  style={{ minHeight: 'auto', padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}
                >
                  {form.features.map((feat) => (
                    <span key={feat} className="client-selected-tag-pill pill-feature">
                      <span className="pill-dot">✓</span>
                      {feat}
                      <button
                        type="button"
                        className="client-tag-remove-x"
                        onClick={() => removeFeature(feat)}
                        aria-label={`Remove feature ${feat}`}
                        title={`Remove ${feat}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Form Actions */}
              <div className="client-modal-actions ticket-dialog-actions">
                <button
                  type="button"
                  className="ticket-cancel-button client-modal-cancel-btn"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ticket-create-button client-modal-submit-btn"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          VIEW CLIENT DETAILS MODAL
      ──────────────────────────────────────────────────────── */}
      {viewingClient && (
        <div
          className="client-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewingClient(null);
          }}
        >
          <div className="client-view-box">
            <div className="client-view-header">
              <div className="client-view-header-left">
                <div className="client-view-avatar">
                  {viewingClient.companyName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="client-view-title">{viewingClient.companyName}</h2>
                  <div className="client-view-subtitle">
                    <span className="client-id-badge">{viewingClient.id}</span>
                    <span className="client-dot-sep">•</span>
                    <span>Contact: <strong>{viewingClient.name}</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="client-modal-close-btn"
                onClick={() => setViewingClient(null)}
              >
                ✕
              </button>
            </div>

            <div className="client-view-body">
              {/* Top Banner: Rental & Status */}
              <div className="client-view-metric-strip">
                <div className="client-metric-item">
                  <span className="client-metric-lbl">Monthly Rental</span>
                  <span className="client-metric-val">
                    {formatCurrency(viewingClient.monthlyRental)}
                    <span style={{ fontSize: 13, color: '#64748b' }}> / mo</span>
                  </span>
                </div>

                <div className="client-metric-item">
                  <span className="client-metric-lbl">Account Status</span>
                  <span
                    className={`client-status-badge ${
                      viewingClient.status === 'active' ? 'status-active' : 'status-inactive'
                    }`}
                  >
                    <span className="client-status-dot" />
                    {viewingClient.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="client-metric-item">
                  <span className="client-metric-lbl">Client Since</span>
                  <span className="client-metric-val-date">
                    {formatDate(viewingClient.createdAt)}
                  </span>
                </div>
              </div>

              {/* Contact Information */}
              <div className="client-view-section">
                <div className="client-section-heading">Contact Information</div>
                <div className="client-view-grid">
                  <div className="client-view-field">
                    <span className="client-field-label">Mobile Number</span>
                    <span className="client-field-value">
                      <strong>{viewingClient.mobileNumber || '—'}</strong>
                    </span>
                  </div>

                  <div className="client-view-field">
                    <span className="client-field-label">WhatsApp Number</span>
                    <span className="client-field-value">
                      {viewingClient.whatsappNumber ? (
                        <span className="client-wa-val">
                          <span className="client-wa-badge">WA</span>
                          {viewingClient.whatsappNumber}
                        </span>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  <div className="client-view-field">
                    <span className="client-field-label">Email Address</span>
                    <span className="client-field-value">
                      {viewingClient.email ? (
                        <a href={`mailto:${viewingClient.email}`} className="client-link">
                          {viewingClient.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  <div className="client-view-field">
                    <span className="client-field-label">Website</span>
                    <span className="client-field-value">
                      {viewingClient.website ? (
                        <a
                          href={
                            viewingClient.website.startsWith('http')
                              ? viewingClient.website
                              : `https://${viewingClient.website}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="client-link"
                        >
                          {viewingClient.website} ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="client-view-section">
                <div className="client-section-heading">Location &amp; Address</div>
                <div className="client-view-grid">
                  <div className="client-view-field">
                    <span className="client-field-label">City / State</span>
                    <span className="client-field-value">
                      {viewingClient.cityState || '—'}
                    </span>
                  </div>
                  <div className="client-view-field" style={{ gridColumn: 'span 2' }}>
                    <span className="client-field-label">Office Address</span>
                    <span className="client-field-value">
                      {viewingClient.address || 'No street address provided.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── View Block 1: Subscribed Services ── */}
              <div className="client-view-section">
                <div className="client-section-heading">
                  <span className="sec-icon">⚡</span> Subscribed Services (
                  {Array.isArray(viewingClient.services) ? viewingClient.services.length : 0})
                </div>
                <div className="client-view-tags-cloud">
                  {Array.isArray(viewingClient.services) && viewingClient.services.length > 0 ? (
                    viewingClient.services.map((svc) => (
                      <span key={svc} className="client-view-service-chip">
                        <span className="chip-bullet">◆</span>
                        {svc}
                      </span>
                    ))
                  ) : (
                    <span className="client-no-items">No services assigned.</span>
                  )}
                </div>
              </div>

              {/* ── View Block 2: Active Features ── */}
              <div className="client-view-section">
                <div className="client-section-heading">
                  <span className="sec-icon">🛡️</span> Active Features &amp; Add-ons (
                  {Array.isArray(viewingClient.features) ? viewingClient.features.length : 0})
                </div>
                <div className="client-view-tags-cloud">
                  {Array.isArray(viewingClient.features) && viewingClient.features.length > 0 ? (
                    viewingClient.features.map((feat) => (
                      <span key={feat} className="client-view-feature-chip">
                        <span className="chip-bullet">✓</span>
                        {feat}
                      </span>
                    ))
                  ) : (
                    <span className="client-no-items">No features or add-ons assigned.</span>
                  )}
                </div>
              </div>

              {/* ── View Block 3: Associated Tickets ── */}
              <div className="client-view-section">
                <div className="client-section-heading">
                  <span className="sec-icon">🎫</span> Associated Tickets (
                  {Array.isArray(viewingClient.tickets) ? viewingClient.tickets.length : viewingClient.ticketCount || 0})
                </div>
                {Array.isArray(viewingClient.tickets) && viewingClient.tickets.length > 0 ? (
                  <div className="client-tickets-list">
                    {viewingClient.tickets.map((tkt) => (
                      <div key={tkt.id} className="client-ticket-card">
                        <div className="client-ticket-top">
                          <span className="client-ticket-id">{tkt.id}</span>
                          <span className={`client-status-badge ${tkt.status === 'resolved' ? 'status-active' : 'status-inactive'}`}>
                            <span className="client-status-dot" />
                            {tkt.status ? tkt.status.charAt(0).toUpperCase() + tkt.status.slice(1) : 'Open'}
                          </span>
                          <span className="client-service-pill" style={{ fontSize: 11, padding: '2px 8px' }}>
                            <span className="service-bullet">◆</span>
                            {tkt.priority ? tkt.priority.charAt(0).toUpperCase() + tkt.priority.slice(1) : 'Medium'}
                          </span>
                        </div>
                        <div className="client-ticket-subject">{tkt.subject}</div>
                        <div className="client-ticket-meta">
                          <span className="client-ticket-cat">Category: <strong>{tkt.category}</strong></span>
                          {tkt.createdAt && (
                            <span className="client-ticket-date">{formatDate(tkt.createdAt)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="client-no-items">No tickets linked to this client.</span>
                )}
              </div>
            </div>

            <div className="client-view-footer ticket-dialog-actions">
              <button
                type="button"
                className="ticket-cancel-button client-edit-direct-btn"
                onClick={() => {
                  const toEdit = viewingClient;
                  setViewingClient(null);
                  openEditDialog(toEdit);
                }}
              >
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
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                </svg>
                <span>Edit Client</span>
              </button>
              <button
                type="button"
                className="ticket-create-button client-modal-close-action"
                onClick={() => setViewingClient(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          DELETE CONFIRMATION DIALOG
      ──────────────────────────────────────────────────────── */}
      {clientToDelete && (
        <div
          className="client-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) setClientToDelete(null);
          }}
        >
          <div className="client-delete-box">
            <div className="client-delete-icon">⚠️</div>
            <h3>Delete Client?</h3>
            <p>
              Are you sure you want to delete <strong>{clientToDelete.companyName}</strong> (
              {clientToDelete.name})? This will permanently remove their profile, monthly rental,
              subscribed services, and features from the system.
            </p>
            <div className="client-delete-actions ticket-dialog-actions">
              <button
                type="button"
                className="ticket-cancel-button client-modal-cancel-btn"
                onClick={() => setClientToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ticket-confirm-delete client-confirm-delete-btn"
                onClick={handleDeleteClient}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
