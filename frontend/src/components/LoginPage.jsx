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
    <div className="login-page">
      <div className="login-center">
        <div className="login-card">

          {/* ── Brand ── */}
          <div className="login-brand">
            <div className="login-brand-name">
              <img
                src='img.jpg'
                alt="Rambhiya Infotech"
              />
              <span className="brand-recharge">RI-</span>
              <span className="brand-desk">Desk</span>
            </div>
            <div className="login-brand-slogan">
              One-stop solution for all.
            </div>
          </div>

          {view === 'login' ? (
            <>
              {/* ── Title ── */}
              <div className="login-title">
                <h1>Access Your Dashboard</h1>
                <p>Sign in with your mobile number to continue.</p>
              </div>

              {/* ── Alert Slot ── */}
              <div className="login-alert-slot">
                {displayError && (
                  <div className="login-alert login-alert-error">⚠ {displayError}</div>
                )}
              </div>

              {/* ── Login form ── */}
              <form onSubmit={handleLoginSubmit} method="post" action="/dashboard" name="loginForm" id="loginForm">
                <div className="field">
                  <label htmlFor="login-mobile">Mobile number</label>
                  <input
                    id="login-mobile"
                    name="username"
                    type="tel"
                    placeholder="9876543210"
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

                <div className="field">
                  <label htmlFor="login-password">Password</label>
                  <div className="field-input-wrap">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
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
                      className="field-toggle"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="field-row">
                  <label className="remember-me">
                    <input
                      type="checkbox"
                      id="remember-me-checkbox"
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
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={switchToForgot}
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? 'Logging in…' : 'Log in'}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* ── Forgot Password Title ── */}
              <div className="login-title">
                <h1>Reset Password</h1>
                <p>Enter your registered Email ID to set a new password.</p>
              </div>

              {/* ── Alerts Slot ── */}
              <div className="login-alert-slot">
                {forgotError && (
                  <div className="login-alert login-alert-error">⚠ {forgotError}</div>
                )}
                {forgotSuccess && (
                  <div className="login-alert login-alert-success">✓ {forgotSuccess}</div>
                )}
              </div>

              {/* ── Forgot Password form ── */}
              <form onSubmit={handleForgotSubmit}>
                <div className="field">
                  <label htmlFor="forgot-email">Registered Email ID</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="forgot-new-pwd">New Password</label>
                  <div className="field-input-wrap">
                    <input
                      id="forgot-new-pwd"
                      type={showForgotPwd ? 'text' : 'password'}
                      placeholder="Minimum 4 characters"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="field-toggle"
                      onClick={() => setShowForgotPwd((s) => !s)}
                      aria-label={showForgotPwd ? 'Hide password' : 'Show password'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="forgot-confirm-pwd">Confirm New Password</label>
                  <input
                    id="forgot-confirm-pwd"
                    type={showForgotPwd ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="login-submit"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Resetting password…' : 'Reset Password'}
                </button>

                <div className="forgot-back-wrap">
                  <button
                    type="button"
                    className="forgot-back-btn"
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

      <div className="login-footer">
        <p>RI-Desk Support Portal · Secure Access</p>
        <p>© 2026 RI-Desk. All rights reserved.</p>
      </div>
    </div>
  );
}
