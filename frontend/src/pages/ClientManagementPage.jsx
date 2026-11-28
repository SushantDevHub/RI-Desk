import { useState, useEffect, useMemo, useRef } from 'react';
import { getToken } from '../api/authApi.js';
import { API_BASE } from '../config/api.js';
import ContactClientDialog from '../components/ContactClientDialog.jsx';
import {
  parseClientSpreadsheet,
  downloadClientTemplate,
  exportClientsSpreadsheet,
} from '../utils/clientImportParser.js';
import './ClientManagementPage.css';
import './TicketManagementPage.css';

const API_URL = `${API_BASE}/clients`;

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

const CLIENT_STAT_CONFIG = {
  total: {
    key: 'total',
    title: 'Total Registered Clients List',
    color: '#4f46e5',
    pillBg: '#e0e7ff',
    pillColor: '#3730a3',
    pillBorder: '#c7d2fe',
  },
  active: {
    key: 'active',
    title: 'Active Clients List',
    color: '#059669',
    pillBg: '#d1fae5',
    pillColor: '#065f46',
    pillBorder: '#a7f3d0',
  },
  revenue: {
    key: 'revenue',
    title: 'Monthly Rental Revenue List',
    color: '#6366f1',
    pillBg: '#eef2ff',
    pillColor: '#3730a3',
    pillBorder: '#c7d2fe',
  },
  services: {
    key: 'services',
    title: 'Subscribed Services Clients List',
    color: '#2563eb',
    pillBg: '#dbeafe',
    pillColor: '#1e40af',
    pillBorder: '#bfdbfe',
  },
  features: {
    key: 'features',
    title: 'Active Features Clients List',
    color: '#0d9488',
    pillBg: '#ccfbf1',
    pillColor: '#115e59',
    pillBorder: '#99f6e4',
  },
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

function sortClientsDescending(a, b) {
  const timeA = new Date(a.createdAt || 0).getTime();
  const timeB = new Date(b.createdAt || 0).getTime();
  if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
    return timeB - timeA;
  }
  return String(b.id || '').localeCompare(String(a.id || ''), undefined, {
    numeric: true,
  });
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
  const [cardFilter, setCardFilter] = useState(null);

  // Modals
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [contactDialog, setContactDialog] = useState(null);

  // Bulk Import Modal state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState('skip');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const importFileInputRef = useRef(null);

  // Download dropdown state
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef(null);

  // Pagination state (keeps 400+ client tables ultra-responsive)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  useEffect(() => {
    if (!downloadMenuOpen) return;
    function handleOutside(e) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target)) {
        setDownloadMenuOpen(false);
      }
    }
    function handleEsc(e) {
      if (e.key === 'Escape') setDownloadMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [downloadMenuOpen]);

  // Reset pagination whenever filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, serviceFilter, featureFilter, cardFilter, pageSize]);

  // Close topmost open modal on Escape key for smooth keyboard UX
  useEffect(() => {
    function handleModalEscape(e) {
      if (e.key !== 'Escape') return;
      if (contactDialog) {
        setContactDialog(null);
      } else if (clientToDelete && !deleting) {
        setClientToDelete(null);
      } else if (importDialogOpen && !importing) {
        setImportDialogOpen(false);
      } else if (dialogOpen && !saving) {
        setDialogOpen(false);
      } else if (viewingClient) {
        setViewingClient(null);
      }
    }
    window.addEventListener('keydown', handleModalEscape);
    return () => window.removeEventListener('keydown', handleModalEscape);
  }, [contactDialog, clientToDelete, deleting, importDialogOpen, importing, dialogOpen, saving, viewingClient]);

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
      const rawList = Array.isArray(data.clients) ? data.clients : [];
      const list = rawList.map((c) => ({
        ...c,
        features: (Array.isArray(c.features) ? c.features : []).filter((f) => f !== 'SMS'),
        servicesFeatures: (Array.isArray(c.servicesFeatures) ? c.servicesFeatures : []).filter((f) => f !== 'SMS'),
      }));
      setClients(list.slice().sort(sortClientsDescending));
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

  // ── Bulk CSV / Excel Import Handlers ──
  const existingMobileSet = useMemo(() => {
    const set = new Set();
    clients.forEach((c) => {
      const digits = String(c.mobileNumber || '').replace(/\D/g, '');
      if (digits) set.add(digits);
    });
    return set;
  }, [clients]);

  const importSummary = useMemo(() => {
    let validNewCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    const annotatedRows = importRows.map((row) => {
      if (row._validationError) {
        invalidCount++;
        return { ...row, _status: 'error' };
      }
      const isDuplicate = existingMobileSet.has(row.mobileNumber);
      if (isDuplicate) {
        duplicateCount++;
        return { ...row, _status: 'duplicate' };
      }
      validNewCount++;
      return { ...row, _status: 'new' };
    });

    const actionableCount =
      duplicateMode === 'update' ? validNewCount + duplicateCount : validNewCount;

    return {
      total: importRows.length,
      validNewCount,
      duplicateCount,
      invalidCount,
      actionableCount,
      annotatedRows,
    };
  }, [importRows, existingMobileSet, duplicateMode]);

  function openImportDialog() {
    setImportFileName('');
    setImportRows([]);
    setImportError('');
    setDuplicateMode('skip');
    setIsDraggingFile(false);
    setImportDialogOpen(true);
  }

  function closeImportDialog() {
    if (importing) return;
    setImportDialogOpen(false);
  }

  async function processSelectedFile(file) {
    if (!file) return;
    setImportError('');
    setImportRows([]);
    setImportFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls', 'ods'].includes(ext)) {
      setImportError('Please select a valid .csv, .xlsx, or .xls file.');
      return;
    }

    try {
      const rows = await parseClientSpreadsheet(file);
      setImportRows(rows);
    } catch (err) {
      setImportError(err.message || 'Could not read the spreadsheet file.');
    }
  }

  function handleImportFileInputChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    e.target.value = '';
  }

  function handleImportDrop(e) {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  }

  async function handleConfirmBulkImport() {
    if (importing || importSummary.actionableCount === 0) return;

    const validPayloadRows = importSummary.annotatedRows
      .filter((r) => r._status === 'new' || r._status === 'duplicate')
      .map(({ _status, _validationError, ...rest }) => rest);

    if (validPayloadRows.length === 0) {
      setImportError('No valid rows available to import.');
      return;
    }

    try {
      setImporting(true);
      setImportError('');

      const res = await fetch(`${API_URL}/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          clients: validPayloadRows,
          duplicateMode,
        }),
      });

      const data = await readResponse(res);
      await fetchClients();
      setImportDialogOpen(false);
      showNotice(`✓ ${data.message || 'Clients imported successfully!'}`);
    } catch (err) {
      setImportError(err.message || 'Failed to import clients.');
    } finally {
      setImporting(false);
    }
  }

  async function handleDownloadClients(format) {
    setDownloadMenuOpen(false);
    const listToExport = filteredClients.length > 0 ? filteredClients : clients;
    if (listToExport.length === 0) {
      showNotice('No clients available to download.');
      return;
    }
    try {
      await exportClientsSpreadsheet(listToExport, format);
      showNotice(
        `✓ Downloaded ${listToExport.length} client${listToExport.length === 1 ? '' : 's'} as .${format}`
      );
    } catch (err) {
      setError(err.message || 'Failed to download clients.');
    }
  }

  // Instant inline client status toggle (Active / Inactive)
  async function handleStatusChange(client, newStatus) {
    if (!client || !newStatus) return;
    const oldStatus = client.status || 'active';
    if (oldStatus === newStatus) return;

    // Optimistic UI update
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, status: newStatus } : c))
    );

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(client.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      await readResponse(response);
      showNotice(
        `✓ Status set to ${newStatus === 'active' ? 'Active' : 'Inactive'} for ${client.companyName || client.name}.`
      );
    } catch (err) {
      // Revert optimistic update on error
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, status: oldStatus } : c))
      );
      alert(err.message || 'Failed to update client status.');
    }
  }

  // Distinct services and features actually assigned to registered clients (for stat cards)
  const activeClientServices = useMemo(() => {
    const set = new Set();
    clients.forEach((c) => {
      if (Array.isArray(c.services)) {
        c.services.forEach((s) => {
          const val = String(s || '').trim();
          if (val) set.add(val);
        });
      }
    });
    return Array.from(set).sort();
  }, [clients]);

  const activeClientFeatures = useMemo(() => {
    const set = new Set();
    clients.forEach((c) => {
      if (Array.isArray(c.features)) {
        c.features.forEach((f) => {
          const val = String(f || '').trim();
          if (val && val.toUpperCase() !== 'SMS') {
            set.add(val);
          }
        });
      }
    });
    return Array.from(set).sort();
  }, [clients]);

  // Catalogs across active clients for filter dropdowns
  const allUsedServices = useMemo(() => {
    const set = new Set(PREDEFINED_SERVICES);
    activeClientServices.forEach((s) => set.add(s));
    return Array.from(set).sort();
  }, [activeClientServices]);

  const allUsedFeatures = useMemo(() => {
    const set = new Set(PREDEFINED_FEATURES);
    activeClientFeatures.forEach((f) => set.add(f));
    return Array.from(set).filter(Boolean).sort();
  }, [activeClientFeatures]);

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
    let result = clients.filter((client) => {
      // Interactive card filter
      if (cardFilter === 'active' && client.status !== 'active') return false;
      if (cardFilter === 'revenue' && (Number(client.monthlyRental) || 0) <= 0) return false;
      if (
        cardFilter === 'services' &&
        (!Array.isArray(client.services) || client.services.length === 0)
      ) {
        return false;
      }
      if (
        cardFilter === 'features' &&
        (!Array.isArray(client.features) || client.features.length === 0)
      ) {
        return false;
      }

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

    if (cardFilter === 'revenue') {
      result = [...result].sort(
        (a, b) => (Number(b.monthlyRental) || 0) - (Number(a.monthlyRental) || 0)
      );
    } else {
      result = [...result].sort(sortClientsDescending);
    }

    return result;
  }, [clients, search, statusFilter, serviceFilter, featureFilter, cardFilter]);

  const effectivePageSize = pageSize === 'all' ? Math.max(1, filteredClients.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / effectivePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * effectivePageSize;
  const paginatedClients =
    pageSize === 'all'
      ? filteredClients
      : filteredClients.slice(pageStartIndex, pageStartIndex + effectivePageSize);

  return (
    <div className="client-page">
      {/* ── Page Header ── */}
      <div className="client-page-header">
        <div>
          <h1 className="db-page-title">Manage Clients</h1>
        </div>

        <div className="client-header-actions ticket-header-actions">
          <div className="client-download-wrap" ref={downloadMenuRef}>
            <button
              type="button"
              className="client-download-btn"
              onClick={() => setDownloadMenuOpen((prev) => !prev)}
              disabled={clients.length === 0}
              title={
                clients.length === 0
                  ? 'No clients to download yet'
                  : 'Download clients list as CSV or Excel (.xlsx)'
              }
              aria-haspopup="menu"
              aria-expanded={downloadMenuOpen}
            >
              <svg
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export</span>
              <svg
                width="12"
                height="12"
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

            {downloadMenuOpen && (
              <div className="client-download-menu" role="menu">
                <div className="client-download-menu-meta">
                  Export {(filteredClients.length > 0 ? filteredClients : clients).length} client
                  {(filteredClients.length > 0 ? filteredClients : clients).length === 1 ? '' : 's'}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="client-download-menu-item"
                  onClick={() => handleDownloadClients('xlsx')}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="client-download-menu-item"
                  onClick={() => handleDownloadClients('csv')}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="client-import-btn"
            onClick={openImportDialog}
            title="Bulk import clients from .csv or .xlsx spreadsheet"
          >
            <svg
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Import CSV / Excel</span>
          </button>

          <button
            type="button"
            className="ticket-create-button client-create-btn"
            onClick={openCreateDialog}
          >
            + Add Client
          </button>
        </div>
      </div>

      {/* ── Notice Toast ── */}
      {notice && (
        <div className="client-notice" role="status">
          {notice}
        </div>
      )}

      {/* ── Overview Statistics Cards (Accessible & Filterable) ── */}
      <div className="client-stat-grid" role="region" aria-label="Client statistics overview">
        {/* Total Clients Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={cardFilter === 'total'}
          aria-label={`Total Clients: ${clients.length}. Click to filter list.`}
          title={`Click to view all ${clients.length} clients as a list`}
          className={`client-stat-card ${cardFilter === 'total' ? 'active' : ''}`}
          style={{
            '--card-accent': '#4f46e5',
            '--card-bg': '#f5f3ff',
            '--card-border': '#c7d2fe',
          }}
          onClick={() => {
            setCardFilter((prev) => (prev === 'total' ? null : 'total'));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCardFilter((prev) => (prev === 'total' ? null : 'total'));
            }
          }}
        >
          <div className="client-stat-label">Total Clients</div>
          <div className="client-stat-num">{clients.length}</div>
        </div>

        {/* Active Clients Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={cardFilter === 'active'}
          aria-label={`Active Clients: ${activeClientsCount}. Click to filter active clients.`}
          title={`Click to filter active clients (${activeClientsCount})`}
          className={`client-stat-card stat-accent-green ${cardFilter === 'active' ? 'active' : ''}`}
          style={{
            '--card-accent': '#059669',
            '--card-bg': '#ecfdf5',
            '--card-border': '#a7f3d0',
          }}
          onClick={() => {
            const next = cardFilter === 'active' ? null : 'active';
            setCardFilter(next);
            setStatusFilter(next ? 'active' : 'all');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const next = cardFilter === 'active' ? null : 'active';
              setCardFilter(next);
              setStatusFilter(next ? 'active' : 'all');
            }
          }}
        >
          <div className="client-stat-label">Active Clients</div>
          <div className="client-stat-num">{activeClientsCount}</div>
        </div>

        {/* Monthly Rental Revenue Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={cardFilter === 'revenue'}
          aria-label={`Monthly Rental Revenue: ${formatCurrency(totalRevenue)}. Click to view paying clients.`}
          title={`Click to filter paying clients (${clients.filter((c) => Number(c.monthlyRental) > 0).length} clients)`}
          className={`client-stat-card stat-accent-indigo ${cardFilter === 'revenue' ? 'active' : ''}`}
          style={{
            '--card-accent': '#4f46e5',
            '--card-bg': '#eef2ff',
            '--card-border': '#c7d2fe',
          }}
          onClick={() => {
            setCardFilter((prev) => (prev === 'revenue' ? null : 'revenue'));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCardFilter((prev) => (prev === 'revenue' ? null : 'revenue'));
            }
          }}
        >
          <div className="client-stat-label">Monthly Rental Revenue</div>
          <div className="client-stat-num">{formatCurrency(totalRevenue)}</div>
        </div>

        {/* Total Services Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={cardFilter === 'services'}
          aria-label={`Total Services: ${activeClientServices.length}. Click to filter clients with services.`}
          title="Click to filter clients with subscribed services"
          className={`client-stat-card stat-accent-blue ${cardFilter === 'services' ? 'active' : ''}`}
          style={{
            '--card-accent': '#2563eb',
            '--card-bg': '#eff6ff',
            '--card-border': '#bfdbfe',
          }}
          onClick={() => {
            setCardFilter((prev) => (prev === 'services' ? null : 'services'));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCardFilter((prev) => (prev === 'services' ? null : 'services'));
            }
          }}
        >
          <div className="client-stat-label">Total Services</div>
          <div className="client-stat-num">{activeClientServices.length}</div>
        </div>

        {/* Total Features Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={cardFilter === 'features'}
          aria-label={`Total Features: ${activeClientFeatures.length}. Click to filter clients with features.`}
          title="Click to filter clients with active features"
          className={`client-stat-card stat-accent-emerald ${cardFilter === 'features' ? 'active' : ''}`}
          style={{
            '--card-accent': '#0d9488',
            '--card-bg': '#f0fdfa',
            '--card-border': '#99f6e4',
          }}
          onClick={() => {
            setCardFilter((prev) => (prev === 'features' ? null : 'features'));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCardFilter((prev) => (prev === 'features' ? null : 'features'));
            }
          }}
        >
          <div className="client-stat-label">Total Features</div>
          <div className="client-stat-num">{activeClientFeatures.length}</div>
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
           
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
          />
        </div>

        <div className="client-filters-wrap">
          <select
            className="client-filter-select select-status-filter"
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

          {(search || statusFilter !== 'all' || serviceFilter !== 'all' || featureFilter !== 'all' || cardFilter) && (
            <button
              type="button"
              className="client-clear-filters-btn"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setServiceFilter('all');
                setFeatureFilter('all');
                setCardFilter(null);
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Rows Filter Bar (Just Below Search Nav) ── */}
      <div className="client-rows-bar">
        <div className="client-rows-summary">
          {filteredClients.length === 0 ? (
            <span>Showing <strong>0</strong> clients</span>
          ) : (
            <span>
              Showing{' '}
              <strong>
                {pageStartIndex + 1}–{Math.min(pageStartIndex + paginatedClients.length, filteredClients.length)}
              </strong>{' '}
              of <strong>{filteredClients.length}</strong> client
              {filteredClients.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <label className="client-pagesize-label">
          <span>Rows:</span>
          <select
            className="client-filter-select client-pagesize-select"
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value;
              setPageSize(val === 'all' ? 'all' : Number(val));
            }}
            aria-label="Rows per page"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value="all">All</option>
          </select>
        </label>
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
      ) : (
        <div className="client-table-card">
          {/* Dedicated Filtered List Header (Same as Dashboard selectedStat view) */}
          {cardFilter && CLIENT_STAT_CONFIG[cardFilter] && (
            <div
              className="client-stat-filter-header"
              style={{
                borderLeft: `4px solid ${CLIENT_STAT_CONFIG[cardFilter].color}`,
              }}
            >
              <div className="client-stat-filter-header-left">
                <div className="client-stat-filter-title-row">
                  <span className="client-stat-filter-title">
                    {CLIENT_STAT_CONFIG[cardFilter].title}
                  </span>
                  <span
                    className="client-stat-filter-pill"
                    style={{
                      background: CLIENT_STAT_CONFIG[cardFilter].pillBg,
                      color: CLIENT_STAT_CONFIG[cardFilter].pillColor,
                      border: `1px solid ${CLIENT_STAT_CONFIG[cardFilter].pillBorder}`,
                    }}
                  >
                    {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}
                  </span>
                </div>
                <span className="client-stat-filter-sub">
                  {CLIENT_STAT_CONFIG[cardFilter].description}
                </span>
              </div>

              <div>
                <button
                  type="button"
                  className="client-stat-filter-reset-btn"
                  onClick={() => {
                    setCardFilter(null);
                    setStatusFilter('all');
                  }}
                  title="Clear stat filter and show all clients"
                >
                  ✕ Clear Selection
                </button>
              </div>
            </div>
          )}

          {filteredClients.length === 0 ? (
            <div className="client-empty-state" style={{ padding: '36px 20px' }}>
              <div className="client-empty-icon">🏢</div>
              <h3>No clients found</h3>
              <p>
                {search || statusFilter !== 'all' || serviceFilter !== 'all' || featureFilter !== 'all' || cardFilter
                  ? 'No clients match the active filter criteria. Try adjusting or clearing filters.'
                  : 'Get started by adding your first client profile with company details, services, and features.'}
              </p>
              {cardFilter || search || statusFilter !== 'all' || serviceFilter !== 'all' || featureFilter !== 'all' ? (
                <button
                  type="button"
                  className="client-stat-filter-reset-btn"
                  style={{ marginTop: 12, padding: '6px 14px' }}
                  onClick={() => {
                    setCardFilter(null);
                    setStatusFilter('all');
                    setServiceFilter('all');
                    setFeatureFilter('all');
                    setSearch('');
                  }}
                >
                  ✕ Reset All Filters
                </button>
              ) : (
                <button
                  type="button"
                  className="ticket-create-button client-create-btn"
                  style={{ marginTop: 12 }}
                  onClick={openCreateDialog}
                >
                  + Add Client
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="client-table-scroll">
            <table className="client-table">
              <thead>
                <tr>
                  <th style={{ width: 75 }}>Client ID</th>
                  <th>Company &amp; Contact</th>
                  <th>Contact Details</th>
                  <th style={{ width: 90 }}>City / State</th>
                  <th style={{ width: 100 }}>Monthly Rental</th>
                  <th>Services</th>
                  <th>Features</th>
                  <th style={{ width: 105, textAlign: 'center' }}>Client Status</th>
                  <th style={{ width: 95, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client) => {
                  const servicesList = Array.isArray(client.services) ? client.services : [];
                  const featuresList = Array.isArray(client.features) ? client.features : [];

                  const dispServices = servicesList.slice(0, 2);
                  const extraServices = servicesList.length - dispServices.length;

                  const dispFeatures = featuresList.slice(0, 2);
                  const extraFeatures = featuresList.length - dispFeatures.length;

                  return (
                    <tr key={client.id} className="client-table-row">
                      {/* ID */}
                      <td className="client-id-cell">
                        <span className="client-id-text">{client.id}</span>
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
                            <span>{client.name}</span>
                            {client.ticketCount !== undefined && client.ticketCount > 0 && (
                              <span
                                className="client-ticket-pill"
                                title={`${client.ticketCount} ticket(s) registered in RI-Desk`}
                              >
                                {client.ticketCount} {client.ticketCount === 1 ? 'ticket' : 'tickets'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td>
                        <div className="client-contacts-cell">
                          {client.mobileNumber ? (
                            <button
                              type="button"
                              className="client-phone-btn"
                              title={`Contact ${client.name || client.companyName} (${client.mobileNumber})`}
                              onClick={() =>
                                setContactDialog({
                                  name: client.name || client.companyName || 'Client',
                                  phone: client.mobileNumber,
                                  email: client.email || '',
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
                                aria-hidden="true"
                              >
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              <span>{client.mobileNumber}</span>
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}

                          {client.email && (
                            <a
                              href={`mailto:${client.email}`}
                              className="client-email-link"
                              title={`Send email to ${client.name || client.companyName} (${client.email})`}
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
                              <span>{client.email}</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td>
                        <span className="client-city-text">
                          {client.cityState || '—'}
                        </span>
                      </td>

                      {/* Monthly Rental */}
                      <td>
                        <div className="client-rental-cell">
                          <span className="client-rental-amount">
                            {formatCurrency(client.monthlyRental)}
                          </span>
                          <span className="client-rental-period">/mo</span>
                        </div>
                      </td>

                      {/* ── Services ── */}
                      <td>
                        <div className="client-tags-cell-block">
                          {dispServices.map((svc) => (
                            <span key={svc} className="client-tag-pill">
                              {svc}
                            </span>
                          ))}
                          {extraServices > 0 && (
                            <span
                              className="client-tag-pill pill-more"
                              title={servicesList.slice(2).join(', ')}
                            >
                              +{extraServices}
                            </span>
                          )}
                          {servicesList.length === 0 && (
                            <span className="client-no-items">—</span>
                          )}
                        </div>
                      </td>

                      {/* ── Features ── */}
                      <td>
                        <div className="client-tags-cell-block">
                          {dispFeatures.map((feat) => (
                            <span key={feat} className="client-tag-pill">
                              {feat}
                            </span>
                          ))}
                          {extraFeatures > 0 && (
                            <span
                              className="client-tag-pill pill-more"
                              title={featuresList.slice(2).join(', ')}
                            >
                              +{extraFeatures}
                            </span>
                          )}
                          {featuresList.length === 0 && (
                            <span className="client-no-items">—</span>
                          )}
                        </div>
                      </td>

                      {/* Client Status */}
                      <td style={{ textAlign: 'center' }}>
                        <select
                          className={`client-status-badge-select ${
                            (client.status || 'active') === 'active'
                              ? 'status-active'
                              : 'status-inactive'
                          }`}
                          value={client.status || 'active'}
                          onChange={(e) => handleStatusChange(client, e.target.value)}
                          title={`Change status for ${client.companyName || client.name}`}
                        >
                          <option value="active">● Active</option>
                          <option value="inactive">● Inactive</option>
                        </select>
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
                              width="15"
                              height="15"
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
                            className="client-icon-btn edit-btn"
                            onClick={() => openEditDialog(client)}
                            title="Edit Client"
                            aria-label="Edit Client"
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
                          </button>

                          <button
                            type="button"
                            className="client-icon-btn delete-btn"
                            onClick={() => setClientToDelete(client)}
                            title="Delete Client"
                            aria-label="Delete Client"
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
          {filteredClients.length > 0 && totalPages > 1 && (
            <div className="client-pagination-bar">
              <div className="client-pagination-info">
                Showing{' '}
                <strong>
                  {pageStartIndex + 1}–{Math.min(pageStartIndex + paginatedClients.length, filteredClients.length)}
                </strong>{' '}
                of <strong>{filteredClients.length}</strong> client
                {filteredClients.length === 1 ? '' : 's'}
              </div>

              <div className="client-pagination-controls">
                <div className="client-page-btns">
                  <button
                    type="button"
                    className="client-page-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                  >
                    ‹ Prev
                  </button>
                  <span className="client-page-indicator">
                    Page <strong>{safeCurrentPage}</strong> / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="client-page-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                  >
                    Next ›
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
        )}
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
                   Client Name <span className="req-star">*</span>
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

              {/* Client Status Dropdown */}
              <div className="client-form-field">
                <label htmlFor="client-form-status">Client Status</label>
                <select
                  id="client-form-status"
                  className="client-form-input"
                  value={form.status || 'active'}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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

                {/* ── Features Dropdown (WhatsApp, Email, Custom) ── */}
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
                  {saving ? 'Saving...' : editingClient ? 'Save Changes' : 'Add Client'}
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
                  <span className="client-metric-lbl">Client Status</span>
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
                      {viewingClient.mobileNumber ? (
                        <button
                          type="button"
                          className="client-phone-btn"
                          title={`Contact ${viewingClient.name || viewingClient.companyName} (${viewingClient.mobileNumber})`}
                          onClick={() =>
                            setContactDialog({
                              name: viewingClient.name || viewingClient.companyName || 'Client',
                              phone: viewingClient.mobileNumber,
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
                            aria-hidden="true"
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          <span>{viewingClient.mobileNumber}</span>
                        </button>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  <div className="client-view-field">
                    <span className="client-field-label">WhatsApp Number</span>
                    <span className="client-field-value">
                      {viewingClient.whatsappNumber ? (
                        <a
                          href={`https://wa.me/${viewingClient.whatsappNumber.replace(/\D/g, '').length === 10 ? '91' + viewingClient.whatsappNumber.replace(/\D/g, '') : viewingClient.whatsappNumber.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="client-wa-val"
                          style={{ textDecoration: 'none' }}
                          title={`Chat with ${viewingClient.name || viewingClient.companyName} on WhatsApp`}
                        >
                          <span className="client-wa-badge">WA</span>
                          {viewingClient.whatsappNumber}
                        </a>
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

            <div className="client-view-footer">
              <button
                type="button"
                className="client-edit-direct-btn"
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
                className="client-modal-close-action"
                onClick={() => setViewingClient(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          DELETE CONFIRMATION DIALOG (SAME AS DELETE TICKET DIALOG)
      ──────────────────────────────────────────────────────── */}
      {clientToDelete && (
        <div
          className="ticket-dialog-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) setClientToDelete(null);
          }}
        >
          <section
            className="ticket-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-client-title"
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

            <h2 id="delete-client-title">Delete Client?</h2>

            <p>
              Are you sure you want to delete client{' '}
              <strong>"{clientToDelete.companyName || clientToDelete.name || 'this client'}"</strong>?{' '}
              This action cannot be undone.
            </p>

            <div className="ticket-dialog-actions">
              <button
                type="button"
                className="ticket-cancel-button"
                onClick={() => setClientToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="ticket-confirm-delete"
                onClick={handleDeleteClient}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          BULK IMPORT CLIENTS DIALOG (CSV / XLSX)
      ──────────────────────────────────────────────────────── */}
      {importDialogOpen && (
        <div
          className="client-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeImportDialog();
          }}
        >
          <div
            className="client-modal-box client-import-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-clients-title"
          >
            <div className="client-modal-header">
              <div>
                <h2 id="import-clients-title" className="client-modal-title">
                  Bulk Import Clients (CSV / Excel)
                </h2>
                <p className="client-modal-sub">
                  Upload your .csv or .xlsx file to add or update hundreds of clients in seconds.
                </p>
              </div>
              <button
                type="button"
                className="client-modal-close-btn"
                onClick={closeImportDialog}
                disabled={importing}
                aria-label="Close import dialog"
              >
                ×
              </button>
            </div>

            <div className="client-modal-form">
              {/* Step 1: Template Download Bar */}
              <div className="client-import-template-bar">
                <div className="client-import-template-info">
                  <strong>Need the exact column format?</strong>
                  <span>
                    Required: <code>name</code>, <code>companyName</code>,{' '}
                    <code>mobileNumber</code>. Optional: <code>email</code>,{' '}
                    <code>whatsappNumber</code>, <code>cityState</code>, <code>monthlyRental</code>,{' '}
                    <code>services</code>, <code>features</code>, <code>status</code>.
                  </span>
                </div>
                <div className="client-import-template-btns">
                  <button
                    type="button"
                    className="client-template-dl-btn"
                    onClick={() => downloadClientTemplate('xlsx')}
                  >
                    <svg
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
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>.xlsx Template</span>
                  </button>
                  <button
                    type="button"
                    className="client-template-dl-btn"
                    onClick={() => downloadClientTemplate('csv')}
                  >
                    <svg
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
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>.csv Template</span>
                  </button>
                </div>
              </div>

              {/* Step 2: File Upload Dropzone */}
              <div
                className={`client-import-dropzone ${isDraggingFile ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleImportDrop}
                onClick={() => importFileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    importFileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.ods"
                  onChange={handleImportFileInputChange}
                  style={{ display: 'none' }}
                />
                <div className="client-import-drop-icon">📄</div>
                <div className="client-import-drop-title">
                  {importFileName
                    ? `Selected: ${importFileName}`
                    : 'Click to browse or drag & drop your .csv / .xlsx file here'}
                </div>
                <div className="client-import-drop-sub">
                  Supports Excel (.xlsx, .xls) and CSV spreadsheets
                </div>
              </div>

              {importError && (
                <div className="client-form-error" role="alert">
                  {importError}
                </div>
              )}

              {/* Step 3: Preview Summary & Options */}
              {importRows.length > 0 && (
                <>
                  <div className="client-import-options-row">
                    <label className="client-import-mode-label">
                      If Mobile Number already exists:
                    </label>
                    <div className="client-import-mode-pills">
                      <button
                        type="button"
                        className={`client-import-mode-btn ${duplicateMode === 'skip' ? 'active' : ''}`}
                        onClick={() => setDuplicateMode('skip')}
                      >
                        Skip Duplicates
                      </button>
                      <button
                        type="button"
                        className={`client-import-mode-btn ${duplicateMode === 'update' ? 'active' : ''}`}
                        onClick={() => setDuplicateMode('update')}
                      >
                        Update Existing
                      </button>
                    </div>
                  </div>

                  <div className="client-import-stats-strip">
                    <span className="client-import-pill pill-total">
                      Total Rows: <strong>{importSummary.total}</strong>
                    </span>
                    <span className="client-import-pill pill-new">
                      New Clients: <strong>{importSummary.validNewCount}</strong>
                    </span>
                    <span className="client-import-pill pill-dup">
                      Existing / Duplicates: <strong>{importSummary.duplicateCount}</strong>
                    </span>
                    {importSummary.invalidCount > 0 && (
                      <span className="client-import-pill pill-err">
                        Invalid Rows: <strong>{importSummary.invalidCount}</strong>
                      </span>
                    )}
                  </div>

                  <div className="client-import-preview-wrap">
                    <table className="client-import-preview-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Name</th>
                          <th>Company</th>
                          <th>Mobile</th>
                          <th>City / State</th>
                          <th>Rental</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importSummary.annotatedRows.slice(0, 100).map((row) => (
                          <tr key={row._rowNumber} className={`row-${row._status}`}>
                            <td>#{row._rowNumber}</td>
                            <td>{row.name || '—'}</td>
                            <td>{row.companyName || '—'}</td>
                            <td>{row.mobileNumber || '—'}</td>
                            <td>{row.cityState || '—'}</td>
                            <td>{formatCurrency(row.monthlyRental)}</td>
                            <td>
                              {row._status === 'new' && (
                                <span className="import-badge badge-new">Ready (New)</span>
                              )}
                              {row._status === 'duplicate' && (
                                <span className="import-badge badge-dup">
                                  {duplicateMode === 'update' ? 'Will Update' : 'Skip (Exists)'}
                                </span>
                              )}
                              {row._status === 'error' && (
                                <span className="import-badge badge-err">
                                  {row._validationError}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importSummary.annotatedRows.length > 100 && (
                      <div className="client-import-preview-more">
                        Showing first 100 of {importSummary.annotatedRows.length} rows. All valid rows will be imported.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="client-import-footer client-modal-actions ticket-dialog-actions">
              <button
                type="button"
                className="ticket-cancel-button client-modal-cancel-btn"
                onClick={closeImportDialog}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ticket-create-button client-modal-submit-btn"
                onClick={handleConfirmBulkImport}
                disabled={importing || importSummary.actionableCount === 0}
              >
                {importing
                  ? 'Importing Clients...'
                  : `Import ${importSummary.actionableCount} Client${importSummary.actionableCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          CONTACT CLIENT DIALOG (PHONE CALL, WHATSAPP, EMAIL)
      ──────────────────────────────────────────────────────── */}
      <ContactClientDialog
        contact={contactDialog}
        onClose={() => setContactDialog(null)}
      />
    </div>
  );
}
