-- Caerus demo seed data
-- Source of truth: docs/database-schema.md §8

-- Passwords are 'password123' hashed with bcrypt (cost 10).
-- Generate real hashes with: node -e "console.log(require('bcryptjs').hashSync('password123', 10))"
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin',        'admin@caerus.local', '$2a$10$9d/Q6IQdMQQeYdg5OONiOu7k4fSROTod0v3S0bwm7dIRSVO5HNod.', 'admin'),
  ('Nguyen Van A', 'a@example.com',      '$2a$10$9d/Q6IQdMQQeYdg5OONiOu7k4fSROTod0v3S0bwm7dIRSVO5HNod.', 'customer');

-- starts_at is written with an explicit +07 offset so the stored instant is the
-- intended Vietnam showtime (e.g. 19:30 local = 12:30 UTC), NOT 19:30 UTC.
-- The column is TIMESTAMPTZ, so Postgres normalizes these to UTC on insert.
INSERT INTO events (title, description, starts_at, duration_minutes, auditorium, price) VALUES
  ('Inside Out 2',   'Animated feature.',       '2026-08-30 19:30+07',  96, 'Room 1',  90000),
  ('Dune: Part Two', 'Sci-fi epic.',            '2026-08-30 21:00+07', 166, 'Room 2', 120000),
  ('The Old Guard',  'Action.',                 '2026-08-31 18:00+07', 125, 'Room 1',  90000);

-- Seat maps for every seeded event (6 rows x 10 seats):
INSERT INTO seats (event_id, seat_row, seat_number)
SELECT e.id, chr(64 + r), n
FROM events e,
     generate_series(1, 6)  AS r,
     generate_series(1, 10) AS n;
