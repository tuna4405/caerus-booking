// Business logic for events + seats.
// listEvents() and getEventById() share ONE event SELECT + one row-mapping helper
// (mapEventRow) so the event shape and computed seat counts aren't duplicated.
// totalSeats / availableSeats are COMPUTED, not columns (schema doc §6.1).
// getSeatMap() returns one event's seat map (§6.2). createEvent() inserts an event
// and auto-generates its 60 seats in ONE transaction (§3.3).

const pool = require('../config/db');
const { ValidationError, NotFoundError } = require('../lib/errors');

// Shared SELECT: an event plus its computed seat counts (schema doc §6.1).
// Each caller appends its own WHERE / GROUP BY / ORDER / LIMIT.
const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.starts_at, e.duration_minutes,
         e.auditorium, e.price, e.banner_url,
         COUNT(s.id)                                       AS total_seats,
         COUNT(s.id) FILTER (WHERE s.status = 'available') AS available_seats
  FROM events e
  LEFT JOIN seats s ON s.event_id = e.id
`;

// DB row → API event object (snake_case → camelCase, schema doc §2).
// COUNT() returns bigint, which pg hands back as a string — coerce to Number.
function mapEventRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    auditorium: row.auditorium,
    price: row.price,
    bannerUrl: row.banner_url, // null until a banner is uploaded
    totalSeats: Number(row.total_seats),
    availableSeats: Number(row.available_seats),
  };
}

// Garbage page/limit fall back to defaults (never crash); caller caps the limit.
function normalizePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// A date filter, if present, must be a real YYYY-MM-DD calendar date → else 400.
// (A malformed filter is a client error; silently ignoring it would mislead.)
function normalizeDate(date) {
  if (date === undefined || date === null || date === '') {
    return null;
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('date must be a valid YYYY-MM-DD date.');
  }
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new ValidationError('date must be a valid YYYY-MM-DD date.');
  }
  return date;
}

// :id must be a positive int within PostgreSQL's int4 range; else null → 404.
function parseEventId(id) {
  if (!/^\d+$/.test(String(id))) {
    return null;
  }
  const n = Number(id);
  if (n <= 0 || n > 2147483647) {
    return null;
  }
  return n;
}

async function listEvents({ date, page, limit }) {
  const safePage = normalizePositiveInt(page, 1);
  const safeLimit = Math.min(normalizePositiveInt(limit, 20), 50); // clamp > 50 to 50
  const offset = (safePage - 1) * safeLimit;
  const dateFilter = normalizeDate(date);

  // Shared WHERE: upcoming events only, plus the optional date filter.
  const conditions = ['e.starts_at >= now()'];
  const whereParams = [];
  if (dateFilter) {
    whereParams.push(dateFilter);
    conditions.push(`(e.starts_at AT TIME ZONE 'UTC')::date = $${whereParams.length}::date`);
  }
  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // 1. One page of events, soonest first, with computed seat counts (schema §6.1).
  const limitPlaceholder = `$${whereParams.length + 1}`;
  const offsetPlaceholder = `$${whereParams.length + 2}`;
  const listResult = await pool.query(
    `${EVENT_SELECT}
     ${whereClause}
     GROUP BY e.id
     ORDER BY e.starts_at
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    [...whereParams, safeLimit, offset]
  );

  // 2. Total count over the SAME where-conditions (no limit/offset) for pagination.
  const countResult = await pool.query(
    `SELECT COUNT(*) AS total FROM events e ${whereClause}`,
    whereParams
  );
  const totalItems = Number(countResult.rows[0].total);

  return {
    events: listResult.rows.map(mapEventRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalItems,
      totalPages: Math.ceil(totalItems / safeLimit),
    },
  };
}

async function getEventById(id) {
  // Non-numeric / out-of-range id → 404 (never a 500).
  const eventId = parseEventId(id);
  if (eventId === null) {
    throw new NotFoundError('Event not found.');
  }

  // Same SELECT + computed counts as the list, but by id and WITHOUT the
  // "upcoming only" filter — a direct link should work even once a show has started.
  const result = await pool.query(
    `${EVENT_SELECT}
     WHERE e.id = $1
     GROUP BY e.id`,
    [eventId]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Event not found.');
  }
  return mapEventRow(result.rows[0]);
}

