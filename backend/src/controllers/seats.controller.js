// Thin HTTP layer for the seat map. Seat logic lives in events.service.js
// (seats live under events). This router is mounted at /events/:eventId/seats,
// so mergeParams exposes the id as req.params.eventId.
const eventsService = require('../services/events.service');

exports.getSeatMap = async (req, res, next) => {
  // GET /events/:id/seats (public) — see docs/api-spec.md §3.3
  try {
    const seatMap = await eventsService.getSeatMap(req.params.eventId);
    res.status(200).json(seatMap);
  } catch (err) {
    next(err);
  }
};
