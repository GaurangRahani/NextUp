# NextUp — Appointment & Queue Management System

A full-stack MERN web application for local businesses (salons, clinics, service centers) to manage appointments, walk-in queues, and staff schedules.

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | React (Vite) + React Router + Tailwind  |
| Backend    | Node.js + Express                       |
| Database   | MongoDB (Atlas) + Mongoose              |
| Auth       | JWT + bcrypt                            |
| Email      | Resend (console fallback in dev)        |
| Testing    | Jest + Supertest + Vitest + RTL         |

## Local Setup

### Prerequisites
- Node.js v18+
- npm v9+
- MongoDB Atlas account (or local MongoDB)

### 1. Clone the repo
```bash
git clone <repo-url>
cd NextUp
```

### 2. Backend setup
```bash
cd server
cp .env.example .env     # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev              # starts on http://localhost:5000
```

### 3. Frontend setup
```bash
cd client
cp .env.example .env     # set VITE_API_URL if not using default
npm install
npm run dev              # starts on http://localhost:5173
```

### 4. Seed Database (Optional)
```bash
cd server
npm run seed              # Seeds 1 business, 5 services, 3 staff, 1 customer
```

### 5. Verify
- Backend: `GET http://localhost:5000/api/v1/health` → 200
- Frontend: open `http://localhost:5173`

## Modules & Progress

| Module | Title | Status | Rules / Notes |
|---|---|---|---|
| **M0** | Setup & Foundation | ✅ Done | Express, Atlas, Vite, Tailwind v4, Shell |
| **M1** | Authentication & Role-Based Authorization | ✅ Done | **R6** (Role Matrix & Ownership) |
| **M2** | Business Profile & Operating Hours | ✅ Done | Weekday hours validation (open < close) |
| **M3** | Service Management | ✅ Done | **R3** (Deactivate vs Delete) |
| **M4** | Staff Management & Service Assignment | ✅ Done | Cross-business validation, Seed script |
| **M5** | Appointment Booking | ✅ Done | **R2** (Hours, staff assignment, no past dates) |
| **M6** | Availability & Conflict Prevention | ✅ Done | **R1** (No overlapping bookings, back-to-back allowed) |
| **M7** | Appointment Management | ✅ Done | Reschedule, Cancel, Status Lifecycle |
| **M8** | Walk-in Token Generation | ✅ Done | **R4** (Atomic daily token counter) |
| **M9** | Queue Dashboard & Status Management | ✅ Done | **R5** (State machine) + **R6** (access control) |
| **M10** | Queue Position & Wait Time Estimation | ✅ Done | **R8** (D6 formula, 15s live polling) |
| **M11** | Business Dashboard | ✅ Done | Mongo aggregation — appointments + queue + revenue |
| **M12** | Email Notifications | ⏳ Pending | **R7** (Non-blocking, Resend — see D8 in DESIGN-NOTES) |
| **M13** | Integration, Deployment & Demo | ⏳ Pending | End-to-end, Postman, Render + Vercel deploy |

## Test Coverage

```
Backend (Jest + Supertest): 174 tests across 12 suites — all passing ✅
Frontend (Vitest + RTL):     26 tests across 3 suites — all passing ✅
```

## Running Tests
```bash
# Backend (from /server)
cd server && npm test

# Frontend (from /client)
cd client && npm test
```

## Project Structure
```
NextUp/
├── client/                     React frontend (Vite + Tailwind)
│   └── src/
│       ├── api/                Axios API modules (one per domain)
│       ├── components/         Shared UI + layout components
│       ├── context/            AuthContext (React Context API)
│       ├── hooks/              useAuth, useToast
│       ├── pages/              One page component per route
│       │   └── __tests__/      Vitest + RTL tests
│       └── routes/             AppRouter + ProtectedRoute
├── server/                     Node/Express backend
│   ├── controllers/            Business logic handlers
│   ├── middleware/             auth, authorize, ownership, error
│   ├── models/                 Mongoose schemas
│   ├── routes/                 Express routers
│   ├── utils/                  ApiError, sendResponse, jwt, emailService
│   └── __tests__/              Jest + Supertest integration tests
├── API-CONTRACT.md             Full endpoint reference (M0–M11 documented)
├── DESIGN-NOTES.md             Architecture decisions (D1–D9)
├── ER-DIAGRAM.md               Entity relationships & status transitions
├── M12-M13-HANDOFF.md          ← Handoff guide for next developer
└── README.md
```

## Branch Strategy
- `main` — production only; PR + 1 reviewer required
- `develop` — integration branch; merge after tests pass
- `feat/m*` — one branch per module

## Live URLs
- Frontend: _TBD (Vercel/Netlify after M13 deploy)_
- Backend:  _TBD (Render/Railway after M13 deploy)_

## Team
MSC IT — Sem 3 Web & Mobile Dev Project

