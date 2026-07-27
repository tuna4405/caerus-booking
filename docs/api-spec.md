# Caerus — API Specification v1.0

**Project:** Caerus cinema seat booking website
**Authors:** Tai & Tuan
**Date:** July 15, 2026
**Status:** Draft — becomes the shared contract once both teammates approve

---

## 1. Overview

This document defines every HTTP endpoint the Caerus backend exposes. It is the contract between:

- **Backend (Tai):** Express API on EC2 + PostgreSQL on RDS must implement these endpoints exactly as written.
- **Frontend (Tuan):** React app on S3 codes against these shapes, first with mock data, then with the real API.
- **Serverless (Week 3):** "Cancel booking" and "Generate ticket" will later move to Lambda behind API Gateway, but their request/response shapes stay identical — the frontend should not notice the switch.

**Rule:** Nobody changes this spec unilaterally. If something must change, both teammates agree and the doc is updated first.

---

## 2. Conventions

### 2.1 Base URLs

| Environment | Base URL |
|---|---|
| Local development | `http://localhost:3000/api/v1` |
| Production (EC2) | `http://<ec2-public-dns>:3000/api/v1` (later behind proper domain) |
| Lambda routes (Week 3) | `https://<api-gateway-id>.execute-api.ap-southeast-1.amazonaws.com/prod` |

All endpoint paths below are relative to the base URL.

### 2.2 Format

- All request and response bodies are **JSON** (`Content-Type: application/json`).
- All timestamps are **ISO 8601 UTC**, e.g. `"2026-07-20T13:30:00Z"`.
- Timestamps are **transmitted in UTC** (the `Z` above) but **represent showtimes in the cinema's timezone, `Asia/Ho_Chi_Minh` (UTC+7)**. Storage and the wire format stay UTC; only interpretation and display convert to local time. Clients should render times in UTC+7, not the viewer's browser zone. Consequently the `?date` query parameter on `GET /events` is interpreted as a **Vietnam calendar date** (UTC+7), not a UTC date — see §3.2.
- All IDs are integers (PostgreSQL `SERIAL`). Keep it simple; UUIDs are optional polish later.
- All prices are integers in **VND** (no decimals), e.g. `90000` = 90,000₫.

### 2.3 Authentication

- Auth uses **JWT (JSON Web Token)** issued at login.
- The frontend stores the token and sends it on protected endpoints in a header:

```
Authorization: Bearer <token>
```

- Endpoints marked 🔒 require a valid token. Endpoints marked 🔒👑 require an admin user.
- Missing/invalid token → `401 Unauthorized`. Valid token but insufficient role → `403 Forbidden`.

### 2.4 Standard error format

Every error response, from every endpoint, uses this exact shape:

```json
{
  "error": {
    "code": "SEAT_ALREADY_BOOKED",
    "message": "One or more selected seats have just been booked by another user."
  }
}
```

- `code`: stable machine-readable string in `SCREAMING_SNAKE_CASE`. The frontend switches on this, never on `message`.
- `message`: human-readable English, safe to show to users.

**Error codes used in v1:**

| Code | Typical HTTP status |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `SEAT_ALREADY_BOOKED` | 409 |
| `BOOKING_NOT_CANCELLABLE` | 409 |
| `EMAIL_ALREADY_EXISTS` | 409 |
| `INTERNAL_ERROR` | 500 |

### 2.5 Status codes cheat sheet

| Code | Meaning | When we use it |
|---|---|---|
| 200 | OK | Successful read or update |
| 201 | Created | New resource created (register, booking) |
| 204 | No Content | Successful delete/cancel with nothing to return |
| 400 | Bad Request | Body fails validation (missing field, wrong type) |
| 401 | Unauthorized | No token / bad token |
| 403 | Forbidden | Logged in but not allowed (e.g. non-admin creating event) |
| 404 | Not Found | ID doesn't exist |
| 409 | Conflict | Business rule violated (seat taken, duplicate email) |
| 500 | Internal Server Error | Bug or infrastructure failure |

---

## 3. Endpoints

### 3.1 Auth

#### POST /auth/register

Create a user account.

**Request body:**
```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "password": "atLeast8Chars"
}
```

**Responses:**
- `201 Created`
```json
{
  "user": { "id": 12, "name": "Nguyen Van A", "email": "a@example.com", "role": "customer" },
  "token": "eyJhbGciOi..."
}
```
- `400` `VALIDATION_ERROR` — missing field, invalid email, password < 8 chars
- `409` `EMAIL_ALREADY_EXISTS`

#### POST /auth/login

**Request body:**
```json
{ "email": "a@example.com", "password": "atLeast8Chars" }
```

