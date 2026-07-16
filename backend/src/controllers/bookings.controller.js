// TODO: wire these up to services/bookings.service.js once it's implemented.
// POST /bookings is the critical atomic endpoint — see the transaction in
// docs/database-schema.md §5.1 before touching bookings.service.js.

exports.create = (req, res) => {
  // POST /bookings 🔒 — see docs/api-spec.md §3.4
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'bookings.create not implemented yet' } });
};

exports.listMine = (req, res) => {
  // GET /bookings 🔒 — see docs/api-spec.md §3.4
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'bookings.listMine not implemented yet' } });
};

exports.getById = (req, res) => {
  // GET /bookings/:id 🔒 — see docs/api-spec.md §3.4
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'bookings.getById not implemented yet' } });
};

exports.cancel = (req, res) => {
  // DELETE /bookings/:id 🔒 — see the transaction in docs/database-schema.md §5.2
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'bookings.cancel not implemented yet' } });
};
