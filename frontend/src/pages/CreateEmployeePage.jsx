import { useState, useEffect, useRef } from 'react';
import { getToken } from '../api/authApi.js';
import './CreateEmployeePage.css';

const DEFAULT_DESIGNATIONS = [
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

export default function CreateEmployeePage({ onBack }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobileNumber: '',
    designation: '',
    password: '',
    confirmPassword: '',
  });

  const [isCustomDesignation, setIsCustomDesignation] = useState(false);
  const [designationDropdownOpen, setDesignationDropdownOpen] = useState(false);
  const [availableDesignations, setAvailableDesignations] = useState(DEFAULT_DESIGNATIONS);
  const designationRef = useRef(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load existing designations from backend to merge with standard presets
  useEffect(() => {
    let isMounted = true;
    async function loadDesignations() {
      try {
        const res = await fetch('http://localhost:4000/api/designations', {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && Array.isArray(data.designations)) {
          const titles = data.designations
            .map((d) => d.title?.trim())
            .filter(Boolean);
          const merged = Array.from(
            new Set([...DEFAULT_DESIGNATIONS, ...titles])
          );
          setAvailableDesignations(merged);
        }
      } catch {
        // fallback to default designations
      }
    }
    loadDesignations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        designationRef.current &&
        !designationRef.current.contains(event.target)
      ) {
        setDesignationDropdownOpen(false);
      }
    }
    if (designationDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [designationDropdownOpen]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSelectDesignation(title) {
    setForm((prev) => ({
      ...prev,
      designation: title,
    }));
    setDesignationDropdownOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage('');
    setError('');

    if (
      !form.name ||
      !form.email ||
      !form.mobileNumber ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError('Please fill all required fields.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        'http://localhost:4000/api/users',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            mobileNumber: form.mobileNumber.trim(),
            designation: form.designation.trim(),
            password: form.password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'Failed to create employee.'
        );
      }

      setMessage('Employee created successfully.');
      setTimeout(() => {
        if (typeof onBack === 'function') {
          onBack();
        }
      }, 1000);

      setForm({
        name: '',
        email: '',
        mobileNumber: '',
        designation: '',
        password: '',
        confirmPassword: '',
      });
      setIsCustomDesignation(false);
      setDesignationDropdownOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="employee-page">
      <div className="employee-page-header">
        <div>
          <h1>Add Employee</h1>
          <p>
            Register a new team member and grant dashboard access.
          </p>
        </div>
      </div>

      <div className="employee-form-card">
        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter employee name"
              required
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label>E-mail</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter employee email"
              required
            />
          </div>

          {/* Mobile Number */}
          <div className="form-group">
            <label>Mobile Number</label>
            <input
              type="tel"
              name="mobileNumber"
              value={form.mobileNumber}
              onChange={handleChange}
              placeholder="Enter mobile number"
              required
            />
          </div>

          {/* Designation Row: Dropdown Button & Custom Option */}
          <div className="form-group designation-form-group" ref={designationRef}>
            <div className="designation-header-row">
              <label>Designation</label>
              <button
                type="button"
                className="designation-toggle-btn"
                onClick={() => {
                  setIsCustomDesignation((prev) => !prev);
                  setDesignationDropdownOpen(false);
                }}
              >
                {isCustomDesignation ? (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3.01" y2="6"></line>
                      <line x1="3" y1="12" x2="3.01" y2="12"></line>
                      <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                    Choose from list
                  </>
                ) : (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Custom Designation
                  </>
                )}
              </button>
            </div>

            {!isCustomDesignation ? (
              <div className="designation-dropdown-wrap">
                {/* Button that toggles the basic dropdown */}
                <button
                  type="button"
                  className={`designation-dropdown-trigger ${
                    designationDropdownOpen ? 'active' : ''
                  }`}
                  onClick={() => setDesignationDropdownOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={designationDropdownOpen}
                >
                  <span className="designation-trigger-label">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="designation-icon"
                    >
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span
                      className={`designation-text ${
                        form.designation
                          ? 'designation-value'
                          : 'designation-placeholder'
                      }`}
                    >
                      {form.designation || 'Select Designation...'}
                    </span>
                  </span>

                  <span className="designation-trigger-end">
                    {form.designation && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="designation-reset-btn"
                        title="Clear designation"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm((prev) => ({ ...prev, designation: '' }));
                        }}
                      >
                        ✕
                      </span>
                    )}
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`designation-arrow ${
                        designationDropdownOpen ? 'open' : ''
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>

                {/* Dropdown Menu */}
                {designationDropdownOpen && (
                  <div className="designation-dropdown-panel" role="listbox">
                    <div className="designation-panel-header">
                      <span>Standard Designations</span>
                      <span className="designation-counter">
                        {availableDesignations.length} available
                      </span>
                    </div>

                    <div className="designation-dropdown-list">
                      {availableDesignations.map((title) => {
                        const isSelected = form.designation === title;
                        return (
                          <div
                            key={title}
                            role="option"
                            aria-selected={isSelected}
                            className={`designation-dropdown-option ${
                              isSelected ? 'selected' : ''
                            }`}
                            onClick={() => handleSelectDesignation(title)}
                          >
                            <span className="designation-option-title">
                              {title}
                            </span>
                            {isSelected && (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#4f46e5"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="designation-panel-footer">
                      <button
                        type="button"
                        className="designation-custom-option-btn"
                        onClick={() => {
                          setIsCustomDesignation(true);
                          setDesignationDropdownOpen(false);
                        }}
                      >
                        <span className="designation-plus-icon">+</span>
                        <span>Type a custom designation instead</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Selection Pills */}
                <div className="designation-pills-row">
                  <span className="designation-pills-title">Quick Select:</span>
                  <div className="designation-pills-list">
                    {[
                      'Support Specialist',
                      'Technical Support Engineer',
                      'Billing & Accounts Executive',
                      'Team Lead',
                    ].map((pill) => (
                      <button
                        key={pill}
                        type="button"
                        className={`designation-pill ${
                          form.designation === pill ? 'active' : ''
                        }`}
                        onClick={() => {
                          setForm((prev) => ({ ...prev, designation: pill }));
                        }}
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Custom Designation Input Box */
              <div className="designation-custom-box">
                <div className="designation-custom-input-wrap">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="designation-custom-icon"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                  </svg>
                  <input
                    type="text"
                    name="designation"
                    value={form.designation}
                    onChange={handleChange}
                    placeholder="Enter custom designation (e.g. Lead DevOps Engineer)"
                    autoFocus
                    className="designation-custom-input"
                  />
                  {form.designation && (
                    <button
                      type="button"
                      className="designation-custom-clear-btn"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, designation: '' }))
                      }
                      title="Clear"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="designation-custom-footer">
                  <span className="designation-custom-note">
                    💡 Enter any custom role or specific job title for this employee.
                  </span>
                  <button
                    type="button"
                    className="designation-revert-btn"
                    onClick={() => setIsCustomDesignation(false)}
                  >
                    ← Back to standard presets
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label>Password</label>
            <div className="employee-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="employee-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label>Confirm Password</label>
            <div className="employee-password-wrap">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="employee-password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? 'Hide password'
                    : 'Show password'
                }
                title={
                  showConfirmPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                <EyeIcon visible={showConfirmPassword} />
              </button>
            </div>
          </div>

          {error && (
            <div className="employee-error">
              {error}
            </div>
          )}

          {message && (
            <div className="employee-success">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="create-employee-btn"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Employee'}
          </button>
        </form>

        <button
          type="button"
          onClick={onBack}
          className="back-btn"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
