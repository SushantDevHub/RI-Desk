
import { useEffect, useState, useRef } from 'react';
import { getToken } from '../api/authApi.js';
import { API_BASE } from '../config/api.js';
import ContactClientDialog from '../components/ContactClientDialog.jsx';
import '../pages/DashboardPage.css';

const API_URL = `${API_BASE}/users`;

const STANDARD_DESIGNATIONS = [
  'Support Specialist',
  'Technical Support Engineer',
  'Senior Support Executive',
  'Helpdesk Analyst',
  'Client Relationship Executive',
  'Operations Executive',
  'Billing & Accounts Executive',
  'System Administrator',
  'Team Lead',
];

const EMPTY_FORM = {
  name: '',
  email: '',
  mobileNumber: '',
  designation: '',
  status: 'active',
  password: '',
  confirmPassword: '',
};


async function readResponse(response) {
  const responseText = await response.text();

  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText };
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

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg
        width="16"
        height="16"
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
      width="16"
      height="16"
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

export default function EmployeeListPage({ onCreateEmployee }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState(null);

  const [orgDesignations, setOrgDesignations] = useState([]);
  const [isCustomCreate, setIsCustomCreate] = useState(false);
  const [customCreateInput, setCustomCreateInput] = useState('');
  const [isCustomEdit, setIsCustomEdit] = useState(false);
  const [customEditInput, setCustomEditInput] = useState('');
  const [contactDialog, setContactDialog] = useState(null);

  const messageTimeoutRef = useRef(null);

  function showTemporaryMessage(msg, duration = 1000) {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    setMessage(msg);
    messageTimeoutRef.current = setTimeout(() => {
      setMessage('');
      setHighlightedEmployeeId(null);
      messageTimeoutRef.current = null;
    }, duration);
  }

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  // Fetch employees from the backend.
  async function fetchEmployees() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = await readResponse(response);

      setEmployees(
        Array.isArray(data.employees) ? data.employees : []
      );
    } catch (err) {
      setError(err.message || 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmployees();
    fetchOrgDesignations();
  }, []);

  async function fetchOrgDesignations() {
    try {
      const res = await fetch(`${API_BASE}/designations`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.designations)) {
        const titles = data.designations
          .map((d) => d.title?.trim())
          .filter(Boolean);
        const customOnly = titles.filter(
          (t) => !STANDARD_DESIGNATIONS.includes(t)
        );
        setOrgDesignations(Array.from(new Set(customOnly)));
      }
    } catch {
      // ignore
    }
  }

  // Open the Create Employee popup.
  function openCreateDialog() {
    setCreateForm({ ...EMPTY_FORM });
    setIsCustomCreate(false);
    setCustomCreateInput('');
    setCreateError('');
    setMessage('');
    setError('');
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
    setShowCreateDialog(true);
  }

  // Close the Create Employee popup.
  function closeCreateDialog() {
    if (creating) return;

    setShowCreateDialog(false);
    setCreateError('');
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
  }

  function openEditDialog(employee) {
    setError('');
    setMessage('');
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
    const existingDesig = employee.designation || '';
    const allKnown = [...STANDARD_DESIGNATIONS, ...orgDesignations];
    const isCustom = existingDesig && !allKnown.includes(existingDesig);
    setIsCustomEdit(Boolean(isCustom));
    setCustomEditInput(existingDesig);
    setEditingEmployee({
      ...employee,
      status: employee.status || 'active',
      designation: existingDesig,
      password: '',
      confirmPassword: '',
    });
  }

  function closeEditDialog() {
    if (saving) return;

    setEditingEmployee(null);
    setError('');
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
  }

  function updateCreateField(event) {
    const { name, value } = event.target;

    setCreateForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  // Create a new employee.
  async function handleCreateEmployee(event) {
    event.preventDefault();

    setCreateError('');
    setMessage('');

    const mobile = createForm.mobileNumber.trim();

    if (!/^\d{10}$/.test(mobile)) {
      setCreateError('Enter a valid 10-digit mobile number.');
      return;
    }

    if (!createForm.password || createForm.password.length < 8) {
      setCreateError('Password must be at least 8 characters long.');
      return;
    }

    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Passwords do not match.');
      return;
    }

    try {
      setCreating(true);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          mobileNumber: mobile,
          designation: (createForm.designation || '').trim(),
          status: createForm.status || 'active',
          password: createForm.password,
          role: 'employee',
        }),
      });

      await readResponse(response);

      await fetchEmployees();

      setCreateForm({ ...EMPTY_FORM });
      setShowCreateDialog(false);
      showTemporaryMessage('Employee created successfully.');
    } catch (err) {
      setCreateError(
        err.message || 'Failed to add employee.'
      );
    } finally {
      setCreating(false);
    }
  }

  // Update an employee.
  async function handleSaveEmployee(event) {
    event.preventDefault();

    if (!editingEmployee) return;

    const trimmedPassword = (editingEmployee.password || '').trim();
    const trimmedConfirm = (editingEmployee.confirmPassword || '').trim();

    if (trimmedPassword || trimmedConfirm) {
      if (trimmedPassword.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (trimmedPassword !== trimmedConfirm) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updatePayload = {
        name: (editingEmployee.name || '').trim(),
        email: (editingEmployee.email || '').trim(),
        mobileNumber: String(editingEmployee.mobileNumber || '').trim(),
        designation: (editingEmployee.designation || '').trim(),
        status: editingEmployee.status || 'active',
      };
      if (trimmedPassword) {
        updatePayload.password = trimmedPassword;
      }

      const response = await fetch(
        `${API_URL}/${encodeURIComponent(editingEmployee.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(updatePayload),
        }
      );

      await readResponse(response);

      const updatedId = editingEmployee.id;
      setEditingEmployee(null);
      setHighlightedEmployeeId(updatedId);
      showTemporaryMessage('Employee updated successfully.', 1000);

      await fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to update employee.');
    } finally {
      setSaving(false);
    }
  }

  // Instant inline employee status toggle (Active / Inactive)
  async function handleStatusChange(employee, newStatus) {
    if (!employee || !newStatus) return;
    const oldStatus = employee.status || 'active';
    if (oldStatus === newStatus) return;

    // Optimistic UI update
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employee.id ? { ...emp, status: newStatus } : emp
      )
    );

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(employee.id)}`,
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
      showTemporaryMessage(
        `Status set to ${newStatus === 'active' ? 'Active' : 'Inactive'} for ${employee.name}.`
      );
    } catch (err) {
      // Revert optimistic update on error
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === employee.id ? { ...emp, status: oldStatus } : emp
        )
      );
      setError(err.message || 'Failed to update employee status.');
    }
  }

  // Delete the selected employee.
  async function handleDeleteEmployee() {
    if (!employeeToDelete) return;

    setDeleting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(employeeToDelete.id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      await readResponse(response);

      setEmployees((current) =>
        current.filter(
          (employee) => employee.id !== employeeToDelete.id
        )
      );

      setEmployeeToDelete(null);
      showTemporaryMessage('Employee deleted successfully.');
    } catch (err) {
      setError(err.message || 'Failed to delete employee.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="employee-page">

      {/* Page heading */}
      <header className="employee-page-header">
        <div>
          <h1 className="db-page-title">Manage Employees</h1>
          <p className="db-page-sub">View and manage your support team.</p>
        </div>

        <button
          type="button"
          className="create-employee-top-btn"
          onClick={openCreateDialog}
        >
          + Add Employee
        </button>
      </header>

      {/* Success and error messages */}
      {message && (
        <div className="employee-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="employee-error" role="alert">
          {error}
        </div>
      )}

      {/* Loading and employee list */}
      {loading ? (
        <div className="employee-loading">
          Loading employees...
        </div>
      ) : employees.length === 0 && !error ? (
        <div className="employee-empty">
          <h2>No employees yet</h2>
          <p>
            Add an employee account to get your support team started.
          </p>

          <button
            type="button"
            className="create-employee-empty-btn"
            onClick={openCreateDialog}
          >
            Add First Employee
          </button>
        </div>
      ) : (
        !error && (
          <div className="employee-table-card">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile Number</th>
                  <th>Designation</th>
                  <th style={{ width: 120, textAlign: 'center' }}>Employee Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee, index) => (
                  <tr
                    key={employee.id}
                    className={highlightedEmployeeId === employee.id ? 'employee-row-highlight' : ''}
                  >
                    <td>{index + 1}</td>

                    <td>
                      <strong>{employee.name}</strong>
                    </td>

                    <td>
                      {employee.email ? (
                        <div className="employee-email-cell">
                          <a
                            href={`mailto:${employee.email}`}
                            className="employee-email-link"
                            title={`Send email to ${employee.email}`}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                              <polyline points="22,6 12,13 2,6" />
                            </svg>
                            <span>{employee.email}</span>
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    <td>
                      {employee.mobileNumber ? (
                        <div className="employee-contact-cell">
                          <button
                            type="button"
                            className="employee-phone-btn"
                            title={`Contact ${employee.name} via Phone Call or WhatsApp`}
                            onClick={() =>
                              setContactDialog({
                                name: employee.name,
                                phone: employee.mobileNumber,
                                designation: employee.designation,
                                isEmployee: true,
                              })
                            }
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
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            <span>{employee.mobileNumber}</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    <td>
                      {employee.designation ? (
                        <span className="employee-designation-plain">
                          <span className="employee-designation-logo">💼</span>
                          <span>{employee.designation}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <select
                        className={`employee-status-badge-select ${
                          (employee.status || 'active') === 'active'
                            ? 'status-active'
                            : 'status-inactive'
                        }`}
                        value={employee.status || 'active'}
                        onChange={(e) => handleStatusChange(employee, e.target.value)}
                        title={`Change status for ${employee.name}`}
                      >
                        <option value="active">● Active</option>
                        <option value="inactive">● Inactive</option>
                      </select>
                    </td>

                    <td>
                      <div className="employee-actions">
                        <button
                          type="button"
                          className="employee-icon-btn edit-icon-btn"
                          title="Edit employee"
                          aria-label={`Edit ${employee.name}`}
                          onClick={() => openEditDialog(employee)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
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
                          className="employee-icon-btn delete-icon-btn"
                          title="Delete employee"
                          aria-label={`Delete ${employee.name}`}
                          onClick={() => setEmployeeToDelete(employee)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
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
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Create Employee popup */}
      {showCreateDialog && (
        <div
          className="employee-dialog-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateDialog();
            }
          }}
        >
          <section
            className="employee-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-employee-title"
          >
            <div className="employee-dialog-header">
              <div>
                <h2 id="create-employee-title">
                  Add Employee
                </h2>
                <p>Add a new member to your support team.</p>
              </div>

              <button
                type="button"
                className="employee-dialog-close"
                aria-label="Close add employee form"
                onClick={closeCreateDialog}
                disabled={creating}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleCreateEmployee}
              className="employee-form"
            >
              <label>
                Full Name
                <input
                  name="name"
                  type="text"
                  value={createForm.name}
                  onChange={updateCreateField}
                  placeholder="Enter employee name"
                  autoComplete="name"
                  required
                />
              </label>

              <label>
                Email Address
                <input
                  name="email"
                  type="email"
                  value={createForm.email}
                  onChange={updateCreateField}
                  placeholder="employee@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Mobile Number
                <input
                  name="mobileNumber"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={createForm.mobileNumber}
                  onChange={updateCreateField}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  required
                />
              </label>

              {/* Designation Dropdown & Custom Option */}
              <div className="employee-designation-field">
                <div className="employee-label-action-row">
                  <label htmlFor="create-designation-select">
                    Designation
                  </label>
                  {!isCustomCreate ? (
                    <button
                      type="button"
                      className="employee-label-action-btn"
                      onClick={() => {
                        setIsCustomCreate(true);
                        setCustomCreateInput(createForm.designation || '');
                      }}
                      title="Add a custom designation"
                    >
                      + Add Custom
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="employee-label-action-btn"
                      onClick={() => {
                        setIsCustomCreate(false);
                      }}
                      title="Choose from standard dropdown"
                    >
                      ← From List
                    </button>
                  )}
                </div>

                {!isCustomCreate ? (
                  <select
                    id="create-designation-select"
                    className="employee-form-select"
                    value={
                      [...STANDARD_DESIGNATIONS, ...orgDesignations].includes(createForm.designation)
                        ? createForm.designation
                        : createForm.designation
                        ? '__custom_val__'
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setIsCustomCreate(true);
                        setCustomCreateInput('');
                      } else if (val === '__custom_val__') {
                        setIsCustomCreate(true);
                        setCustomCreateInput(createForm.designation);
                      } else {
                        setCreateForm((prev) => ({
                          ...prev,
                          designation: val,
                        }));
                      }
                    }}
                  >
                    <option value="">Select Designation...</option>
                    <optgroup label="Standard Designations">
                      {STANDARD_DESIGNATIONS.map((desig) => (
                        <option key={desig} value={desig}>
                          {desig}
                        </option>
                      ))}
                    </optgroup>
                    {orgDesignations.length > 0 && (
                      <optgroup label="Organization Designations">
                        {orgDesignations.map((desig) => (
                          <option key={desig} value={desig}>
                            {desig}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    
                  </select>
                ) : (
                  <div className="employee-custom-input-box">
                    <input
                      type="text"
                      className="employee-custom-text-input"
                      placeholder="Type custom designation..."
                      value={customCreateInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCreateInput(val);
                        setCreateForm((prev) => ({
                          ...prev,
                          designation: val,
                        }));
                      }}
                      autoFocus
                    />
                    {customCreateInput && (
                      <button
                        type="button"
                        className="employee-custom-clear-btn"
                        onClick={() => {
                          setCustomCreateInput('');
                          setCreateForm((prev) => ({
                            ...prev,
                            designation: '',
                          }));
                        }}
                        title="Clear"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Employee Status in Create Dialog */}
              <label>
                Employee Status
                <select
                  name="status"
                  className="employee-form-select"
                  value={createForm.status || 'active'}
                  onChange={updateCreateField}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label>
                Password
                <div className="employee-password-wrap">
                  <input
                    name="password"
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={updateCreateField}
                    placeholder="Add a password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="employee-password-toggle"
                    onClick={() => setShowCreatePassword((prev) => !prev)}
                    aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                    title={showCreatePassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showCreatePassword} />
                  </button>
                </div>
              </label>

              <label>
                Confirm Password
                <div className="employee-password-wrap">
                  <input
                    name="confirmPassword"
                    type={showCreateConfirmPassword ? 'text' : 'password'}
                    value={createForm.confirmPassword}
                    onChange={updateCreateField}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="employee-password-toggle"
                    onClick={() => setShowCreateConfirmPassword((prev) => !prev)}
                    aria-label={showCreateConfirmPassword ? 'Hide password' : 'Show password'}
                    title={showCreateConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showCreateConfirmPassword} />
                  </button>
                </div>
              </label>

              {createError && (
                <div className="employee-form-error" role="alert">
                  {createError}
                </div>
              )}

              <div className="employee-dialog-actions">
                <button
                  type="button"
                  className="employee-cancel-button"
                  onClick={closeCreateDialog}
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="employee-submit-button"
                  disabled={creating}
                >
                  {creating ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Edit Employee popup */}
      {editingEmployee && (
        <div
          className="employee-dialog-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setEditingEmployee(null);
            }
          }}
        >
          <section
            className="employee-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-employee-title"
          >
            <div className="employee-dialog-header">
              <div>
                <h2 id="edit-employee-title">Edit Employee</h2>
                <p>Update the employee's details.</p>
              </div>

              <button
                type="button"
                className="employee-dialog-close"
                aria-label="Close edit employee form"
                onClick={closeEditDialog}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSaveEmployee}
              className="employee-form"
            >
              <label>
                Full Name
                <input
                  type="text"
                  value={editingEmployee.name || ''}
                  onChange={(event) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      name: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Email Address
                <input
                  type="email"
                  value={editingEmployee.email || ''}
                  onChange={(event) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      email: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Mobile Number
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={editingEmployee.mobileNumber || ''}
                  onChange={(event) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      mobileNumber: event.target.value,
                    })
                  }
                  required
                />
              </label>

              {/* Designation Dropdown & Custom Option in Edit Dialog */}
              <div className="employee-designation-field">
                <div className="employee-label-action-row">
                  <label htmlFor="edit-designation-select">
                    Designation
                  </label>
                  {!isCustomEdit ? (
                    <button
                      type="button"
                      className="employee-label-action-btn"
                      onClick={() => {
                        setIsCustomEdit(true);
                        setCustomEditInput(editingEmployee.designation || '');
                      }}
                      title="Add a custom designation"
                    >
                      + Add Custom
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="employee-label-action-btn"
                      onClick={() => {
                        setIsCustomEdit(false);
                      }}
                      title="Choose from standard dropdown"
                    >
                      ← From List
                    </button>
                  )}
                </div>

                {!isCustomEdit ? (
                  <select
                    id="edit-designation-select"
                    className="employee-form-select"
                    value={
                      [...STANDARD_DESIGNATIONS, ...orgDesignations].includes(editingEmployee.designation)
                        ? editingEmployee.designation
                        : editingEmployee.designation
                        ? '__custom_val__'
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setIsCustomEdit(true);
                        setCustomEditInput('');
                      } else if (val === '__custom_val__') {
                        setIsCustomEdit(true);
                        setCustomEditInput(editingEmployee.designation);
                      } else {
                        setEditingEmployee((prev) => ({
                          ...prev,
                          designation: val,
                        }));
                      }
                    }}
                  >
                    <option value="">Select Designation...</option>
                    <optgroup label="Standard Designations">
                      {STANDARD_DESIGNATIONS.map((desig) => (
                        <option key={desig} value={desig}>
                          {desig}
                        </option>
                      ))}
                    </optgroup>
                    {orgDesignations.length > 0 && (
                      <optgroup label="Organization Designations">
                        {orgDesignations.map((desig) => (
                          <option key={desig} value={desig}>
                            {desig}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {editingEmployee.designation &&
                      ![...STANDARD_DESIGNATIONS, ...orgDesignations].includes(editingEmployee.designation) && (
                        <option value="__custom_val__">
                          Custom: {editingEmployee.designation}
                        </option>
                      )}
                    <option value="__custom__">+ Custom Designation...</option>
                  </select>
                ) : (
                  <div className="employee-custom-input-box">
                    <input
                      type="text"
                      className="employee-custom-text-input"
                      placeholder="Type custom designation..."
                      value={customEditInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomEditInput(val);
                        setEditingEmployee((prev) => ({
                          ...prev,
                          designation: val,
                        }));
                      }}
                      autoFocus
                    />
                    {customEditInput && (
                      <button
                        type="button"
                        className="employee-custom-clear-btn"
                        onClick={() => {
                          setCustomEditInput('');
                          setEditingEmployee((prev) => ({
                            ...prev,
                            designation: '',
                          }));
                        }}
                        title="Clear"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Employee Status in Edit Dialog */}
              <label>
                Employee Status
                <select
                  name="status"
                  className="employee-form-select"
                  value={editingEmployee.status || 'active'}
                  onChange={(e) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label>
                Password
                <div className="employee-password-wrap">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editingEmployee.password || ''}
                    onChange={(event) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        password: event.target.value,
                      })
                    }
                    placeholder="Enter password (leave blank to keep current)"
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="employee-password-toggle"
                    onClick={() => setShowEditPassword((prev) => !prev)}
                    aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                    title={showEditPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showEditPassword} />
                  </button>
                </div>
              </label>

              <label>
                Confirm Password
                <div className="employee-password-wrap">
                  <input
                    type={showEditConfirmPassword ? 'text' : 'password'}
                    value={editingEmployee.confirmPassword || ''}
                    onChange={(event) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        confirmPassword: event.target.value,
                      })
                    }
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="employee-password-toggle"
                    onClick={() => setShowEditConfirmPassword((prev) => !prev)}
                    aria-label={showEditConfirmPassword ? 'Hide password' : 'Show password'}
                    title={showEditConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showEditConfirmPassword} />
                  </button>
                </div>
              </label>
              {error && (
                <div className="employee-form-error" role="alert">
                  {error}
                </div>
              )}

              <div className="employee-dialog-actions">
                <button
                  type="button"
                  className="employee-cancel-button"
                  onClick={closeEditDialog}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="employee-submit-button"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Delete confirmation popup */}
      {employeeToDelete && (
        <div
          className="delete-dialog-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !deleting
            ) {
              setEmployeeToDelete(null);
            }
          }}
        >
          <section
            className="delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="delete-dialog-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="m19 6-1 14H6L5 6" />
                <path d="M10 11v5M14 11v5" />
              </svg>
            </div>

            <h2 id="delete-dialog-title">
              Delete Employee?
            </h2>

            <p>
              Are you sure you want to delete{' '}
              <strong>{employeeToDelete.name}</strong>?
              This action cannot be undone.
            </p>

            <div className="delete-dialog-actions">
              <button
                type="button"
                className="delete-cancel-btn"
                onClick={() =>
                  !deleting && setEmployeeToDelete(null)
                }
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-confirm-btn"
                onClick={handleDeleteEmployee}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Contact Employee Popup (Phone Call & WhatsApp) */}
      <ContactClientDialog
        contact={contactDialog}
        onClose={() => setContactDialog(null)}
      />
    </div>
  );
}
