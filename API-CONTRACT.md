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

## M2 — Business Profile & Operating Hours

### 1. Create Business
`POST /api/v1/business`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`)
- **Request Body:**
```json
{
  "name": "Luxe Salon & Spa",
  "timezone": "Asia/Kolkata",
  "phone": "+91 98765 43210",
  "address": {
    "street": "123 High Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zip": "400001"
  },
  "operatingHours": [
    { "day": "Monday", "open": "09:00", "close": "18:00", "isClosed": false },
    { "day": "Tuesday", "open": "09:00", "close": "18:00", "isClosed": false },
    { "day": "Wednesday", "open": "09:00", "close": "18:00", "isClosed": false },
    { "day": "Thursday", "open": "09:00", "close": "18:00", "isClosed": false },
    { "day": "Friday", "open": "09:00", "close": "19:00", "isClosed": false },
    { "day": "Saturday", "open": "10:00", "close": "19:00", "isClosed": false },
    { "day": "Sunday", "open": "00:00", "close": "00:00", "isClosed": true }
  ]
}
```
- **Validation Rules:**
  - `name`: required string, 2-100 characters
  - `timezone`: valid IANA timezone string (default `'Asia/Kolkata'`)
  - `operatingHours`: array of 7 days (Monday–Sunday)
  - `open` and `close`: `HH:mm` 24h format; when `isClosed: false`, `open < close` is required
- **Response 201 (Created):**
```json
{
  "success": true,
  "data": {
    "_id": "6738c1...",
    "name": "Luxe Salon & Spa",
    "timezone": "Asia/Kolkata",
    "phone": "+91 98765 43210",
    "address": { "street": "123 High Street", "city": "Mumbai", "state": "Maharashtra", "zip": "400001" },
    "operatingHours": [ ... ],
    "createdAt": "2026-11-16T12:00:00.000Z",
    "updatedAt": "2026-11-16T12:00:00.000Z"
  },
  "message": "Business profile created successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (open >= close, malformed hours, missing name)
  - `401 Unauthorized`: Missing or invalid token
  - `403 Forbidden`: Non-admin role attempting creation

---

### 2. Get Current Admin Business
`GET /api/v1/business`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738c1...",
    "name": "Luxe Salon & Spa",
    "timezone": "Asia/Kolkata",
    "phone": "+91 98765 43210",
    "address": { ... },
    "operatingHours": [ ... ]
  },
  "message": "Business profile fetched successfully"
}
```
- **Error Responses:**
  - `401 Unauthorized`: Not authenticated
  - `403 Forbidden`: Role not admin
  - `404 Not Found`: No business associated with this admin account

---

### 3. Get Business Profile by ID
`GET /api/v1/business/:id`
- **Auth required:** No (Public endpoint for customers booking appointments)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738c1...",
    "name": "Luxe Salon & Spa",
    "timezone": "Asia/Kolkata",
    "phone": "+91 98765 43210",
    "address": { ... },
    "operatingHours": [ ... ]
  },
  "message": "Business fetched successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Invalid ID format
  - `404 Not Found`: Business not found

---

### 4. Update Business Profile & Hours
`PUT /api/v1/business/:id`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`, own business only)
- **Request Body:** Partial or complete business object
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738c1...",
    "name": "Luxe Salon & Spa Updated",
    "timezone": "Asia/Kolkata",
    "phone": "+91 98765 43210",
    "operatingHours": [ ... ],
    "updatedAt": "2026-11-16T12:30:00.000Z"
  },
  "message": "Business profile updated successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (`open >= close`, invalid hours)
  - `401 Unauthorized`: Missing or invalid token
  - `403 Forbidden`: User is not admin or trying to modify another business (Rule R6)
  - `404 Not Found`: Business not found

---

## M3 — Services

### 1. Create Service
`POST /api/v1/services`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`)
- **Request Body:**
```json
{
  "name": "Haircut & Styling",
  "description": "Standard haircut and blow dry styling",
  "duration": 45,
  "price": 500,
  "businessId": "6738c1..."
}
```
- **Validation Rules:**
  - `name`: required string, 2-100 characters
  - `duration`: required positive integer in minutes (`> 0`)
  - `price`: required non-negative number (`>= 0`)
  - `businessId`: required MongoId (defaults to admin's `businessId`)
- **Response 201 (Created):**
```json
{
  "success": true,
  "data": {
    "_id": "6738d2...",
    "name": "Haircut & Styling",
    "description": "Standard haircut and blow dry styling",
    "duration": 45,
    "price": 500,
    "businessId": "6738c1...",
    "isActive": true,
    "createdAt": "2026-11-16T13:00:00.000Z",
    "updatedAt": "2026-11-16T13:00:00.000Z"
  },
  "message": "Service created successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (duration <= 0, price < 0, missing name)
  - `401 Unauthorized`: Missing or invalid token
  - `403 Forbidden`: Non-admin user or modifying another business

---

### 2. List Services
`GET /api/v1/services`
- **Auth required:** Optional
- **Query Parameters:**
  - `businessId`: optional MongoId (required if not logged in as admin)
  - `includeInactive`: optional boolean (`true` | `false`, admin only)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6738d2...",
      "name": "Haircut & Styling",
      "description": "Standard haircut and blow dry styling",
      "duration": 45,
      "price": 500,
      "businessId": "6738c1...",
      "isActive": true
    }
  ],
  "message": "Services fetched successfully"
}
```

---

### 3. Get Single Service by ID
`GET /api/v1/services/:id`
- **Auth required:** No
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738d2...",
    "name": "Haircut & Styling",
    "duration": 45,
    "price": 500,
    "businessId": "6738c1...",
    "isActive": true
  },
  "message": "Service fetched successfully"
}
```
- **Error Responses:**
  - `404 Not Found`: Service not found

---

### 4. Update Service
`PUT /api/v1/services/:id`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`)
- **Request Body:** Partial or complete service object (`name`, `description`, `duration`, `price`, `isActive`)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738d2...",
    "name": "Haircut & Styling (Updated)",
    "duration": 50,
    "price": 550,
    "isActive": true
  },
  "message": "Service updated successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Invalid duration (<= 0) or price (< 0)
  - `403 Forbidden`: Not admin of this business
  - `404 Not Found`: Service not found

---

### 5. Delete or Deactivate Service (Rule R3)
`DELETE /api/v1/services/:id`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`)
- **Behavior (Rule R3):**
  - If service has upcoming scheduled appointments (`date >= today` and status `scheduled`), it is **deactivated** (`isActive: false`), never deleted.
  - If service has no future appointments, it is deleted.
- **Response 200 (OK - Deactivated):**
```json
{
  "success": true,
  "data": {
    "_id": "6738d2...",
    "isActive": false,
    "isDeactivated": true
  },
  "message": "Service has upcoming appointments and was deactivated instead of deleted (Rule R3)"
}
```
- **Response 200 (OK - Deleted):**
```json
{
  "success": true,
  "data": {
    "_id": "6738d2...",
    "isDeleted": true
  },
  "message": "Service deleted successfully"
}
```

---

## M4 — Staff _(TBD)_
## M5 — Appointments _(TBD)_
## M6 — Availability _(TBD)_
## M7 — Appointment Management _(TBD)_
## M8 — Walk-in Tokens _(TBD)_
## M9 — Queue Dashboard _(TBD)_
## M10 — Queue Position & Wait _(TBD)_
## M11 — Business Dashboard _(TBD)_
## M12 — Email Notifications _(TBD)_
