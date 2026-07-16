// TODO: wire this up to services/events.service.js (seats live under events).

exports.getSeatMap = (req, res) => {
  // GET /events/:id/seats — see docs/api-spec.md §3.3
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'seats.getSeatMap not implemented yet' } });
};
