import { useState } from 'react';
import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage from './components/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import { loginUser, registerUser, setToken, clearToken, getToken } from './api/authApi.js';

// ── Login route wrapper ──────────────────────────────────────────────────────
function LoginRoute({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const navigate              = useNavigate();

  async function handleLogin({ employeeId, password }) {
    setLoading(true);
    setError('');
    try {
      const data = await loginUser({ username: employeeId, password });
      setToken(data.token);
      onSuccess(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

 async function handleRegister({ name, employeeId, password }) {
  setLoading(true);
  setError('');

  try {
    await registerUser({
      name,
      username: employeeId,
      password
    });

    // Registration successful.
    // Do NOT save the token or log the user in.
    setLoading(false);
    navigate('/login');

  } catch (err) {
    setError(err.message);
    setLoading(false);
  }
}

  return <LoginPage loading={loading} error={error} onLogin={handleLogin} onRegister={handleRegister} />;
}

// ── Temporary dashboard placeholder ─────────────────────────────────────────
// Replace this with your real DashboardPage component when ready.


// ── Root app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);  // ← ADD THIS

  useEffect(() => {
    async function restoreSession() {
      const token = getToken();
      if (!token) {
        setCheckingSession(false);  // ← ADD THIS
        return;
      }

      try {
        const res = await fetch('http://localhost:4000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setUser(data.user);
      } catch (err) {
        clearToken();
      } finally {
        setCheckingSession(false);  // ← ADD THIS
      }
    }
    restoreSession();
  }, []);

  function handleLogout() {
    clearToken();
    setUser(null);
  }

  // ← ADD THIS BLOCK - while checking, show nothing (loading)
  if (checkingSession) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login"     element={<LoginRoute onSuccess={setUser} />} />
      <Route path="/dashboard" element={
        user
          ? <DashboardPage user={user} />
          : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