**Responses:**
- `200 OK` — same shape as register response
- `401` `UNAUTHORIZED` — wrong email or password (do NOT reveal which one)

---

### 3.2 Events (movie screenings)

An "event" = one screening of one movie in one auditorium at one time.

#### GET /events

List upcoming events. Public, no auth.

**Query parameters (all optional):**

| Param | Type | Example | Meaning |
|---|---|---|---|
| `date` | string | `2026-07-25` | Only events on this date, interpreted as a **Vietnam calendar date** (`Asia/Ho_Chi_Minh`, UTC+7) — not a UTC date (see §2.2) |
| `page` | int | `1` | Page number, default 1 |
| `limit` | int | `20` | Page size, default 20, max 50 |

**Response `200 OK`:**
```json
{
  "events": [
    {
      "id": 3,
      "title": "Inside Out 2",
      "description": "Animated feature.",
      "startsAt": "2026-07-25T19:30:00Z",
      "durationMinutes": 96,
      "auditorium": "Room 1",
      "price": 90000,
      "bannerUrl": "https://caerus-images.s3.amazonaws.com/events/3/banner.jpg",
      "totalSeats": 60,
      "availableSeats": 42
    }
  ],
  "pagination": { "page": 1, "limit": 20, "totalItems": 5, "totalPages": 1 }
}
```

**Note on `bannerUrl`:** the URL of the event's **poster** — a portrait image at a 2:3 aspect ratio (e.g. 400×600), rendered as the poster on event cards and the event detail page. The field name is historical (it holds a poster, not a landscape banner). It remains **nullable**, since an event exists before its image is uploaded.

#### GET /events/:id

One event's details. Public. Same object shape as one item in the list above.

- `200 OK`
- `404` `NOT_FOUND`

#### POST /events 🔒👑

Admin creates an event.

**Request body:**
```json
{
  "title": "Inside Out 2",
  "description": "Animated feature.",
  "startsAt": "2026-07-25T19:30:00Z",
  "durationMinutes": 96,
  "auditorium": "Room 1",
  "price": 90000
}
```

- `201 Created` — returns the full event object (seats are auto-generated from the auditorium layout)
- `400` `VALIDATION_ERROR`, `401`, `403`

#### POST /events/:id/banner 🔒👑

Admin uploads a banner image. `Content-Type: multipart/form-data`, field name `image` (jpg/png, max 5 MB). Backend stores it in the S3 images bucket.

The image should be a **portrait 2:3 poster** (e.g. 400×600; jpg/png, max 5 MB as above). Images with a materially different aspect ratio are centre-cropped to 2:3 by the frontend, so a landscape upload will have its sides cut off. Server-side aspect-ratio validation is **optional polish** for the AWS phase when this endpoint is built — a suggestion, not a committed requirement.

- `200 OK` → `{ "bannerUrl": "https://..." }`
- `400` `VALIDATION_ERROR` (wrong type / too big), `401`, `403`, `404`

---

### 3.3 Seats

#### GET /events/:id/seats

The seat map for one event. Public. The frontend polls or refetches this before booking.

**Response `200 OK`:**
```json
{
  "eventId": 3,
  "seats": [
    { "id": 101, "row": "A", "number": 1, "status": "available" },
    { "id": 102, "row": "A", "number": 2, "status": "booked" }
  ]
}
```

`status` is one of: `"available"` | `"booked"`.
(If we add a temporary hold feature later, `"held"` becomes a third value — v2, not now.)

- `404` `NOT_FOUND` — event doesn't exist

---

### 3.4 Bookings

#### POST /bookings 🔒

Create a booking for 1–6 seats in a single event. **This is the critical endpoint** — it must be atomic: either all requested seats are booked, or none are.

Backend implementation note (Tai): open a transaction, `SELECT ... FOR UPDATE` the seat rows, verify all are still available, insert booking + booking_seats, commit. Any seat unavailable → rollback and return 409.

**Request body:**
```json
{ "eventId": 3, "seatIds": [101, 103, 104] }
```

**Responses:**
- `201 Created`
```json
{
  "booking": {
    "id": 55,
    "userId": 12,
    "eventId": 3,
    "eventTitle": "Inside Out 2",
    "startsAt": "2026-07-25T19:30:00Z",
    "seats": [
      { "id": 101, "row": "A", "number": 1 },
      { "id": 103, "row": "A", "number": 3 },
      { "id": 104, "row": "A", "number": 4 }
    ],
    "totalPrice": 270000,
    "status": "confirmed",
    "createdAt": "2026-07-15T09:12:00Z"
  }
}
```
- `400` `VALIDATION_ERROR` — empty seatIds, more than 6 seats, seats not in that event
- `401` `UNAUTHORIZED`
- `404` `NOT_FOUND` — event doesn't exist
- `409` `SEAT_ALREADY_BOOKED` — response also lists the conflicting seats so the UI can highlight them:
```json
{
  "error": {
    "code": "SEAT_ALREADY_BOOKED",
    "message": "One or more selected seats have just been booked by another user.",
    "conflictingSeatIds": [103]
  }
}
```

