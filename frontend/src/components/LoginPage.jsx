import { useState } from 'react';
import { resetPassword } from '../api/authApi.js';
import '../styles/base.css';
import '../styles/login.css';

export default function LoginPage({ onLogin, error, loading }) {
  const [view, setView] = useState('login'); // 'login' | 'forgot'

  // Login form state
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => {
    const saved = localStorage.getItem('ri_remember_me');
    return saved !== null ? saved === 'true' : true;
  });
  const [mobileNumber, setMobileNumber] = useState(() => {
    return localStorage.getItem('ri_remembered_mobile') || '';
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem('ri_remembered_password') || '';
  });
  const [localError, setLocalError] = useState('');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  function handleLoginSubmit(e) {
    e.preventDefault();
    const trimmedMobile = mobileNumber.trim();
    if (!trimmedMobile || !password) {
      setLocalError('Please enter both your mobile number and password.');
      return;
    }

    setLocalError('');

    // Persist or clear Remember Me mobile and password
    if (remember) {
      localStorage.setItem('ri_remember_me', 'true');
      localStorage.setItem('ri_remembered_mobile', trimmedMobile);
      localStorage.setItem('ri_remembered_password', password);
    } else {
      localStorage.setItem('ri_remember_me', 'false');
      localStorage.removeItem('ri_remembered_mobile');
      localStorage.removeItem('ri_remembered_password');
    }

    onLogin?.({ mobileNumber: trimmedMobile, password, remember });
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const email = forgotEmail.trim();
    if (!email) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    if (!newPassword) {
      setForgotError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 4) {
      setForgotError('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);
    try {
      const data = await resetPassword({ email, newPassword });
      setForgotSuccess(
        data.message || 'Password reset successfully! Redirecting to login...'
      );

      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setView('login');
        setForgotSuccess('');
        setForgotError('');
      }, 1800);
    } catch (err) {
      setForgotError(
        err.message || 'Failed to reset password. Please try again.'
      );
    } finally {
      setForgotLoading(false);
    }
  }

  function switchToForgot() {
    setLocalError('');
    setForgotError('');
    setForgotSuccess('');
    setView('forgot');
  }

  function switchToLogin() {
    setLocalError('');
    setForgotError('');
    setForgotSuccess('');
    setView('login');
  }

  const displayError = error || localError;

  return (
    <div className="ri-login-page">
      <div className="ri-login-center">
        <div className="ri-login-card">

          {/* ── Brand Logo ── */}
          <div className="ri-brand-wrap">
            <img
              src="/rambhiya-logo.png"
              alt="Rambhiya Infotech"
              className="ri-brand-logo"
              onError={(e) => {
                // fallback if png path differs
                e.currentTarget.src = 'rambhiya-logo.png';
              }}
            />
          </div>

          {view === 'login' ? (
            <>
              {/* ── Subtitle ── */}
              <h2 className="ri-login-heading">Login to your account</h2>

              {/* ── Alert Slot ── */}
              {displayError && (
                <div className="ri-login-alert ri-login-alert-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{displayError}</span>
                </div>
              )}

              {/* ── Login Form ── */}
              <form onSubmit={handleLoginSubmit} className="ri-login-form" noValidate>
                {/* Mobile No Input */}
                <div className="ri-field-wrap">
                  <input
                    id="login-mobile"
                    name="username"
                    type="tel"
                    className="ri-input"
                    placeholder="Mobile No"
                    autoComplete="username tel"
                    value={mobileNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMobileNumber(val);
                      if (remember) {
                        if (val.trim()) {
                          localStorage.setItem('ri_remembered_mobile', val.trim());
                        } else {
                          localStorage.removeItem('ri_remembered_mobile');
                        }
                      }
                    }}
                  />
                </div>

                {/* Password Input with Eye Icon */}
                <div className="ri-field-wrap ri-password-wrap">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="ri-input ri-password-input"
                    placeholder="Password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPassword(val);
                      if (remember) {
                        if (val) {
                          localStorage.setItem('ri_remembered_password', val);
                        } else {
                          localStorage.removeItem('ri_remembered_password');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="ri-eye-toggle"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      /* Eye slashed */
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1 2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      /* Eye open */
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Remember Me & Reset Password row */}
                <div className="ri-options-row">
                  <label className="ri-remember-label">
                    <input
                      type="checkbox"
                      id="remember-me-checkbox"
                      className="ri-checkbox"
                      checked={remember}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRemember(checked);
                        if (!checked) {
                          localStorage.setItem('ri_remember_me', 'false');
                          localStorage.removeItem('ri_remembered_mobile');
                          localStorage.removeItem('ri_remembered_password');
                        } else {
                          localStorage.setItem('ri_remember_me', 'true');
                          if (mobileNumber.trim()) {
                            localStorage.setItem('ri_remembered_mobile', mobileNumber.trim());
                          }
                          if (password) {
                            localStorage.setItem('ri_remembered_password', password);
                          }
                        }
                      }}
                    />
                    <span>Remember Me</span>
                  </label>

                  <button
                    type="button"
                    className="ri-reset-link"
                    onClick={switchToForgot}
                  >
                    Reset Password
                  </button>
                </div>

                {/* Sign In button */}
                <button
                  type="submit"
                  className="ri-signin-btn"
                  disabled={loading}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>

                {/* Public Raise Ticket Link */}
                <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                  Facing an issue?{' '}
                  <a
                    href="/raise-ticket"
                    style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Raise Support Ticket
                  </a>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* ── Forgot Password View ── */}
              <h2 className="ri-login-heading">Reset Password</h2>
              <p className="ri-login-subtext">Enter your registered Email ID to set a new password.</p>

              {/* Alerts */}
              {forgotError && (
                <div className="ri-login-alert ri-login-alert-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{forgotError}</span>
                </div>
              )}
              {forgotSuccess && (
                <div className="ri-login-alert ri-login-alert-success" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>{forgotSuccess}</span>
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="ri-login-form" noValidate>
                <div className="ri-field-wrap">
                  <input
                    id="forgot-email"
                    type="email"
                    className="ri-input"
                    placeholder="Registered Email ID"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="ri-field-wrap ri-password-wrap">
                  <input
                    id="forgot-new-pwd"
                    type={showForgotPwd ? 'text' : 'password'}
                    className="ri-input ri-password-input"
                    placeholder="New Password (min 4 chars)"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="ri-eye-toggle"
                    onClick={() => setShowForgotPwd((s) => !s)}
                    aria-label={showForgotPwd ? 'Hide password' : 'Show password'}
                  >
                    {showForgotPwd ? (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1 2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="ri-field-wrap">
                  <input
                    id="forgot-confirm-pwd"
                    type={showForgotPwd ? 'text' : 'password'}
                    className="ri-input"
                    placeholder="Confirm New Password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="ri-signin-btn"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Resetting Password...' : 'Reset Password'}
                </button>

                <div className="ri-back-wrap">
                  <button
                    type="button"
                    className="ri-back-btn"
                    onClick={switchToLogin}
                  >
                    ← Back to Login
                  </button>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
