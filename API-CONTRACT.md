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

## M4 — Staff Management & Service Assignment

### 1. Create Staff Member
`POST /api/v1/staff`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`)
- **Request Body:**
```json
{
  "name": "Alex Taylor",
  "email": "alex@example.com",
  "password": "password123",
  "serviceIds": ["6738d2...", "6738d3..."],
  "businessId": "6738c1..."
}
```
*Note: Alternatively, an existing `userId` can be provided instead of name/email/password.*
- **Validation Rules:**
  - `email`: valid email format, must not already exist
  - `name`: required string (2-50 chars)
  - `password`: min 6 chars (when creating new user)
  - `serviceIds`: optional array of Service ObjectIds. **All assigned services must belong to the staff's business** (cross-business assignment rejected with 400).
- **Response 201 (Created):**
```json
{
  "success": true,
  "data": {
    "_id": "6738e1...",
    "userId": {
      "_id": "6738a1...",
      "name": "Alex Taylor",
      "email": "alex@example.com",
      "role": "staff"
    },
    "businessId": "6738c1...",
    "serviceIds": [
      {
        "_id": "6738d2...",
        "name": "Haircut & Styling",
        "duration": 45,
        "price": 500
      }
    ],
    "isActive": true
  },
  "message": "Staff member created successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Missing fields, or one or more services do not belong to this business
  - `403 Forbidden`: User is not an admin of this business
  - `409 Conflict`: User email already exists

---

### 2. List Staff Members
`GET /api/v1/staff?businessId=...&serviceId=...&includeInactive=false`
- **Auth required:** Optional (public/customer can see active staff for a business; admin can view all including inactive with `includeInactive=true`)
- **Query Parameters:**
  - `businessId` (required if unauthenticated or admin with multiple businesses)
  - `serviceId` (optional, filter staff offering this service)
  - `includeInactive` (optional boolean, admin only)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6738e1...",
      "userId": {
        "_id": "6738a1...",
        "name": "Alex Taylor",
        "email": "alex@example.com",
        "role": "staff"
      },
      "businessId": "6738c1...",
      "serviceIds": [
        {
          "_id": "6738d2...",
          "name": "Haircut & Styling",
          "duration": 45,
          "price": 500
        }
      ],
      "isActive": true
    }
  ],
  "message": "Staff members fetched successfully"
}
```

---

### 3. Get Staff Member by ID
`GET /api/v1/staff/:id`
- **Auth required:** Optional
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738e1...",
    "userId": {
      "_id": "6738a1...",
      "name": "Alex Taylor",
      "email": "alex@example.com"
    },
    "businessId": "6738c1...",
    "serviceIds": [...],
    "isActive": true
  },
  "message": "Staff profile fetched successfully"
}
```
- **Error Responses:**
  - `404 Not Found`: Staff profile not found

---

### 4. Update Staff Member
`PUT /api/v1/staff/:id`
- **Auth required:** Yes (`Bearer <token>`, role: `admin` or the staff member themselves)
- **Request Body:** Partial update (`name`, `serviceIds`, `isActive`)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738e1...",
    "userId": {
      "_id": "6738a1...",
      "name": "Alex Taylor Updated",
      "email": "alex@example.com"
    },
    "serviceIds": [...],
    "isActive": true
  },
  "message": "Staff profile updated successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Cross-business service assignment attempt
  - `403 Forbidden`: Unauthorized user
  - `404 Not Found`: Staff member not found

---

### 5. Assign Services to Staff
`PUT /api/v1/staff/:id/services`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`)
- **Request Body:**
```json
{
  "serviceIds": ["6738d2...", "6738d3..."]
}
```
- **Validation:**
  - `serviceIds`: array of valid Service IDs belonging to the same business
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738e1...",
    "serviceIds": [...]
  },
  "message": "Services assigned to staff successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: One or more services do not belong to this business
  - `404 Not Found`: Staff profile not found

---

### 6. Deactivate Staff Member
`DELETE /api/v1/staff/:id`
- **Auth required:** Yes (`Bearer <token>`, role: `admin`)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738e1...",
    "isActive": false,
    "isDeactivated": true
  },
  "message": "Staff member deactivated successfully"
}
```
- **Error Responses:**
  - `403 Forbidden`: Unauthorized
  - `404 Not Found`: Staff member not found

---

## M5 — Appointment Booking (Rule R2)

