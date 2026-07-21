// Business logic for bookings.
// getMyBookings() powers GET /bookings (api-spec §3.4, query in schema doc §6.3).
// TODO: create() must run the atomic SELECT ... FOR UPDATE transaction in
// docs/database-schema.md §5.1. cancel() must run the transaction in §5.2.
// Both are the critical correctness paths of this project — do not
// shortcut the row locking.

const pool = require('../config/db');

async function create({ userId, eventId, seatIds }) {
  throw new Error('bookings.service#create not implemented yet');
}

async function getMyBookings(userId) {
  // 1. This user's bookings, newest first — joined to events for title/startsAt
  //    (schema doc §6.3, verbatim). userId comes from the JWT, never the request body.
  const bookingsResult = await pool.query(
    `SELECT b.id, b.user_id, b.event_id, b.total_price, b.status, b.created_at,
            e.title AS event_title, e.starts_at
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  const bookingRows = bookingsResult.rows;

  // No bookings → empty array (still 200, not 404).
  if (bookingRows.length === 0) {
    return [];
  }

  // 2. All seats for those bookings in ONE query (schema doc §6.3), mapping the
  //    DB's seat_row/seat_number to the API's row/number (naming convention §2).
  const bookingIds = bookingRows.map((b) => b.id);
  const seatsResult = await pool.query(
    `SELECT bs.booking_id, s.id, s.seat_row, s.seat_number
     FROM booking_seats bs
     JOIN seats s ON s.id = bs.seat_id
     WHERE bs.booking_id = ANY($1)
     ORDER BY s.seat_row, s.seat_number`,
    [bookingIds]
  );

  // Group seats under their booking_id.
  const seatsByBooking = new Map();
  for (const s of seatsResult.rows) {
    if (!seatsByBooking.has(s.booking_id)) {
      seatsByBooking.set(s.booking_id, []);
    }
    seatsByBooking.get(s.booking_id).push({
      id: s.id,
      row: s.seat_row,
      number: s.seat_number,
    });
  }

  // 3. Assemble each booking into the API shape (snake_case → camelCase).
  //    starts_at / created_at are Date objects; res.json serializes them to ISO 8601.
  return bookingRows.map((b) => ({
    id: b.id,
    userId: b.user_id,
    eventId: b.event_id,
    eventTitle: b.event_title,
    startsAt: b.starts_at,
    seats: seatsByBooking.get(b.id) || [],
    totalPrice: b.total_price,
    status: b.status,
    createdAt: b.created_at,
  }));
}

async function getById(id, requestingUser) {
  throw new Error('bookings.service#getById not implemented yet');
}

async function cancel(id, requestingUser) {
  throw new Error('bookings.service#cancel not implemented yet');
}

module.exports = { create, getMyBookings, getById, cancel };