async function createEvent(eventData) {
  const { title, description, startsAt, durationMinutes, auditorium, price } = eventData || {};

  // --- Validation BEFORE the transaction, so failures are clean 400s (not caught
  //     DB CHECK errors). We validate here even though the DB also constrains. ---
  if (typeof title !== 'string' || title.trim() === '') {
    throw new ValidationError('title is required.');
  }
  // description is optional; if present it must be a string (DB defaults to '').
  if (description !== undefined && description !== null && typeof description !== 'string') {
    throw new ValidationError('description must be a string.');
  }
  if (typeof startsAt !== 'string' || Number.isNaN(Date.parse(startsAt))) {
    throw new ValidationError('startsAt must be a valid ISO 8601 date string.');
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new ValidationError('durationMinutes must be a positive integer.');
  }
  if (typeof auditorium !== 'string' || auditorium.trim() === '') {
    throw new ValidationError('auditorium is required.');
  }
  if (!Number.isInteger(price) || price < 0) {
    throw new ValidationError('price must be an integer >= 0 (VND, no decimals).');
  }

  // Normalize: trim strings; default description to '' when omitted.
  const cleanTitle = title.trim();
  const cleanDescription = description === undefined || description === null ? '' : description;
  const cleanAuditorium = auditorium.trim();
  const startsAtDate = new Date(startsAt); // validated above; pg stores it as TIMESTAMPTZ

  // --- The transaction: event insert + seat generation are ATOMIC (schema §3.3).
  //     If seat generation fails, the event must NOT exist. ---
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert the event. banner_url is left NULL (set later by the banner endpoint).
    const eventResult = await client.query(
      `INSERT INTO events (title, description, starts_at, duration_minutes, auditorium, price)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [cleanTitle, cleanDescription, startsAtDate, durationMinutes, cleanAuditorium, price]
    );
    const eventId = eventResult.rows[0].id;

    // 2. Auto-generate the fixed 6×10 seat map: A1..A10 … F1..F10 = 60 seats, all
    //    default status 'available' (schema doc §3.3). chr(64+r): 65='A' … 70='F'.
    await client.query(
      `INSERT INTO seats (event_id, seat_row, seat_number)
       SELECT $1, chr(64 + r), n
       FROM generate_series(1, 6)  AS r,
            generate_series(1, 10) AS n`,
      [eventId]
    );

    // 3. Re-fetch the new event WITH computed seat counts via the shared SELECT — the
    //    just-inserted seats are visible inside this txn, so totalSeats/available = 60.
    const created = await client.query(
      `${EVENT_SELECT}
       WHERE e.id = $1
       GROUP BY e.id`,
      [eventId]
    );

    await client.query('COMMIT');

    // Same shape as GET /events/:id (bannerUrl null, counts 60/60), via mapEventRow.
    return mapEventRow(created.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function uploadBanner(id, file) {
  throw new Error('events.service#uploadBanner not implemented yet');
}

async function getSeatMap(eventId) {
  // Validate the id up front (non-numeric / out-of-range → 404, never 500).
  const id = parseEventId(eventId);
  if (id === null) {
    throw new NotFoundError('Event not found.');
  }

  // Existence check: a real event with no seats and a non-existent event BOTH
  // yield zero seat rows, but the spec distinguishes them (200 vs 404). So we
  // confirm the event exists rather than inferring it from the seat count.
  const eventExists = await pool.query('SELECT 1 FROM events WHERE id = $1', [id]);
  if (eventExists.rows.length === 0) {
    throw new NotFoundError('Event not found.');
  }

  // Seat map, ordered so the frontend renders rows top-to-bottom (schema doc §6.2).
  // seat_number is INTEGER, so it orders 1..10 numerically (not 1,10,2).
  const result = await pool.query(
    `SELECT id, seat_row, seat_number, status
     FROM seats
     WHERE event_id = $1
     ORDER BY seat_row, seat_number`,
    [id]
  );

  // snake_case → camelCase / API names (schema doc §2): seat_row → row, seat_number → number.
  return {
    eventId: id,
    seats: result.rows.map((s) => ({
      id: s.id,
      row: s.seat_row,
      number: s.seat_number,
      status: s.status,
    })),
  };
}

module.exports = { listEvents, getEventById, createEvent, uploadBanner, getSeatMap };
