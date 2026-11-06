import { useState } from 'react';
import { getToken } from '../api/authApi.js';

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
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
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
      setError('Please fill all fields.');
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
            name: form.name,
            email: form.email,
            mobileNumber: form.mobileNumber,
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
  onBack();
}, 1000);

      setForm({
        name: '',
        email: '',
        mobileNumber: '',
        password: '',
        confirmPassword: '',
      });
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

          <div className="form-group">
            <label>Name</label>

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter employee name"
            />
          </div>
        <div className='form-group'>
          <label>E-mail</label>
          <input
            type = "email"
            name = "email"
            value = {form.email}
            onChange={handleChange}
            placeholder = "Enter employee email"
          />
        </div>
        <div className="form-group">
          <label>Mobile Number</label>

          <input
            type="tel"
            name="mobileNumber"
            value={form.mobileNumber}
            onChange={handleChange}
            placeholder="Enter mobile number"
          />
          </div>

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
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
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
            {loading
              ? 'Creating...'
              : 'Create Employee'}
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