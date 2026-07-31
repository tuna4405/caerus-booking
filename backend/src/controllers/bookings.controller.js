// Thin HTTP layer for bookings. GET /bookings is live; the rest are stubs.
// POST /bookings is the critical atomic endpoint — see the transaction in
// docs/database-schema.md §5.1 before touching bookings.service.js.
const bookingsService = require('../services/bookings.service');

exports.createBooking = async (req, res, next) => {
  // POST /bookings 🔒 — see docs/api-spec.md §3.4. userId comes from the JWT
  // (req.user), never the body: a user always books as themselves.
  try {
    const { eventId, seatIds } = req.body || {};
    const booking = await bookingsService.createBooking({
      userId: req.user.id,
      eventId,
      seatIds,
    });
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
};

exports.getMyBookings = async (req, res, next) => {
  // GET /bookings 🔒 — the caller's OWN bookings (api-spec §3.4).
  // req.user is set by the auth middleware; the user id never comes from URL/body.
  try {
    const bookings = await bookingsService.getMyBookings(req.user.id);
    res.status(200).json({ bookings });
  } catch (err) {
    next(err);
  }
};

exports.getBookingById = async (req, res, next) => {
  // GET /bookings/:id 🔒 — one booking (api-spec §3.4). Owners read their own;
  // admins read any (ownership enforced in the service, 404 before 403).
  try {
    const booking = await bookingsService.getBookingById({
      bookingId: req.params.id,
      userId: req.user.id,
      userRole: req.user.role,
    });
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
};

exports.cancelBooking = async (req, res, next) => {
  // DELETE /bookings/:id 🔒 — cancel + free seats (api-spec §3.4, txn schema §5.2).
  // Admins may cancel any booking; owners only their own (enforced in the service).
  try {
    await bookingsService.cancelBooking({
      bookingId: req.params.id,
      userId: req.user.id,
      userRole: req.user.role,
    });
    res.status(204).end(); // 204 No Content — nothing to return.
  } catch (err) {
    next(err);
  }
};

exports.generateTicket = async (req, res, next) => {
  // POST /bookings/:id/ticket 🔒 — api-spec §3.5. Renders + uploads the PDF
  // in-process (lib/ticketPdf.js + lib/s3.js), returns a presigned download URL.
  try {
    const result = await bookingsService.generateTicket({
      bookingId: req.params.id,
      userId: req.user.id,
      userRole: req.user.role,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
