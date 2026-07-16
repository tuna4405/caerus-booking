-- Caerus initial schema
-- Source of truth: docs/database-schema.md §3
-- Order is FK-safe: users -> events -> seats -> bookings -> booking_seats

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE booking_seats (
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id    INTEGER NOT NULL REFERENCES seats(id),
    PRIMARY KEY (booking_id, seat_id)
);

CREATE INDEX idx_booking_seats_seat ON booking_seats (seat_id);
