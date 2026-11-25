import { useState, useEffect, useCallback } from 'react';
import './LocationPermissionModal.css';

const SESSION_CHOICE_KEY = 'ridesk_location_choice';
const SESSION_COORDS_KEY = 'ridesk_coords';

/**
 * Helper to retrieve stored session coordinates if available.
 */
export function getStoredCoordinates() {
  try {
    const raw = sessionStorage.getItem(SESSION_COORDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Responsive Location Permission Popup Component.
 * - Options:
 *   1) Allow while visiting this site
 *   2) Allow this time
 *   3) Don't allow
 * - Uses the Geolocation API.
 * - Handles errors and denials.
 * - Stores temporary session choices in sessionStorage.
 * - Respects native browser permissions (navigator.permissions).
 * - Matches RI-Desk UI styling.
 */
export default function LocationPermissionModal({ onLocationAcquired }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Check whether prompt should be displayed
  const checkPermissionsAndPrompt = useCallback(async () => {
    // 1. If user already made a decision in this session, respect it
    const storedChoice = sessionStorage.getItem(SESSION_CHOICE_KEY);
    if (storedChoice) {
      if (storedChoice === 'while_visiting' || storedChoice === 'once') {
        // If already granted in this session, silently refresh coordinates if needed
        requestNativeLocation(false, storedChoice);
      }
      return;
    }

    // 2. Check if Geolocation is supported
    if (!('geolocation' in navigator)) {
      return;
    }

    // 3. Check browser-level permission status if supported
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });

        if (permissionStatus.state === 'granted') {
          // Native browser permission is already granted
          sessionStorage.setItem(SESSION_CHOICE_KEY, 'while_visiting');
          requestNativeLocation(false, 'while_visiting');
          return;
        }

        if (permissionStatus.state === 'denied') {
          // Browser has permanently denied geolocation for this origin
          sessionStorage.setItem(SESSION_CHOICE_KEY, 'denied');
          return;
        }

        // State is 'prompt': Display our custom pre-permission dialog
        setIsOpen(true);

        // Listen for changes in native permission
        permissionStatus.onchange = () => {
          if (permissionStatus.state === 'granted') {
            sessionStorage.setItem(SESSION_CHOICE_KEY, 'while_visiting');
            setIsOpen(false);
            requestNativeLocation(false, 'while_visiting');
          } else if (permissionStatus.state === 'denied') {
            sessionStorage.setItem(SESSION_CHOICE_KEY, 'denied');
            setIsOpen(false);
          }
        };
        return;
      } catch (err) {
        // Fallback if query fails
      }
    }

    // Fallback: Show dialog if no choice has been recorded yet
    setIsOpen(true);
  }, []);

  useEffect(() => {
    // Delay slightly so app loads cleanly without jarring popup
    const timer = setTimeout(() => {
      checkPermissionsAndPrompt();
    }, 700);

    return () => clearTimeout(timer);
  }, [checkPermissionsAndPrompt]);

  // Request actual coordinates via navigator.geolocation
  function requestNativeLocation(interactive = true, choiceType = 'once') {
    if (!('geolocation' in navigator)) {
      if (interactive) setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    if (interactive) {
      setLoading(true);
      setErrorMessage('');
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now(),
        };

        // Save coords in sessionStorage
        try {
          sessionStorage.setItem(SESSION_COORDS_KEY, JSON.stringify(coords));
        } catch {
          // Ignore quota errors
        }

        if (interactive) {
          setLoading(false);
          setIsOpen(false);
        }

        onLocationAcquired?.(coords);
      },
      (error) => {
        if (interactive) {
          setLoading(false);
          let message = 'Unable to retrieve location.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Location access was denied in browser settings.';
            sessionStorage.setItem(SESSION_CHOICE_KEY, 'denied');
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'Location information is currently unavailable.';
          } else if (error.code === error.TIMEOUT) {
            message = 'Location request timed out. Please try again.';
          }
          setErrorMessage(message);

          // Auto-close dialog after brief pause on denial
          if (error.code === error.PERMISSION_DENIED) {
            setTimeout(() => {
              setIsOpen(false);
            }, 1800);
          }
        }
      },
      geoOptions
    );
  }

  // Handle user selecting one of the three options
  function handleSelect(choice) {
    if (choice === 'while_visiting') {
      sessionStorage.setItem(SESSION_CHOICE_KEY, 'while_visiting');
      requestNativeLocation(true, 'while_visiting');
    } else if (choice === 'once') {
      sessionStorage.setItem(SESSION_CHOICE_KEY, 'once');
      requestNativeLocation(true, 'once');
    } else if (choice === 'denied') {
      sessionStorage.setItem(SESSION_CHOICE_KEY, 'denied');
      setIsOpen(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="ri-location-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ri-location-title"
      aria-describedby="ri-location-desc"
    >
      <div className="ri-location-card">
        {/* Close Button (maps to Don't allow) */}
        <button
          type="button"
          className="ri-location-close-btn"
          onClick={() => handleSelect('denied')}
          aria-label="Close"
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Location Icon Badge */}
        <div className="ri-location-icon-wrap">
          <div className="ri-location-icon-badge">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <span className="ri-location-pulse" />
        </div>

        {/* Content */}
        <div className="ri-location-body">
          <h2 id="ri-location-title" className="ri-location-title">
            Allow RI-Desk to access your location?
          </h2>
          <p id="ri-location-desc" className="ri-location-desc">
            RI-Desk uses your location to assist with field support, localized ticket routing, and service availability.
          </p>

          {/* Error Message if Denied/Unavailable */}
          {errorMessage && (
            <div className="ri-location-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Three Action Options */}
        <div className="ri-location-actions">
          {/* 1. Allow while visiting this site */}
          <button
            type="button"
            className="ri-location-btn ri-location-btn-primary"
            onClick={() => handleSelect('while_visiting')}
            disabled={loading}
          >
            {loading ? (
              <span className="ri-location-loading-wrap">
                <span className="ri-location-spinner" />
                Requesting Location...
              </span>
            ) : (
              'Allow while visiting this site'
            )}
          </button>

          {/* 2. Allow this time */}
          <button
            type="button"
            className="ri-location-btn ri-location-btn-secondary"
            onClick={() => handleSelect('once')}
            disabled={loading}
          >
            Allow this time
          </button>

          {/* 3. Don't allow */}
          <button
            type="button"
            className="ri-location-btn ri-location-btn-ghost"
            onClick={() => handleSelect('denied')}
            disabled={loading}
          >
            Don’t allow
          </button>
        </div>
      </div>
    </div>
  );
}
