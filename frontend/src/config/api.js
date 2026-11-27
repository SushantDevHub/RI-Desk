/**
 * Central API base configuration for RI-Desk frontend.
 * Uses Vite env var `VITE_API_BASE_URL` (set in `frontend/.env` or `frontend/.env.production`)
 * and falls back to `http://localhost:4000` during local development.
 */
export const API_ROOT = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
).replace(/\/+$/, '');

export const API_BASE = `${API_ROOT}/api`;
