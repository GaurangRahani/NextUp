# NextUp execution plan

Goal: a **deployed, demo-ready** appointment and queue management app that passes the full demo flow on live URLs without manual fixes. Docs, tests and the demo are all scored inside that outcome.

Stack: React (Vite) + React Router + Axios + Context/Redux + Tailwind/MUI · Node/Express · MongoDB/Mongoose · JWT + bcrypt · Resend/Brevo/SendGrid · Jest + Supertest + React Testing Library + Postman.

## Rules of the road
1. **Anyone picks any module.** Take a module whose dependencies are done, mark it "In progress" on the GitHub Projects board, and finish all of it (model, API, screens, tests, Postman requests) before taking the next. No module belongs to a person.
2. **One PR per module**, reviewed by someone other than its author. Merge into `develop` when tests pass, into `main` only when demo-ready.
3. **Inside a module, work in this order:** endpoint contract, backend, frontend, tests.
4. **Contract first.** A dependent module may start as soon as the models and API contract of its dependency are merged; build against sample data until the rest lands. Any contract change is a PR all three reviewers see.
5. **Conventions are fixed in M0:** `/api/v1`, responses shaped `{ success, data, message }`, dates stored in UTC, business time zone defined once.
6. **Test names are rule names.** `it('R1: rejects an overlapping booking for the same staff member')`.
7. **Deploy early.** M0 ends with a live backend and frontend URL; every later module is deployed when merged.
8. **Write the doc line when you write the code.** Each module adds its endpoints to the API doc and its screens to the user guide.

## Business rules (each is owned by one module and tested by name)
| Rule | Statement | Owner |
|---|---|---|
| **R1** | Two appointments for the same staff member never overlap (`newStart < existingEnd AND newEnd > existingStart`); back-to-back is allowed | M6 |
| **R2** | An appointment must fit inside the business operating hours, use a service the staff member is assigned, and not be in the past | M5 |
| **R3** | A service with future appointments is deactivated, never deleted | M3 |
| **R4** | Token numbers are sequential per business per day and unique, even under simultaneous requests | M8 |
| **R5** | Queue transitions allowed: waiting→called→in-service→completed, waiting→cancelled, called→no-show; everything else is rejected (400) | M9 |
| **R6** | Access by role: customers see their own data, staff their own schedule, admins their own business; otherwise 401/403 | M1 |
| **R7** | A failed email never blocks or rolls back a booking or cancellation | M12 |
| **R8** | Position and estimated wait are recalculated after every queue change | M10 |

## Modules
Every module is a vertical slice: backend API, frontend UI, tests, Postman folder.

| # | Module | Backend | Frontend | Tests | Rules | Depends on |
|---|---|---|---|---|---|---|
| **M0** | Setup & Foundation (3 parallel parts: A repo + frontend shell, B backend + DB, C conventions + tooling) | Express structure, Atlas connection, `.env`, central error handler, CORS, logging | Vite app, routing, layout shell, shared components (button, form, modal, toast, table) | Jest, Supertest, RTL, Postman workspace set up; live `/health` | – | – |
| **M1** | Authentication & Role-Based Authorization | User model, register/login (bcrypt), JWT middleware, `authorize(...roles)`, ownership helper | Login/register with validation, auth context, protected routes, role-based nav, 403 page, auto-logout on expiry | Valid/invalid login, duplicate email, missing/expired/tampered tokens, 403 matrix | **R6** | M0 |
| **M2** | Business Profile & Operating Hours | Business model, create/read/update, hours validation (open before close, no overlaps) | Profile screen, weekday hours editor with closed toggle | Hours validation, invalid inputs, non-admin updates rejected | – | M1 |
| **M3** | Service Management | Service model, CRUD + deactivate, duration/price validation | Service create/edit, active toggle, delete confirmation | Zero/negative duration and price, unauthorized ops, deactivated service hidden | **R3** | M2 |
| **M4** | Staff Management & Service Assignment | StaffProfile model, staff APIs, assignment validation (no cross-business) | Staff screens, multi-select service assignment, deactivate action | Valid and cross-business assignment, unauthorized ops; **seed data** (1 business, 5 services, 3 staff) shared | – | M1, M3 |
| **M5** | Appointment Booking | Appointment model + `(staffId, date, startTime)` index, create API, endTime from duration | Service → staff (with "any available") → time → confirmation summary; loading/success/error states | Success, missing fields, past dates, invalid IDs, staff not assigned, outside hours | **R2** | M3, M4 |
| **M6** | Availability & Conflict Prevention | `GET /availability`, overlap check, re-check on save + DB safeguard, exclude cancelled and past | Date picker + slot grid, "slot just taken" message | Same slot, partial overlap, back-to-back, closed day, staff off, two simultaneous requests give one booking | **R1** | M5 |
| **M7** | Appointment Management | View/reschedule/cancel APIs, history API, status transitions, re-run availability on reschedule | Upcoming/past views, reschedule flow reusing slot picker, cancel confirmation, history filters | Reschedule to free/taken slot, double cancel, other user's appointment | – | M5, M6 |
| **M8** | Walk-in Registration & Token Generation | QueueToken model, atomic per-day counter, unique `(businessId, queueDate, tokenNumber)` | Walk-in form, token number display | Sequential numbers, daily reset, simultaneous requests, invalid input | **R4** | M3, M4 |
| **M9** | Queue Dashboard & Status Management | Queue retrieval (sorted, filter by status), status update, transition rules | Dashboard with Call/Start/Complete/No-show/Cancel, invalid buttons disabled, refresh | Full progression, invalid transitions (400), customer changing status (403) | **R5** | M8 |
| **M10** | Queue Position & Waiting-Time Estimation | Position calc, wait estimate (services ahead + remaining current time, shared across active staff), recalculation endpoint | Position and wait on tracking view and dashboard, refresh every 10–30 s | Update after each change, empty queue = 0, varying staff count, after cancellation | **R8** | M9 |
| **M11** | Business Dashboard | Aggregation over Appointment and QueueToken, scoped to the admin's business | Summary cards, today's schedule, empty/error states | Numbers match seeded day, change after booking/completion, empty day = zeros, unauthorized | – | M7, M9 |
| **M12** | Email Notifications | One email-service module, confirmation and cancellation templates, triggers from M5/M7, failures logged | In-app message showing email sent/failed | Provider down, invalid recipient, mock provider, booking still succeeds | **R7** | M5, M7 |
| **M13** | Integration, Deployment, Documentation & Demo (3 parallel parts: A integration + Postman, B GitHub + deploy, C docs + demo) | Combined Postman collection, contract fixes, prod env vars + CORS | Smoke test of every module on live URLs | Regression of auth and roles, full demo flow | All | All |

