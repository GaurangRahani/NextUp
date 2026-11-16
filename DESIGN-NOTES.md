# NextUp — Design Notes & Architecture Decisions

> These decisions were locked during M0. Any change requires a PR reviewed by all team members.

---

## D1 — Time Handling
**Decision:** Store all timestamps in **UTC** in MongoDB.  
Convert to local timezone only at the React UI edge using `Intl.DateTimeFormat`.  
Default business timezone: `Asia/Kolkata` (IST, UTC+5:30) — stored once in the Business document.  
Utility functions live in `client/src/utils/dateUtils.js`.

## D2 — Slot Granularity
**Decision:** Fixed **15-minute** steps for the availability grid.  
Example slots: 09:00, 09:15, 09:30 …  
Slot boundaries are computed server-side in `/api/v1/availability`.

## D3 — Double-Booking Safeguard
**Decision:** Two-layer protection:
1. **Application layer:** re-check for overlaps in the booking controller before saving.
2. **Database layer:** compound unique index `{ staffId, date, startTime }` on the Appointment collection.  
   This rejects duplicate inserts even under simultaneous requests (race condition protection).  
No transactions used (single-document atomicity is sufficient here).

## D4 — Token Counter
**Decision:** Atomic increment using `findOneAndUpdate` with `$inc` on a `DailyCounter` collection.  
Document shape: `{ businessId, date, count }` with a unique index on `{ businessId, date }`.  
Daily reset is natural — a new document is upserted each calendar day.

## D5 — "Any Available" Staff
**Decision:** When a customer selects "Any available", the system picks the **staff member with the fewest appointments on that day** (least-loaded).  
Tie-break: lowest `_id` (consistent, deterministic).

## D6 — Wait Estimate Formula
**Decision:**
```
waitMinutes = (tokensAhead × avgServiceDuration) / activeStaffCount
```
- `tokensAhead` = number of tokens ahead in the queue with status `waiting` or `in-service`
- `avgServiceDuration` = average duration (minutes) of the services being rendered
- `activeStaffCount` = number of staff currently serving or available
- Remaining time for the current `in-service` customer = `max(0, avgServiceDuration - elapsedMinutes)`
- Recalculated after every queue state change (R8).

## D7 — State Management & Styling
**Decision:**
- **State:** Context API (React built-in). Redux is not needed for this scope.
- **Styling:** Tailwind CSS utility-first. No MUI.
- Primary color scale defined in `tailwind.config.js` as `primary.*`.

## D8 — Email Provider
**Decision:** **Resend** as the email provider (simple REST API, 3,000 free emails/month).  
All email logic is behind a single `server/utils/emailService.js` module.  
When `EMAIL_ENABLED=false` in `.env`, all emails are logged to the console instead (local dev default).  
A failed email **never** throws or rolls back a booking (R7).

## D9 — Service Deactivation vs Deletion
**Decision:** Services are **soft-deleted** (`isActive: false`). Hard deletion is never allowed.  
- A service with future appointments cannot be deactivated until those are resolved (R3).
- Existing appointments retain the `serviceId` reference.
- UI displays the service name with a `(deactivated)` badge when `isActive === false`.
- New bookings cannot use an inactive service.
