# NextUp API Contract

## Base URL
```
Development:  http://localhost:5000/api/v1
Production:   <render/railway URL>/api/v1
```

## Authentication
All protected routes require:
```
Authorization: Bearer <jwt_token>
```
Token obtained from `POST /api/v1/auth/login`.

## Standard Response Shape

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Human-readable success message"
}
```

### Error
```json
{
  "success": false,
  "data": null,
  "message": "Human-readable error description"
}
```

## HTTP Status Codes Used
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validation, invalid input) |
| 401 | Unauthorized (missing/invalid/expired token) |
| 403 | Forbidden (authenticated but wrong role) |
| 404 | Not Found |
| 409 | Conflict (duplicate entry) |
| 500 | Internal Server Error |

---

## M0 — Health

### GET /api/v1/health
No auth required.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-11-16T11:00:00.000Z"
  },
  "message": "Server is running"
}
```

---

## M1 — Authentication

### 1. Register User
`POST /api/v1/auth/register`
- **Auth required:** No
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123",
  "role": "customer",
  "businessId": null
}
```
- **Validation Rules:**
  - `name`: required string, 2-50 characters
  - `email`: required valid email format
  - `password`: required string, minimum 6 characters
  - `role`: optional enum `['customer', 'staff', 'admin']` (default: `'customer'`)
  - `businessId`: optional MongoId (required for staff/admin if bound to a business)
- **Response 201 (Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6738b8...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "customer",
      "businessId": null,
      "createdAt": "2026-11-16T12:00:00.000Z"
    },
    "token": "eyJhbGciOi..."
  },
  "message": "User registered successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (missing fields or password < 6 chars)
  - `409 Conflict`: Duplicate email (`User already exists with this email`)

---

### 2. Login User
`POST /api/v1/auth/login`
- **Auth required:** No
- **Request Body:**
```json
{
  "email": "jane@example.com",
  "password": "password123"
}
```
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6738b8...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "customer",
      "businessId": null
    },
    "token": "eyJhbGciOi..."
  },
  "message": "Login successful"
}
```
- **Error Responses:**
  - `400 Bad Request`: Missing email or password
  - `401 Unauthorized`: Invalid credentials (incorrect password or user not found)

---

### 3. Get Current User Profile
`GET /api/v1/auth/me`
- **Auth required:** Yes (`Bearer <token>`)
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738b8...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "customer",
    "businessId": null,
    "createdAt": "2026-11-16T12:00:00.000Z",
    "updatedAt": "2026-11-16T12:00:00.000Z"
  },
  "message": "User profile fetched successfully"
}
```
- **Error Responses:**
  - `401 Unauthorized`: Missing, expired, or invalid token
  - `404 Not Found`: User no longer exists

---

## M2 — Business Profile _(TBD)_
## M3 — Services _(TBD)_
## M4 — Staff _(TBD)_
## M5 — Appointments _(TBD)_
## M6 — Availability _(TBD)_
## M7 — Appointment Management _(TBD)_
## M8 — Walk-in Tokens _(TBD)_
## M9 — Queue Dashboard _(TBD)_
## M10 — Queue Position & Wait _(TBD)_
## M11 — Business Dashboard _(TBD)_
## M12 — Email Notifications _(TBD)_