### M13 parts
- **A, Integration and testing:** join modules, one Postman collection with a folder per module (positive, negative, authorization), verify frontend, backend and database together, fix contract mismatches.
- **B, GitHub and deployment:** final review of `develop`, merge to `main`, release tag, deploy backend (Render/Railway), frontend (Vercel/Netlify), MongoDB Atlas, smoke test.
- **C, Documentation and demo:** README and setup guide, API docs (Postman export or Swagger), ER diagram, user guide for customers/staff/admins, demo script, slides, two rehearsals.

## Dependency graph
```
M0 ─► M1 ─┬─► M2 ─► M3 ─┬─► M4* ─┬─► M5 ─► M6 ─► M7 ─┬─► M11 ─┐
          │             │        │                    │        │
          │             │        │                    └─► M12 ─┤
          │             │        └─► M8 ─► M9 ─► M10 ─────────┤
          │             └──────────────────▲                  ├─► M13
          └─────────────────────────────────────────────────────┘
* M4 needs M1 and M3
M11 needs M7 + M9 · M12 needs M5 + M7 · M13 needs everything
```

**Parallel opportunities** (two or three people can work at once):
- After M3: **M4** can start; after M4: **M5 and M8 run in parallel** (booking track vs queue track).
- Booking track: M5 → M6 → M7. Queue track: M8 → M9 → M10. The two tracks are independent until M11.
- **M12** can start once M5 and M7 contracts exist; **M11** once M7 and M9 exist.

## Timeline (8 weeks, up to 3 modules in progress)
| Week | Pick up | Milestone |
|---|---|---|
| 1 | M0 (three parts) | Skeleton runs for everyone; ER diagram and API contract agreed; live `/health` |
| 2 | M1, M2, M3 | Login with roles; business profile and services managed |
| 3 | M4, M5, M8 | Staff done; booking and walk-in started; **seed data shared** |
| 4 | M5, M6, M8 | Booking with availability checks; token generation working |
| 5 | M7, M9, M10 | Reschedule/cancel; queue dashboard; position and wait |
| 6 | M10, M11, M12 | Business dashboard and emails; **feature freeze** |
| 7 | M13 | Integration, full Postman run, bug fixes, deployment |
| 8 | M13 | Docs, two demo rehearsals, final presentation |

## Decisions to settle in M0 (write answers in the design notes)
1. **Time handling:** store UTC, define the business time zone once, convert only at the UI edge.
2. **Slot granularity:** fixed step (e.g. 15 min) for the availability grid.
3. **Double-booking safeguard:** re-check on save plus a DB-level guard (unique/compound index or transaction); pick one and document it.
4. **Token counter:** atomic `findOneAndUpdate` with `$inc` per (business, day).
5. **"Any available" staff:** how the system picks the staff member (least-loaded or first free).
6. **Wait estimate formula:** how remaining time of the current customer is measured and how it is shared across active staff.
7. **State and styling:** Context vs Redux; Tailwind vs MUI. One choice, recorded.
8. **Email provider** behind a single service module, with a console-log fallback for local runs.
9. **Service deactivation vs deletion** and how existing appointments display a deactivated service.

## Definition of Done (every module)
- [ ] Card moved to Done on the Projects board; PR reviewed by someone else
- [ ] Model, API, screens and tests all finished
- [ ] Rules it owns have tests named `Rn: …`
- [ ] Postman folder added (positive, negative, authorization cases)
- [ ] API doc and user guide lines written
- [ ] Merged to `develop` and deployed

## Final demo flow
1. Admin logs in, sets hours, services, staff (M1–M4)
2. Customer registers, picks service and staff, sees free slots, books, gets a confirmation email (M5, M6, M12)
3. Customer reschedules, then cancels; cancellation email sent (M7, M12)
4. Walk-in registers at the desk and gets a token (M8)
5. Staff call, start and complete the token while position and wait update (M9, M10)
6. Dashboard shows today's appointments, completed services, waiting customers (M11)
7. Error cases: conflicting slot, invalid transition, unauthorized access, email failure

Optional if time allows: Socket.IO real-time queue updates, SMS/WhatsApp reminders, 24-hour reminder email, QR-code walk-in check-in.

## Risks
| Risk | Mitigation |
|---|---|
| Someone waits on a dependency | Merge models and contract first; build against sample data |
| Double booking under simultaneous requests | Re-check on save plus DB safeguard (M6); concurrency test |
| Duplicate queue tokens | Atomic counter plus unique index (M8) |
| Email outage or quota | One module, log failures, never block (M12) |
| Two people start the same module | Mark "In progress" on the board first |
| Scope creep | Feature freeze end of Week 6; extras only after core flows pass |
