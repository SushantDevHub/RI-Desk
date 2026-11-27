import { useState, useEffect, useRef } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import LoginPage from './components/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RaiseTicketPage from './modules/raise-ticket/RaiseTicketPage.jsx';

import {
  loginUser,
  setToken,
  clearToken,
  getToken,
} from './api/authApi.js';
import { API_BASE } from './config/api.js';

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
  const locationRequestedRef = useRef(false);

  useEffect(() => {
    if (locationRequestedRef.current) return;
    locationRequestedRef.current = true;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          try {
            sessionStorage.setItem(
              'ridesk_coords',
              JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp || Date.now(),
              })
            );
          } catch {
            // Ignore storage errors
          }
        },
        () => {
          // Browser handles permission prompt and denials natively
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    }
  }, []);

  useEffect(() => {
    async function restoreSession() {
      const token = getToken();

      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/auth/me`,
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
    <>
      <Routes>
        {/* Standalone Public Raise Ticket Route */}
        <Route path="/raise-ticket" element={<RaiseTicketPage />} />

        {/* Login */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginRoute onSuccess={setUser} />
            )
          }
        />

        {/* Main Authenticated Pages inside DashboardPage shell */}
        <Route
          path="/*"
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
      </Routes>
    </>
  );
}