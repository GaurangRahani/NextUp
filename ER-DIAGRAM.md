# NextUp — Entity Relationship Diagram

```
┌──────────────────┐         ┌──────────────────────┐         ┌──────────────────┐
│      User        │         │     Appointment       │         │     Service      │
│──────────────────│         │──────────────────────│         │──────────────────│
│ _id              │1       *│ _id                  │*       1│ _id              │
│ name             │─────────│ customerId (ref User) │─────────│ businessId       │
│ email (unique)   │         │ staffId (ref User)    │         │ name             │
│ password (hashed)│         │ serviceId (ref Svc)   │         │ description      │
│ role             │         │ businessId (ref Biz)  │         │ duration (min)   │
│   customer       │         │ date (UTC Date)       │         │ price            │
│   staff          │         │ startTime (HH:MM UTC) │         │ isActive         │
│   admin          │         │ endTime (HH:MM UTC)   │         └──────────────────┘
│ businessId       │         │ status                │
│   (null for      │         │   scheduled           │         ┌──────────────────┐
│    customers)    │         │   completed           │         │  StaffProfile    │
└──────────────────┘         │   cancelled           │         │──────────────────│
                             │   no-show             │         │ _id              │
                             └──────────────────────┘         │ userId (ref User)│
                                                               │ businessId       │
┌──────────────────┐         ┌──────────────────────┐         │ serviceIds[]     │
│    Business      │         │     QueueToken        │         │ isActive         │
│──────────────────│         │──────────────────────│         └──────────────────┘
│ _id              │1       *│ _id                  │
│ name             │─────────│ businessId           │         ┌──────────────────┐
│ timezone         │         │ customerId (ref User) │         │  DailyCounter    │
│   (IANA string)  │         │ serviceId (ref Svc)  │         │──────────────────│
│ address          │         │ tokenNumber (int)    │         │ _id              │
│ phone            │         │ queueDate (Date UTC) │         │ businessId       │
│ operatingHours   │         │ status               │         │ date (UTC Date)  │
│   (array of      │         │   waiting            │         │ count (int)      │
│    day/open/close│         │   called             │         │ [unique index:   │
│    /isClosed)    │         │   in-service         │         │  businessId+date]│
└──────────────────┘         │   completed          │         └──────────────────┘
                             │   cancelled          │
                             │   no-show            │
                             └──────────────────────┘

Indexes:
  Appointment: { staffId, date, startTime } UNIQUE  ← double-booking safeguard (D3)
  QueueToken:  { businessId, queueDate, tokenNumber } UNIQUE  ← token uniqueness (D4)
  DailyCounter: { businessId, date } UNIQUE  ← atomic counter key (D4)
  User: { email } UNIQUE
```

## Status Transitions (R5)
```
waiting ──► called ──► in-service ──► completed
waiting ──► cancelled
called  ──► no-show
(all other transitions → 400)
```
