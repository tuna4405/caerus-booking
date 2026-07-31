// Business logic for bookings.
// createBooking() runs the atomic SELECT ... FOR UPDATE transaction (schema §5.1) —
// the no-double-booking guarantee. cancelBooking() runs the reverse transaction
// (§5.2) — free the seats. getMyBookings() powers GET /bookings (§6.3).
// Do not shortcut the row locking in either transaction.

const pool = require('../config/db');
const {
  ValidationError,
  NotFoundError,
  SeatAlreadyBookedError,
  ForbiddenError,
  BookingNotCancellableError,
} = require('../lib/errors');
const s3 = require('../lib/s3');
const { renderTicketPdf } = require('../lib/ticketPdf');

const MAX_INT4 = 2147483647; // PostgreSQL int4 upper bound — reject ids beyond it (no 500).

// A route :id → positive int within int4 range, or null (caller returns 404).
function parseId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const n = Number(value);
  if (n <= 0 || n > MAX_INT4) return null;
  return n;
}

async function createBooking({ userId, eventId, seatIds }) {
  // --- Validation BEFORE opening a transaction (api-spec §3.4) ---
  if (!Number.isInteger(eventId) || eventId <= 0 || eventId > MAX_INT4) {
    throw new ValidationError('eventId must be a positive integer.');
  }
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new ValidationError('seatIds must be a non-empty array.');
  }
  if (seatIds.length > 6) {
    throw new ValidationError('A booking may contain at most 6 seats.');
  }
  if (!seatIds.every((id) => Number.isInteger(id) && id > 0 && id <= MAX_INT4)) {
    throw new ValidationError('seatIds must all be positive integers.');
  }
  // Duplicate ids would double-charge and violate the booking_seats PK — reject clearly.
  if (new Set(seatIds).size !== seatIds.length) {
    throw new ValidationError('seatIds must not contain duplicates.');
  }

  // --- The transaction (schema doc §5.1, implemented exactly) ---
  // One pooled client so BEGIN/COMMIT/ROLLBACK all run on the SAME connection.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the requested seat rows. ORDER BY id gives every concurrent
    //    transaction the SAME lock order → prevents deadlocks. Keep the ORDER BY.
    const locked = await client.query(
      `SELECT id, seat_row, seat_number, status
       FROM seats
       WHERE id = ANY($1) AND event_id = $2
       ORDER BY id
       FOR UPDATE`,
      [seatIds, eventId]
    );

    // 2a. Fewer rows than requested → a seatId isn't a seat of this event. Distinguish
    //     "no such event" (404) from "event exists but a seat id is bogus" (400).
    if (locked.rows.length !== seatIds.length) {
      const eventExists = await client.query('SELECT 1 FROM events WHERE id = $1', [eventId]);
      if (eventExists.rows.length === 0) {
        throw new NotFoundError('Event not found.');
      }
      throw new ValidationError('One or more seatIds are not seats of this event.');
    }

    // 2b. Any locked seat already booked → 409 with the conflicting ids for the UI.
    const conflictingSeatIds = locked.rows
      .filter((s) => s.status !== 'available')
      .map((s) => s.id);
    if (conflictingSeatIds.length > 0) {
      throw new SeatAlreadyBookedError(conflictingSeatIds);
    }

    // 3. Snapshot the event price (schema doc §3.4); grab title/startsAt for the response.
    const eventResult = await client.query(
      'SELECT title, starts_at, price FROM events WHERE id = $1',
      [eventId]
    );
    const event = eventResult.rows[0];
    const totalPrice = event.price * seatIds.length;

    // 4. Create the booking.
    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, event_id, total_price)
       VALUES ($1, $2, $3)
       RETURNING id, status, created_at`,
      [userId, eventId, totalPrice]
    );
    const booking = bookingResult.rows[0];

    // 5. Attach the seats.
    await client.query(
      `INSERT INTO booking_seats (booking_id, seat_id)
       SELECT $1, unnest($2::int[])`,
      [booking.id, seatIds]
    );

    // 6. Flip the seats to booked. Defense in depth (schema doc §5.1): the extra
    //    AND status='available' guard + row-count assert catches any lock bypass.
    const updated = await client.query(
      `UPDATE seats SET status = 'booked'
       WHERE id = ANY($1) AND status = 'available'`,
      [seatIds]
    );
    if (updated.rowCount !== seatIds.length) {
      // Impossible while the FOR UPDATE lock holds — bail loudly rather than commit.
      throw new Error(
        `Seat update affected ${updated.rowCount} rows, expected ${seatIds.length} — lock bypass?`
      );
    }

    await client.query('COMMIT');

    // Assemble the 201 booking object (camelCase, schema doc §2). Seats come from the
    // step-1 rows, ordered row then number to match GET /bookings.
    const seats = locked.rows
      .slice()
      .sort((a, b) =>
        a.seat_row === b.seat_row
          ? a.seat_number - b.seat_number
          : a.seat_row.localeCompare(b.seat_row)
      )
      .map((s) => ({ id: s.id, row: s.seat_row, number: s.seat_number }));

    return {
      id: booking.id,
      userId,
      eventId,
      eventTitle: event.title,
      startsAt: event.starts_at,
      seats,
      totalPrice,
      status: booking.status,
      createdAt: booking.created_at,
    };
  } catch (err) {
    // Any failure: never leave a txn open. Swallow a rollback error so the real
    // error (validation/conflict/etc.) is what propagates to the errorHandler.
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    // Always hand the pooled client back, success or failure.
    client.release();
  }
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

async function getBookingById({ bookingId, userId, userRole }) {
  // Validate the id — non-numeric / out-of-range → 404 (a booking that can't exist),
  // never a 500. Plain read: no transaction needed (unlike create/cancel).
  const id = parseId(bookingId);
  if (id === null) {
    throw new NotFoundError('Booking not found.');
  }

  // 1. The booking, joined to its event for title/startsAt — the SAME SELECT columns
  //    getMyBookings uses, just filtered to one id instead of a whole user's list.
  const bookingResult = await pool.query(
    `SELECT b.id, b.user_id, b.event_id, b.total_price, b.status, b.created_at,
            e.title AS event_title, e.starts_at
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     WHERE b.id = $1`,
    [id]
  );
  const b = bookingResult.rows[0];

  // 2. Ownership (same rule + ordering as cancelBooking): 404 before 403.
  if (!b) {
    throw new NotFoundError('Booking not found.');
  }
  const isOwner = b.user_id === userId;
  const isAdmin = userRole === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have access to this booking.');
  }

  // 3. That booking's seats — the SAME booking_seats→seats query + row/number mapping
  //    getMyBookings uses, narrowed to one booking.
  const seatsResult = await pool.query(
    `SELECT s.id, s.seat_row, s.seat_number
     FROM booking_seats bs
     JOIN seats s ON s.id = bs.seat_id
     WHERE bs.booking_id = $1
     ORDER BY s.seat_row, s.seat_number`,
    [id]
  );
  const seats = seatsResult.rows.map((s) => ({
    id: s.id,
    row: s.seat_row,
    number: s.seat_number,
  }));

  // 4. Assemble the SAME booking-object shape getMyBookings returns (camelCase, §2).
  return {
    id: b.id,
    userId: b.user_id,
    eventId: b.event_id,
    eventTitle: b.event_title,
    startsAt: b.starts_at,
    seats,
    totalPrice: b.total_price,
    status: b.status,
    createdAt: b.created_at,
  };
}

async function cancelBooking({ bookingId, userId, userRole }) {
  // Validate the id up front — non-numeric / out-of-range → 404 (a booking that
  // can't exist), never a 500.
  const id = parseId(bookingId);
  if (id === null) {
    throw new NotFoundError('Booking not found.');
  }

  // --- The transaction (schema doc §5.2, implemented exactly) ---
  // One pooled client so BEGIN/COMMIT/ROLLBACK all run on the SAME connection.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the booking row + its event's start time, so a double-cancel or a
    //    race with ticket generation can't interleave (schema doc §5.2).
    const locked = await client.query(
      `SELECT b.id, b.user_id, b.status, e.starts_at
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       WHERE b.id = $1
       FOR UPDATE`,
      [id]
    );
    const booking = locked.rows[0];

    // 2. Checks in code, in this order (schema doc §5.2):
    //    404 FIRST — you can't judge ownership of a booking that doesn't exist.
    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }
    //    403 — not the owner, and not an admin (admins may cancel any booking).
    const isOwner = booking.user_id === userId;
    const isAdmin = userRole === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You do not have access to this booking.');
    }
    //    409 — already cancelled (status is no longer 'confirmed').
    if (booking.status !== 'confirmed') {
      throw new BookingNotCancellableError('This booking has already been cancelled.');
    }
    //    409 — the show has already started (cancellable only BEFORE starts_at, no buffer).
    if (new Date(booking.starts_at).getTime() <= Date.now()) {
      throw new BookingNotCancellableError(
        'This booking can no longer be cancelled — the show has already started.'
      );
    }

    // 3. Flip the booking to cancelled. The row SURVIVES (history) — never hard-deleted.
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
      [id]
    );

    // 4. Free the booking's seats back to available.
    await client.query(
      `UPDATE seats SET status = 'available'
       WHERE id IN (SELECT seat_id FROM booking_seats WHERE booking_id = $1)`,
      [id]
    );

    await client.query('COMMIT');
    // Nothing to return — the controller responds 204 No Content.
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function generateTicket({ bookingId, userId, userRole }) {
  // Validate the id up front — non-numeric / out-of-range → 404, same rule as
  // getBookingById/cancelBooking.
  const id = parseId(bookingId);
  if (id === null) {
    throw new NotFoundError('Booking not found.');
  }

  // 1. The booking + its event's title/starts_at/auditorium (the ticket needs
  //    the room number, which getBookingById's SELECT doesn't fetch).
  const result = await pool.query(
    `SELECT b.id, b.user_id, b.status, b.total_price,
            e.title AS event_title, e.starts_at, e.auditorium
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     WHERE b.id = $1`,
    [id]
  );
  const b = result.rows[0];

  // 2. Ownership (404 before 403 — same rule as everywhere else).
  if (!b) {
    throw new NotFoundError('Booking not found.');
  }
  const isOwner = b.user_id === userId;
  const isAdmin = userRole === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have access to this booking.');
  }

  // 3. A cancelled booking has no ticket — api-spec §3.5 calls for 404 here,
  //    not a new 409 code, deliberately: to the caller it should look the
  //    same as "there is nothing to download", not "there is a conflict".
  if (b.status !== 'confirmed') {
    throw new NotFoundError('This booking has no ticket to download.');
  }

  // 4. This booking's seats, human-readable ("D5", "D6") for the PDF.
  const seatsResult = await pool.query(
    `SELECT s.seat_row, s.seat_number
     FROM booking_seats bs
     JOIN seats s ON s.id = bs.seat_id
     WHERE bs.booking_id = $1
     ORDER BY s.seat_row, s.seat_number`,
    [id]
  );
  const seatLabels = seatsResult.rows.map((s) => `${s.seat_row}${s.seat_number}`);

  // 5. Render the PDF and upload it, overwriting the same key every time —
  //    a ticket is cheap to re-render, so there's no cache to invalidate.
  const pdfBuffer = await renderTicketPdf({
    bookingId: id,
    eventTitle: b.event_title,
    startsAt: b.starts_at,
    auditorium: b.auditorium,
    seatLabels,
    totalPrice: b.total_price,
  });
  const key = `bookings/${id}/ticket.pdf`;
  await s3.uploadTicket(pdfBuffer, key, id);

  const expiresIn = 300; // 5 minutes — matches getSignedTicketUrl's default
  const ticketUrl = await s3.getSignedTicketUrl(key, expiresIn);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return { ticketUrl, expiresAt };
}

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  generateTicket,
};
