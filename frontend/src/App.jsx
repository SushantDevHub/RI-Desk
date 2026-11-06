import { useState, useEffect, useRef } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import EmployeeListPage from './pages/EmployeeListPage.jsx';
import LoginPage from './components/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

import {
  loginUser,
  setToken,
  clearToken,
  getToken,
} from './api/authApi.js';

// Login route wrapper
function LoginRoute({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const submittingRef = useRef(false);

  async function handleLogin({ mobileNumber, password, remember }) {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const data = await loginUser({
        mobileNumber,
        password,
        remember,
      });

      // Save JWT token
      setToken(data.token, remember);

      // Save logged-in user including role
      onSuccess(data.user);

      // Go to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <LoginPage
      loading={loading}
      error={error}
      onLogin={handleLogin}
    />
  );
}

// Root app
export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = getToken();

      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        const res = await fetch(
          'http://localhost:4000/api/auth/me',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();

        if (res.ok) {
          setUser(data.user);
        } else {
          clearToken();
        }
      } catch (err) {
        console.error('Session restore failed:', err);
        clearToken();
      } finally {
        setCheckingSession(false);
      }
    }

    restoreSession();
  }, []);

  function handleLogout() {
    clearToken();
    setUser(null);
  }

  if (checkingSession) {
    return null;
  }

  return (
<Routes>
  {/* Login */}
  <Route
    path="/login"
    element={
      <LoginRoute onSuccess={setUser} />
    }
  />

  {/* Dashboard */}
  <Route
    path="/dashboard"
    element={
      user ? (
        <DashboardPage
          user={user}
          onLogout={handleLogout}
        />
      ) : (
        <Navigate to="/login" replace />
      )
    }
  />

  {/* Employee List */}
  <Route
    path="/admin/employees"
    element={
      user ? (
        <EmployeeListPage />
      ) : (
        <Navigate to="/login" replace />
      )
    }
  />

  {/* Unknown URL */}
  <Route
    path="*"
    element={
      <Navigate to="/login" replace />
    }
  />
</Routes>

  );
}