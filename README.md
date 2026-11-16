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

### 4. Verify
- Backend: `GET http://localhost:5000/api/v1/health` → 200
- Frontend: open `http://localhost:5173`

## Running Tests
```bash
# Backend
cd server && npm test

# Frontend
cd client && npm test
```

## Project Structure
```
NextUp/
├── client/          React frontend
├── server/          Node/Express backend
├── DESIGN-NOTES.md  Architecture decisions (D1–D9)
├── API-CONTRACT.md  Endpoint reference
└── README.md
```

## Branch Strategy
- `main` — production only; PR + 1 reviewer required
- `develop` — integration branch; merge after tests pass
- `feat/m*` — one branch per module

## Live URLs
- Frontend: _TBD (Vercel/Netlify after M0 deploy)_
- Backend:  _TBD (Render/Railway after M0 deploy)_

## Team
MSC IT — Sem 3 Web & Mobile Dev Project
