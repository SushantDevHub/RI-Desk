
import { useEffect, useState, useRef } from 'react';
import { getToken } from '../api/authApi.js';
import '../pages/DashboardPage.css';

const API_URL = 'http://localhost:4000/api/users';

const EMPTY_FORM = {
  name: '',
  email: '',
  mobileNumber: '',
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

export default function EmployeeListPage() {
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
  }, []);

  // Open the Create Employee popup.
  function openCreateDialog() {
    setCreateForm({ ...EMPTY_FORM });
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
    setEditingEmployee({
      ...employee,
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
        err.message || 'Failed to create employee.'
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
          <h1>Employees</h1>
          <p>View and manage your support team.</p>
        </div>

        <button
          type="button"
          className="create-employee-top-btn"
          onClick={openCreateDialog}
        >
          + Create Employee
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
            Create an employee account to get your support team started.
          </p>

          <button
            type="button"
            className="create-employee-empty-btn"
            onClick={openCreateDialog}
          >
            Create First Employee
          </button>
        </div>
      ) : (
        !error && (
          <div className="employee-table-card">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile Number</th>
                  <th>Role</th>
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

                    <td>{employee.email || '—'}</td>

                    <td>{employee.mobileNumber || '—'}</td>

                    <td>
                      <span className="employee-role">
                        {employee.role || 'employee'}
                      </span>
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
                  Create Employee
                </h2>
                <p>Add a new member to your support team.</p>
              </div>

              <button
                type="button"
                className="employee-dialog-close"
                aria-label="Close create employee form"
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

              <label>
                Password
                <div className="employee-password-wrap">
                  <input
                    name="password"
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={updateCreateField}
                    placeholder="Create a password"
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
                  {creating ? 'Creating...' : 'Create Employee'}
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
    </div>
  );
}