### 1. Book an Appointment
`POST /api/v1/appointments`
- **Auth required:** Yes (`Bearer <token>`, customer, staff, or admin)
- **Request Body:**
```json
{
  "businessId": "6738c1...",
  "serviceId": "6738d2...",
  "staffId": "6738a1...",
  "date": "2026-11-20",
  "startTime": "10:30",
  "notes": "First time visit"
}
```
*Note: `staffId` can be a specific staff member's User ID, or `"any"` / omitted to automatically pick the least-loaded qualified staff member (Decision D5).*
- **Business Rule R2 Checks:**
  1. **Not in the past:** The combined appointment date and start time must be in the future.
  2. **Within operating hours:** The day must not be closed, `startTime >= open`, and `endTime <= close`.
  3. **Staff assignment:** The selected staff member must have an active `StaffProfile` assigned to the selected `serviceId`.
- **Response 201 (Created):**
```json
{
  "success": true,
  "data": {
    "_id": "6738f1...",
    "customerId": {
      "_id": "6738a2...",
      "name": "Deep Boghara",
      "email": "customer@example.com"
    },
    "staffId": {
      "_id": "6738a1...",
      "name": "Rahul Sharma",
      "email": "rahul@example.com"
    },
    "serviceId": {
      "_id": "6738d2...",
      "name": "Haircut & Styling",
      "duration": 45,
      "price": 500
    },
    "businessId": {
      "_id": "6738c1...",
      "name": "Apex Salon & Spa"
    },
    "date": "2026-11-20T00:00:00.000Z",
    "startTime": "10:30",
    "endTime": "11:15",
    "status": "scheduled",
    "notes": "First time visit",
    "createdAt": "2026-11-16T19:30:00.000Z"
  },
  "message": "Appointment booked successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Missing fields, service inactive/nonexistent, staff not assigned to service (Rule R2), appointment outside business hours (Rule R2), appointment in the past (Rule R2).
  - `401 Unauthorized`: Missing or invalid token.

---

### 2. List Appointments
`GET /api/v1/appointments?businessId=...&date=...&status=...&staffId=...`
- **Auth required:** Yes (`Bearer <token>`)
- **Access Control (Rule R6):**
  - `customer`: Returns only their own appointments.
  - `staff`: Returns appointments assigned to them.
  - `admin`: Returns all appointments for their business.
- **Query Parameters:**
  - `date`: Filter by date (YYYY-MM-DD)
  - `status`: Filter by status (`scheduled`, `completed`, `cancelled`, `no-show`)
  - `staffId`: Filter by staff member
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6738f1...",
      "customerId": { "_id": "...", "name": "Deep Boghara" },
      "staffId": { "_id": "...", "name": "Rahul Sharma" },
      "serviceId": { "_id": "...", "name": "Haircut", "duration": 45, "price": 500 },
      "date": "2026-11-20T00:00:00.000Z",
      "startTime": "10:30",
      "endTime": "11:15",
      "status": "scheduled"
    }
  ],
  "message": "Appointments fetched successfully"
}
```

---

### 3. Get Appointment by ID
`GET /api/v1/appointments/:id`
- **Auth required:** Yes (`Bearer <token>`)
- **Access Control (Rule R6):** Verified against customer, staff, or business admin.
- **Response 200 (OK):** Single populated appointment document.
- **Error Responses:**
  - `403 Forbidden`: Not authorized to view this appointment.
  - `404 Not Found`: Appointment not found.

---

## M6 — Availability & Conflict Prevention (Rule R1)

### 1. Get Real-Time Slot Availability
`GET /api/v1/availability?businessId=...&serviceId=...&date=...&staffId=...`
- **Auth required:** Optional (public/customer can check availability before booking)
- **Query Parameters:**
  - `businessId` (required)
  - `serviceId` (required — determines slot duration)
  - `date` (required — `YYYY-MM-DD`)
  - `staffId` (optional — specific staff member User ID, or `"any"` / omitted to check all qualified staff)