#### GET /bookings 🔒

The logged-in user's own bookings ("My bookings" page). Newest first.

**Response `200 OK`:**
```json
{ "bookings": [ { "...same booking object as above..." : "..." } ] }
```

#### GET /bookings/:id 🔒

One booking. Users may only read their own; admin may read any.

- `200 OK`, `401`, `403` (someone else's booking), `404`

#### DELETE /bookings/:id 🔒

Cancel a booking. Frees the seats (status back to `available`).

**Business rule:** cancellable any time **before** `startsAt` (no cutoff buffer). Once the show has started, the booking can no longer be cancelled.

- `204 No Content` — cancelled
- `401`, `403`, `404`
- `409` `BOOKING_NOT_CANCELLABLE` — show has already started, or booking already cancelled

---

### 3.5 Tickets (Week 3 — Lambda)

#### POST /bookings/:id/ticket 🔒

Generate a PDF ticket for a confirmed booking. Implemented as a Lambda: it renders the PDF, saves it to the S3 tickets bucket, and returns a temporary (pre-signed) download URL.

**Response `200 OK`:**
```json
{
  "ticketUrl": "https://caerus-tickets.s3.amazonaws.com/tickets/55.pdf?X-Amz-Signature=...",
  "expiresAt": "2026-07-15T10:12:00Z"
}
```

- `401`, `403`, `404`
- `409` `BOOKING_NOT_CANCELLABLE` reused? No — use `404` if booking is cancelled (a cancelled booking has no ticket).

---

## 4. Endpoint summary table

| Method | Path | Auth | Purpose | Owner (compute) |
|---|---|---|---|---|
| POST | /auth/register | — | Create account | EC2 Express |
| POST | /auth/login | — | Get JWT | EC2 Express |
| GET | /events | — | List screenings | EC2 Express |
| GET | /events/:id | — | Screening detail | EC2 Express |
| POST | /events | 🔒👑 | Create screening | EC2 Express |
| POST | /events/:id/banner | 🔒👑 | Upload banner to S3 | EC2 Express |
| GET | /events/:id/seats | — | Seat map | EC2 Express |
| POST | /bookings | 🔒 | Book seats (atomic) | EC2 Express |
| GET | /bookings | 🔒 | My bookings | EC2 Express |
| GET | /bookings/:id | 🔒 | Booking detail | EC2 Express |
| DELETE | /bookings/:id | 🔒 | Cancel booking | EC2 Express |
| POST | /bookings/:id/ticket | 🔒 | Generate PDF ticket | Lambda (Week 3) |

---

## 5. Mock data contract (for Tuan, Days 3–5)

Until integration day, the frontend uses hard-coded mocks **shaped exactly like the responses above**. Suggested files:

```
src/mocks/events.json      // shape of GET /events response
src/mocks/seats.json       // shape of GET /events/3/seats response
src/mocks/bookings.json    // shape of GET /bookings response
```

Wrap all API calls in one module (e.g. `src/api/client.js`) so that on integration day you only change the base URL and delete the mock layer — not every component.

## 6. CORS note (for integration + deployment)

The S3-hosted frontend and the EC2 API live on different origins, so the browser will block requests unless the API sends CORS headers. Tai: add the `cors` middleware in Express and allow the S3 website origin (and `http://localhost:5173` for local dev). Expect to revisit this on Days 11–12.

## 7. Change log

| Date | Change | Agreed by |
|---|---|---|
| 2026-07-15 | Initial version | Tai ☐ Tuan ☐ |
| 2026-07-15 | Confirmed max 6 seats per booking; removed 1-hour cancellation cutoff — bookings now cancellable any time before showtime | Tai ☐ Tuan ☐ |
| 2026-07-23 | Timestamps now represent showtimes in the cinema timezone `Asia/Ho_Chi_Minh` (UTC+7): wire format stays UTC, but `GET /events?date` filters by the Vietnam calendar date and clients display times in UTC+7 (§2.2, §3.2) | Tai ☐ Tuan ☐ |
| 2026-07-23 | `bannerUrl` documented as a portrait 2:3 **poster** rather than a landscape banner — one image per event, field name unchanged (§3.2) | Tai ☐ Tuan ☐ |
| 2026-07-28 | `DELETE /bookings/:id is now in EC2 instead of Lambda function (§3.4) | Tai ☐ Tuan ☐ |