# Caerus — Database Schema v1.0

**Project:** Caerus cinema seat booking website
**Authors:** Tai & Tuan
**Date:** July 16, 2026
**Status:** Draft — becomes the shared contract once both teammates approve (pairs with API Specification v1.0)

---

## 1. Overview

This document defines the PostgreSQL schema behind the Caerus API. It is the twin of `api-spec.md`: every response shape in that document maps onto these five tables. Backend (Tai) implements against this schema; frontend (Tuan) never touches the database directly, but the mock data must stay consistent with what these tables can actually produce.

**Rule (same as the API spec):** nobody changes this schema unilaterally. If something must change, both teammates agree and this doc is updated first, then a new migration file is written.

### 1.1 Entity-relationship diagram

The ERD is maintained as a standalone image (same visual language as the architecture diagram — crow's foot = "many" side, perpendicular dash = "one" side):

![Caerus entity-relationship diagram](./erd.png)

**Diagram file:** `erd.png` — keep it in the same folder as this document (e.g. `docs/`), and drop a copy into the shared "report evidence" folder in Week 3; it goes straight into the report's database-design section.

Reading the diagram in one paragraph: five tables total. `events` is the hub — one screening owns its 60 `seats` and is referenced by its `bookings`. `users` make `bookings`, and `booking_seats` is the pure join table resolving the many-to-many between bookings and seats. All five relationships are solid lines because **every foreign key in Caerus is `NOT NULL`** — the nullable columns (`banner_url`, `cancelled_at`) are plain attributes, not relationships.

| Relationship | Cardinality | Meaning |
|---|---|---|
| `events` → `seats` | 1 – many | a screening has 60 seats (6×10, auto-generated) |
| `events` → `bookings` | 1 – many | a screening is booked many times |
| `users` → `bookings` | 1 – many | a user makes many bookings |
| `bookings` → `booking_seats` | 1 – many (1–6) | a booking covers 1–6 seats |
| `seats` → `booking_seats` | 1 – many | a seat appears in many bookings over time (booked → cancelled → rebooked) |

---

## 2. Conventions

| Concern | Decision |
|---|---|
| Naming | `snake_case` in the database, `camelCase` in JSON. The Express layer maps between them (e.g. `seat_row` → `row`, `starts_at` → `startsAt`). |
| Primary keys | `SERIAL` integers, matching the API spec ("All IDs are integers"). |
| Timestamps | `TIMESTAMPTZ`, always stored in UTC. Serialized as ISO 8601 (`2026-07-25T19:30:00Z`). |
| Money | `INTEGER` in VND — no floats, no decimals, ever. `90000` = 90,000₫. |
| Enum-like fields | `TEXT` + `CHECK` constraint rather than PostgreSQL `ENUM` types. Same safety, but far easier to alter later (adding a `"held"` seat status in v2 is one `ALTER TABLE`, not an enum migration). |
| Deletes | We never hard-delete bookings (cancellation is a status change, so history survives). `ON DELETE CASCADE` only where a child is meaningless without its parent (seats without their event, booking_seats without their booking). |

⚠️ **Naming gotcha:** `row` is a reserved keyword in PostgreSQL. We deliberately name the columns `seat_row` and `seat_number` in the database, and map them to `row` / `number` in the API JSON. Do not "simplify" this back to `row` — you will spend an evening quoting identifiers.

---

## 3. Tables

### 3.1 `users`

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Notes |
|---|---|
| `email` | `UNIQUE` — the database itself enforces `EMAIL_ALREADY_EXISTS` (409). Catch the unique-violation error (`23505`) in Express and translate it. Normalize to lowercase before insert. |
| `password_hash` | bcrypt hash (use `bcryptjs`, cost 10). Plaintext passwords never touch the database. |
| `role` | `customer` or `admin`, powering 🔒 vs 🔒👑 endpoints. The role goes into the JWT payload so most requests don't need a user lookup. |

There is no sessions table: auth is stateless JWT (per API spec §2.3), so the token itself is the session.

### 3.2 `events`

One row = one screening of one movie in one auditorium at one time.

```sql
CREATE TABLE events (
    id               SERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    starts_at        TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    auditorium       TEXT NOT NULL,
    price            INTEGER NOT NULL CHECK (price >= 0),
    banner_url       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_starts_at ON events (starts_at);
```

| Column | Notes |
|---|---|
| `price` | Price per seat in VND. `totalPrice` on a booking = `price × seat count`, computed and stored at booking time (see §3.4). |
| `banner_url` | Nullable — an event exists before its banner is uploaded. Set by `POST /events/:id/banner` after the S3 upload succeeds. |
| `idx_events_starts_at` | Supports `GET /events?date=...` filtering and the default "upcoming, soonest first" ordering. |

The API fields `totalSeats` and `availableSeats` are **not columns** — they are computed from the `seats` table at query time (see §6.1). Storing counters invites drift; counting rows is trivially cheap at this scale (60 seats/event).

### 3.3 `seats`

```sql
CREATE TABLE seats (
    id          SERIAL PRIMARY KEY,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    seat_row    TEXT NOT NULL,
    seat_number INTEGER NOT NULL CHECK (seat_number > 0),
    status      TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'booked')),
    UNIQUE (event_id, seat_row, seat_number)
);

CREATE INDEX idx_seats_event_id ON seats (event_id);
```

| Column | Notes |
|---|---|
| `event_id` | Seats belong to a **screening**, not to a physical room. `ON DELETE CASCADE`: delete an event, its seat map goes with it. |
| `status` | The heart of the concurrency story. These are the rows we `SELECT ... FOR UPDATE` in the booking transaction (§5.1). v2's `"held"` status slots in here with one `ALTER TABLE ... DROP/ADD CONSTRAINT`. |
| `UNIQUE (event_id, seat_row, seat_number)` | No duplicate "A1" within one screening, guaranteed by the database. |

**Seat generation.** When an admin creates an event, the backend auto-generates the seat map inside the same transaction. Layout for v1 is fixed in application code: **6 rows (A–F) × 10 seats = 60 seats**, matching `totalSeats: 60` in the API spec. One statement does it all:

```sql
INSERT INTO seats (event_id, seat_row, seat_number)
SELECT $1, chr(64 + r), n
FROM generate_series(1, 6) AS r,
     generate_series(1, 10) AS n;
```

(`chr(65)` = 'A'.) A configurable `auditoriums` table with per-room layouts is deliberate scope-cut — optional polish if Week 3 finishes early, and worth a sentence in the report either way.

### 3.4 `bookings`

```sql
CREATE TABLE bookings (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    event_id     INTEGER NOT NULL REFERENCES events(id),
    total_price  INTEGER NOT NULL CHECK (total_price >= 0),
    status       TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'cancelled')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_bookings_user  ON bookings (user_id, created_at DESC);
CREATE INDEX idx_bookings_event ON bookings (event_id);
```

| Column | Notes |
|---|---|
| `total_price` | Snapshotted at booking time. If an admin later changes the event's price, existing bookings keep the price the customer actually paid. |
| `status` | `DELETE /bookings/:id` flips this to `cancelled` and frees the seats — it does **not** delete the row. History stays intact for the "My bookings" page and the report. |
| `cancelled_at` | Null until cancelled. Nice evidence for the report's CloudWatch/testing sections. |
| `idx_bookings_user` | Exactly matches `GET /bookings` — this user's bookings, newest first. |

### 3.5 `booking_seats`

```sql
CREATE TABLE booking_seats (
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id    INTEGER NOT NULL REFERENCES seats(id),
    PRIMARY KEY (booking_id, seat_id)
);

CREATE INDEX idx_booking_seats_seat ON booking_seats (seat_id);
```

Resolves the many-to-many: one booking covers 1–6 seats; over time one seat can appear in several bookings (booked → cancelled → rebooked by someone else). The composite primary key doubles as "no seat twice in the same booking." The 1–6 seat limit is validated in Express (`VALIDATION_ERROR`, 400), not in the database.

---

## 4. Key design decisions (agree on these explicitly)

These are the choices worth a checkbox from both of you — and each is a ready-made paragraph for the report's design section.

**Decision 1 — seat `status` column instead of deriving availability from bookings.** We could compute "booked" as "a confirmed booking references this seat." That is more normalized, but it makes the critical section awkward: you'd be locking against the *absence* of a row. Storing `status` on the seat gives us a concrete row to `SELECT ... FOR UPDATE`, which is precisely the technique the project plan calls for. Trade-off: it is denormalized state, so the booking and cancellation transactions must always update `seats.status` and `booking_seats` together — which they do, because they are transactions (§5).

**Decision 2 — seats belong to events, not to auditoriums.** Physically, Room 1's seat A1 is one chair; logically, its availability differs per screening. Modeling seats per-event makes `status` unambiguous and keeps queries trivial, at the cost of 60 near-identical rows per event. At cinema scale that's nothing (1,000 events = 60k rows).

**Decision 3 — `TEXT` + `CHECK` instead of `ENUM` types.** Same integrity guarantee, much friendlier to change (v2's `"held"` status). Postgres enums are annoying to extend inside transactions and to reorder.

**Decision 4 — computed `availableSeats`, snapshotted `total_price`.** Counts are derived live (cheap, can't drift); money is frozen at booking time (an audit fact, must never drift). Knowing which values to derive and which to snapshot is a nice thing to demonstrate you understood.

---

## 5. The two critical transactions

### 5.1 Booking (POST /bookings) — the no-double-booking guarantee

```sql
BEGIN;

-- 1. Lock the requested seat rows. ORDER BY id gives every concurrent
--    transaction the same lock order, which prevents deadlocks.
SELECT id, status
FROM seats
WHERE id = ANY($seatIds) AND event_id = $eventId
ORDER BY id
FOR UPDATE;

-- 2. In Express, verify:
--    - every requested id came back            → else 400 VALIDATION_ERROR
--    - every returned status = 'available'     → else ROLLBACK,
--      409 SEAT_ALREADY_BOOKED + conflictingSeatIds

-- 3. Create the booking (price = event.price × number of seats).
INSERT INTO bookings (user_id, event_id, total_price)
VALUES ($userId, $eventId, $totalPrice)
RETURNING id;

-- 4. Attach the seats.
INSERT INTO booking_seats (booking_id, seat_id)
SELECT $bookingId, unnest($seatIds::int[]);

-- 5. Flip the seats.
UPDATE seats SET status = 'booked' WHERE id = ANY($seatIds);

COMMIT;
```

Why this is safe: two users racing for seat 103 both reach step 1. One transaction acquires the row lock first; the other **blocks** on `FOR UPDATE`. When the winner commits, the loser's SELECT finally returns — and now sees `status = 'booked'`, fails the check in step 2, rolls back, and the API returns 409 with `conflictingSeatIds: [103]`. Either all seats book or none do. This is exactly the scenario your two-person, two-browser test in Week 3 (Aug 1–3) must demonstrate.

Defense in depth (optional but cheap): write step 5 as `UPDATE seats SET status='booked' WHERE id = ANY($seatIds) AND status='available'` and assert the row count equals the seat count — if it ever doesn't, a code path skipped the lock, and you want to know.

### 5.2 Cancellation (DELETE /bookings/:id) — must survive the move to Lambda

```sql
BEGIN;

-- Lock the booking so a double-cancel or a race with ticket
-- generation can't interleave.
SELECT b.id, b.user_id, b.status, e.starts_at
FROM bookings b
JOIN events e ON e.id = b.event_id
WHERE b.id = $bookingId
FOR UPDATE;

-- In code:  not found                          → 404
--           requester isn't owner (or admin)   → 403
--           status <> 'confirmed'
--           OR starts_at <= now()              → 409 BOOKING_NOT_CANCELLABLE

UPDATE bookings
SET status = 'cancelled', cancelled_at = now()
WHERE id = $bookingId;

UPDATE seats
SET status = 'available'
WHERE id IN (SELECT seat_id FROM booking_seats
             WHERE booking_id = $bookingId);

COMMIT;
```

Week 3 note: when this endpoint moves to Lambda, the Lambda talks to the **same RDS database** and runs this **same transaction**. The correctness lives in the SQL, not in Express — which is why the frontend won't notice the switch.

---

## 6. Queries the API needs (reference for Tai)

### 6.1 `GET /events` — list with computed seat counts

```sql
SELECT e.*,
       COUNT(s.id)                                        AS total_seats,
       COUNT(s.id) FILTER (WHERE s.status = 'available')  AS available_seats
FROM events e
LEFT JOIN seats s ON s.event_id = e.id
WHERE e.starts_at >= now()
  AND ($date::date IS NULL OR (e.starts_at AT TIME ZONE 'UTC')::date = $date)
GROUP BY e.id
ORDER BY e.starts_at
LIMIT $limit OFFSET $offset;
```

(Plus a matching `COUNT(*)` over the same `WHERE` for the `pagination` object.)

### 6.2 `GET /events/:id/seats` — the seat map

```sql
SELECT id, seat_row, seat_number, status
FROM seats
WHERE event_id = $eventId
ORDER BY seat_row, seat_number;
```

The `ORDER BY` means the frontend can render rows top-to-bottom without sorting client-side.

### 6.3 `GET /bookings` — "My bookings", newest first

```sql
SELECT b.*, e.title AS event_title, e.starts_at
FROM bookings b
JOIN events e ON e.id = b.event_id
WHERE b.user_id = $userId
ORDER BY b.created_at DESC;
```

Then one query for the seats of those bookings (`WHERE booking_id = ANY(...)` joined to `seats`), assembled in Express into the nested `seats` array the spec promises.

---

## 7. Migrations & local setup (Days 3–5, Tai)

Keep it to plain SQL files, applied in order — no ORM, no migration framework needed at this scale:

```
backend/db/
  migrations/
    001_init.sql      ← every CREATE TABLE / CREATE INDEX in this document
  seed.sql            ← demo data below
```

Dockerized Postgres for local dev:

```yaml
# backend/docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: caerus
      POSTGRES_PASSWORD: caerus_dev   # local only — RDS gets a real secret
      POSTGRES_DB: caerus
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

```bash
docker compose up -d
psql postgresql://caerus:caerus_dev@localhost:5432/caerus -f db/migrations/001_init.sql
psql postgresql://caerus:caerus_dev@localhost:5432/caerus -f db/seed.sql
```

Week 2 (Day 8): the **same two files** run against RDS with a different connection string. That's the whole "migration" story — a deliberately boring one.

---

## 8. Seed data (`seed.sql`)

Enough to demo every feature: one admin, one customer, a few screenings with seats.

```sql
-- Passwords are 'password123' hashed with bcrypt (cost 10).
-- Generate real hashes with: node -e "console.log(require('bcryptjs').hashSync('password123', 10))"
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin',        'admin@caerus.local', '<bcrypt-hash-here>', 'admin'),
  ('Nguyen Van A', 'a@example.com',      '<bcrypt-hash-here>', 'customer');

INSERT INTO events (title, description, starts_at, duration_minutes, auditorium, price) VALUES
  ('Inside Out 2',   'Animated feature.',       '2026-07-25T19:30:00Z',  96, 'Room 1',  90000),
  ('Dune: Part Two', 'Sci-fi epic.',            '2026-07-25T21:00:00Z', 166, 'Room 2', 120000),
  ('The Old Guard',  'Action.',                 '2026-07-26T18:00:00Z', 125, 'Room 1',  90000);

-- Seat maps for every seeded event (6 rows × 10 seats):
INSERT INTO seats (event_id, seat_row, seat_number)
SELECT e.id, chr(64 + r), n
FROM events e,
     generate_series(1, 6)  AS r,
     generate_series(1, 10) AS n;
```

Tip for Tuan: run the seed, hit the real endpoints once Tai has them, and diff against `src/mocks/*.json` — any mismatch found on Day 3 is an integration bug you don't have on Day 6.

---

## 9. Relational vs NoSQL (for the report)

Why PostgreSQL for the core: bookings need **transactional integrity across multiple rows** — a booking, its booking_seats, and several seat status flips must succeed or fail as one unit, under concurrency. That is ACID territory, and §5.1 is the proof. DynamoDB offers transactions too, but row-level locking with `SELECT ... FOR UPDATE` is the natural, teachable fit here.

Where DynamoDB *does* fit (the optional layer from the architecture doc): "recently viewed events" per user — a simple key-value lookup (`userId` → list of event IDs), no joins, no cross-item invariants, high read/write ratio, and losing it costs nothing. One table, `PK = userId`, a list attribute, maybe a TTL. Implementing even just this gives the report an honest, concrete relational-vs-NoSQL comparison instead of a textbook one.

---

## 10. Change log

| Date | Change | Agreed by |
|---|---|---|
| 2026-07-16 | Initial version — 5 tables, fixed 6×10 seat layout, TEXT+CHECK enums, booking & cancellation transactions defined | Tai ☐ Tuan ☐ |
| 2026-07-16 | ERD moved out of the doc into standalone `erd.png` (matches the architecture diagram's visual style); §1.1 now embeds the image + cardinality table | Tai ☐ Tuan ☐ |