- **Business Rule R1 Logic:**
  - Evaluates business operating hours for the given date.
  - Generates discrete time slots from opening to closing minus service duration (at 15-minute or 30-minute granularity).
  - Filters out past slots if the date is today.
  - Queries active appointments on that date (`status != 'cancelled'`).
  - Evaluates overlap condition for each slot: `slotStart < apptEnd AND slotEnd > apptStart`.
  - Back-to-back slots (`slotStart == apptEnd` or `slotEnd == apptStart`) are valid and non-overlapping.
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "date": "2026-11-20",
    "dayOfWeek": "Friday",
    "operatingHours": {
      "open": "09:00",
      "close": "18:00",
      "isClosed": false
    },
    "service": {
      "_id": "6738d2...",
      "name": "Haircut & Styling",
      "duration": 45
    },
    "staffId": "6738a1...",
    "slots": [
      {
        "startTime": "09:00",
        "endTime": "09:45",
        "isAvailable": true,
        "availableStaff": ["6738a1...", "6738a2..."]
      },
      {
        "startTime": "09:30",
        "endTime": "10:15",
        "isAvailable": false,
        "reason": "Conflict"
      }
    ]
  },
  "message": "Availability calculated successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Missing query parameters, invalid date or time format.
  - `404 Not Found`: Business or Service not found.

---

### 2. Overlap Safeguard on Booking (Rule R1)
Integrated into `POST /api/v1/appointments`:
- Before creating a booking, checks if an overlapping active appointment exists for that staff member (`newStart < existingEnd AND newEnd > existingStart`).
- If an overlap is detected, returns `409 Conflict`:
```json
{
  "success": false,
  "data": null,
  "message": "Rule R1: An overlapping appointment already exists for this staff member"
}
```

---

## M7 — Appointment Management

### 1. Cancel Appointment
`PATCH /api/v1/appointments/:id/cancel`
- **Auth required:** Yes (`Bearer <token>`, customer who owns the booking, or staff/admin of the business)
- **Request Body:**
```json
{
  "reason": "Family emergency"
}
```
- **Behavior:**
  - Changes status from `scheduled` to `cancelled`.
  - Frees up the slot immediately so other customers can book it.
  - Rejects if the appointment is already cancelled (400) or already completed (400).
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738f1...",
    "status": "cancelled",
    "cancellationReason": "Family emergency",
    "updatedAt": "2026-11-16T20:30:00.000Z"
  },
  "message": "Appointment cancelled successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Appointment is already cancelled or already completed.
  - `403 Forbidden`: Customer attempting to cancel someone else's appointment (Rule R6).
  - `404 Not Found`: Appointment not found.

---

### 2. Reschedule Appointment
`PATCH /api/v1/appointments/:id/reschedule`
- **Auth required:** Yes (`Bearer <token>`, customer who owns the booking, or staff/admin)
- **Request Body:**
```json
{
  "date": "2026-11-25",
  "startTime": "14:00"
}
```
- **Behavior & Validation:**
  - Re-evaluates **Rule R2** (new date/time cannot be in past, must fit inside operating hours, business not closed).
  - Re-evaluates **Rule R1** conflict checks against other active bookings for the same staff member (excluding the appointment's own current slot).
  - Re-computes `endTime` from `new startTime + service.duration`.
  - Updates date, startTime, endTime, and leaves status as `scheduled`.
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738f1...",
    "date": "2026-11-25T00:00:00.000Z",
    "startTime": "14:00",
    "endTime": "14:45",
    "status": "scheduled"
  },
  "message": "Appointment rescheduled successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Cannot reschedule cancelled or completed appointment, or invalid date/time outside operating hours (Rule R2).
  - `403 Forbidden`: Unauthorized user (Rule R6).
  - `409 Conflict`: Target slot is already taken by another active booking for this staff member (Rule R1).

---

