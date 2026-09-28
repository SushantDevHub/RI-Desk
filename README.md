# Rechargedesk-app

Everything wired and ready to run — register a real account, log in
with it. Two folders, each grouped internally by file type:

```
Rechargedesk-app/
  backend/                  JWT auth API (Express)
    package.json, .env
    server.js
    routes/auth.js            register, login, /me
    middleware/verifyToken.js
    utils/userStore.js        reads/writes data/users.json

  frontend/                 Login/register UI (React + Vite)
    package.json, vite.config.js, index.html
    src/
      main.jsx, App.jsx        entry point + wiring to the API
      api/authApi.js            fetch calls to backend
      components/LoginPage.jsx   the UI itself
      styles/LoginPage.css
      assets/README.md           where the logo goes
```

## Run it (two terminals)

**Terminal 1:**
```
cd backend
npm install
npm run start        # http://localhost:4000
```

**Terminal 2:**
```
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Open the frontend URL. Register an account (name, employee ID,
password) — that calls `POST /api/auth/register`, stores it (password
hashed) in `backend/data/users.json`, and logs you straight in. Log
out and back in with the same credentials and it'll find the match;
get the password wrong and you'll see "User not found" right in the
form.

## How it's connected

`frontend/src/api/authApi.js` calls the backend directly at
`http://localhost:4000` (different port than the frontend's `5173`,
cross-origin — that's why `cors()` is enabled in `backend/server.js`).
`frontend/src/App.jsx` wires `LoginPage`'s `onLogin`/`onRegister`
props to those calls, mapping the one differing field name
(`employeeId` → `username`), stores the returned token, and swaps in
a signed-in view once `user` is set.

## Known limits (fine for local use)

- `JWT_SECRET` in `backend/.env` is a placeholder — replace before
  deploying anywhere real.
- Sessions are in-memory on the backend; restarting it signs everyone
  out, but registered accounts persist in `users.json`.
- The signed-in screen in `App.jsx` is a plain placeholder — swap it
  for your real dashboard/next screen.
- Logo in `Topbar`/`LoginPage` is still a placeholder — see
  `frontend/src/assets/README.md`.
