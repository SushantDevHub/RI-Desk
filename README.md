# RI-Desk

A full-stack Support & Ticket Management System built with React, Vite, Express, and JWT Authentication.

---

## Project Structure

```
RI-Desk/
├── backend/                       # Express REST API backend
│   ├── data/                      # JSON data stores (users, tickets)
│   │   ├── tickets.json           # Stored tickets data
│   │   └── users.json             # Stored user accounts
│   ├── middleware/                # Express middleware
│   │   └── verifyToken.js         # JWT token verification
│   ├── routes/                    # API route handlers
│   │   ├── auth.js                # Auth endpoints (/login, /register, /reset-password)
│   │   ├── tickets.js             # Ticket CRUD & status workflows (/api/tickets)
│   │   └── users.js               # Employee management endpoints (/api/users)
│   ├── utils/                     # Storage helper utilities
│   │   ├── ticketStore.js         # Ticket file persistence & mutations
│   │   └── userStore.js           # User file persistence & lookups
│   ├── .env                       # Backend environment variables
│   ├── .gitignore                 # Backend git ignore rules
│   ├── package.json               # Backend dependencies and scripts
│   ├── README.md                  # Backend API documentation
│   └── server.js                  # Backend application entry point
│
├── frontend/                      # React + Vite frontend client
│   ├── src/                       # Application source code
│   │   ├── api/                   # API client integrations
│   │   │   └── authApi.js         # Authentication API requests & token management
│   │   ├── components/            # Reusable UI components
│   │   │   └── LoginPage.jsx      # Login & password reset form component
│   │   ├── pages/                 # Main application view pages
│   │   │   ├── CreateEmployeePage.jsx   # Admin create employee view
│   │   │   ├── DashboardPage.css        # Dashboard styling & ticket table styles
│   │   │   ├── DashboardPage.jsx        # Main Dashboard (Admin & Employee views)
│   │   │   ├── EmployeeListPage.jsx     # Admin employee management view
│   │   │   ├── TicketManagementPage.css # Ticket management styles
│   │   │   └── TicketManagementPage.jsx # Full ticket management & filters
│   │   ├── styles/                # Global and shared CSS stylesheets
│   │   │   ├── base.css           # Global reset and typography
│   │   │   └── login.css          # Login page styling
│   │   ├── App.jsx                # Application root router and session check
│   │   └── main.jsx               # React DOM entry point
│   ├── .gitignore                 # Frontend git ignore rules
│   ├── index.html                 # HTML template
│   ├── package.json               # Frontend dependencies and scripts
│   └── vite.config.js             # Vite build and development configuration
│
├── .gitignore                     # Root git ignore rules
└── README.md                      # Project documentation and setup guide
```

---

## Quick Start

### 1. Backend Server

```bash
cd backend
npm install
npm run start    # Runs at http://localhost:4000
```

### 2. Frontend Application

```bash
cd frontend
npm install
npm run dev      # Runs at http://localhost:5173
```

---

## Features

- **Role-Based Access Control**:
  - **Admin**: Full access to dashboard statistics, ticket management, employee management (create, edit, delete), and status tracking.
  - **Employee**: Dedicated dashboard showing assigned tickets, status dropdown editor (`Open`, `In Progress`, `Resolved`), customer contact details, and resolution tracking.
- **Direct Customer Contact**:
  - Every ticket displays customer avatar with a clickable phone link (`tel:<mobile>`) allowing employees or admins to connect immediately.
- **Live Resolution Time**:
  - Automatically calculates and stores duration from ticket creation to resolution upon marking resolved.
- **JWT Authentication**:
  - Secure stateless auth with persistent token sessions.
