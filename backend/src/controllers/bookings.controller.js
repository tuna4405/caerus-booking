// Thin HTTP layer for bookings. GET /bookings is live; the rest are stubs.
// POST /bookings is the critical atomic endpoint — see the transaction in
// docs/database-schema.md §5.1 before touching bookings.service.js.
const bookingsService = require('../services/bookings.service');

exports.create = (req, res) => {
  // POST /bookings 🔒 — see docs/api-spec.md §3.4
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'bookings.create not implemented yet' } });
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

exports.getById = (req, res) => {
  // GET /bookings/:id 🔒 — see docs/api-spec.md §3.4
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'bookings.getById not implemented yet' } });
};

exports.cancel = (req, res) => {
  // DELETE /bookings/:id 🔒 — see the transaction in docs/database-schema.md §5.2
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'bookings.cancel not implemented yet' } });
};
