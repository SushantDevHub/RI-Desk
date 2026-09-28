# auth-api

Minimal JWT authentication backend. Registering stores a real user
record (hashed password); logging in checks it against that record —
match = user found (+ JWT token), no match = user not found.

## Files (grouped by role, all plain .js except config)

```
auth-api/
  package.json          dependencies
  .env                   JWT_SECRET / JWT_EXPIRES_IN / PORT (already filled in)
  server.js              Express app, mounts the routes below
  routes/
    auth.js               POST /register, POST /login, GET /me
  middleware/
    verifyToken.js         checks the JWT on protected routes
  utils/
    userStore.js           reads/writes data/users.json
```

`data/users.json` isn't shipped — it's created automatically the first
time you register someone.

## Run it

```
npm install
npm run start        # or: npm run dev  (auto-restarts on file changes)
```

Listens on `http://localhost:4000`.

## Endpoints

**POST `/api/auth/register`**
```json
{ "name": "Ronak Shah", "username": "ronak", "password": "secret123" }
```
→ `201` `{ "message": "...", "token": "...", "user": { "username", "name" } }`
  — signs a token immediately, same as login, so registering also logs
  the person in with a single request.
→ `409` if that username is already taken
→ `400` if a field is missing or password is under 6 characters

**POST `/api/auth/login`**
```json
{ "username": "ronak", "password": "secret123" }
```
→ `200` `{ "message": "User found.", "token": "...", "user": { "username", "name" } }`
→ `404` `{ "error": "User not found. Check your username and password." }`
  — returned both when the username doesn't exist **and** when the
  password is wrong, matching "if match then user is found else user
  is not found."

**GET `/api/auth/me`** — header `Authorization: Bearer <token>`
→ `200` `{ "user": { "username", "name", "iat", "exp" } }`
→ `401` if the token is missing, invalid, or expired

## Wiring it to LoginPage.jsx

`LoginPage` calls `onLogin({ employeeId, password })` and
`onRegister({ name, employeeId, password })` — this API expects
`username` instead of `employeeId`, so map that one field name when
you call it:

```jsx
import { useState } from 'react';
import LoginPage from './components/LoginPage.jsx';

const API_BASE = 'http://localhost:4000/api/auth';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin({ employeeId, password }) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: employeeId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('token', data.token);
      // e.g. navigate('/dashboard') here
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister({ name, employeeId, password }) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username: employeeId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // maybe switch back to the login tab here, or auto-login
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return <LoginPage loading={loading} error={error} onLogin={handleLogin} onRegister={handleRegister} />;
}
```

If your frontend runs on a different port (e.g. Vite's `5173`), the
browser is making a cross-origin request to `4000` — that's why `cors()`
is enabled in `server.js`. Alternatively, add a Vite dev proxy for
`/api` instead of hardcoding `API_BASE`.

## Known limits (fine for local/dev use)

- `JWT_SECRET` in `.env` is a placeholder — replace it before this
  goes anywhere but your own machine.
- No rate limiting or account lockout on repeated failed logins.
- Single flat `users.json` file — swap `utils/userStore.js` for a real
  database when you outgrow it; nothing outside that file needs to
  change since routes only call its exported functions.