### 3. Update Appointment Status (Admin / Staff)
`PATCH /api/v1/appointments/:id/status`
- **Auth required:** Yes (`Bearer <token>`, staff or admin)
- **Request Body:**
```json
{
  "status": "completed"
}
```
- **Allowed Transitions:**
  - `scheduled` → `completed`
  - `scheduled` → `no-show`
  - `scheduled` → `cancelled`
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6738f1...",
    "status": "completed"
  },
  "message": "Appointment status updated to completed"
}
```
- **Error Responses:**
  - `400 Bad Request`: Invalid status or illegal status transition.
  - `403 Forbidden`: Customer role cannot update status directly (Rule R6).

---

### 4. List Appointments by Timeframe
`GET /api/v1/appointments?timeframe=upcoming|past&status=...`
- **Auth required:** Yes (`Bearer <token>`)
- **Query Parameters:**
  - `timeframe`: `"upcoming"` (appointments with date/time >= now) or `"past"` (appointments with date/time < now)
  - `status`: filter by specific status
  - `staffId`: filter by staff member (admin only)
- **Response 200 (OK):** Array of populated appointments.

---

## M8 — Walk-in Tokens (Rule R4)

### 1. Generate Walk-in Token
`POST /api/v1/queue/tokens`
- **Auth required:** Optional (`optionalAuth` — customers/guests can generate at kiosk, or staff/admin can generate at desk)
- **Request Body:**
```json
{
  "businessId": "6738b8...",
  "serviceId": "6738d2...",
  "guestName": "Jane Doe",
  "guestPhone": "9876543210"
}
```
- **Validation Rules:**
  - `businessId`: required MongoId. Business must exist and not be closed today.
  - `serviceId`: required MongoId. Service must belong to `businessId` and be active (`isActive: true`).
  - `guestName`: required if user is not authenticated (minimum 2 chars). If authenticated, defaults to `req.user.name`.
  - `guestPhone`: optional phone number string.
- **Business Rule R4 & Decision D4 Logic:**
  - Queue date is computed as today's date (`YYYY-MM-DD` in UTC/business timezone).
  - Atomic counter increment using `DailyCounter.findOneAndUpdate({ businessId, date: queueDate }, { $inc: { count: 1 } }, { new: true, upsert: true })`.
  - Sequential token number begins at 1 each calendar day per business.
  - Unique compound index `{ businessId: 1, queueDate: 1, tokenNumber: 1 }` on `QueueToken` prevents duplicates.
- **Response 201 (Created):**
```json
{
  "success": true,
  "data": {
    "_id": "673901...",
    "businessId": {
      "_id": "6738b8...",
      "name": "Luxe Salon & Spa"
    },
    "serviceId": {
      "_id": "6738d2...",
      "name": "Haircut & Styling",
      "duration": 45,
      "price": 30
    },
    "customerId": "6738a1...",
    "guestName": "Jane Doe",
    "guestPhone": "9876543210",
    "tokenNumber": 1,
    "queueDate": "2026-11-16",
    "status": "waiting",
    "createdAt": "2026-11-16T20:30:00.000Z",
    "updatedAt": "2026-11-16T20:30:00.000Z"
  },
  "message": "Token generated successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Missing businessId or serviceId, business closed today, service inactive, missing guestName for unauthenticated user.
  - `404 Not Found`: Business or Service not found.

---

### 2. Get Single Token by ID
`GET /api/v1/queue/tokens/:id`
- **Auth required:** Optional (public token receipt page / live status screen)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "_id": "673901...",
    "businessId": {
      "_id": "6738b8...",
      "name": "Luxe Salon & Spa"
    },
    "serviceId": {
      "_id": "6738d2...",
      "name": "Haircut & Styling",
      "duration": 45,
      "price": 30
    },
    "tokenNumber": 1,
    "queueDate": "2026-11-16",
    "status": "waiting",
    "guestName": "Jane Doe",
    "guestPhone": "9876543210"
  },
  "message": "Token retrieved successfully"
}
```
- **Error Responses:**
  - `404 Not Found`: Token not found.

---

### 3. Get Today's Queue Tokens for Business
`GET /api/v1/queue/today?businessId=...`
- **Auth required:** Optional (for public queue display boards and kiosk monitors)
- **Query Parameters:**
  - `businessId` (required)
  - `status` (optional: `'waiting'`, `'called'`, `'in-service'`, `'completed'`, `'cancelled'`, `'no-show'`)
- **Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "673901...",
      "tokenNumber": 1,
      "guestName": "Jane Doe",
      "status": "waiting",
      "serviceId": { "name": "Haircut & Styling", "duration": 45 }
    }
  ],
  "message": "Today's queue tokens retrieved successfully"
}
```

---

## M9 — Queue Dashboard & Status Management (Rule R5)

### 1. Update Queue Token Status
`PATCH /api/v1/queue/tokens/:id/status`
- Specification for status transitions (waiting, called, in-service, completed, cancelled, no-show)
- Enforces Rule R5 allowed transitions and Rule R6 access control

## M9 — Queue Dashboard _(TBD)_
## M10 — Queue Position & Wait _(TBD)_
## M11 — Business Dashboard _(TBD)_
## M12 — Email Notifications _(TBD)_
