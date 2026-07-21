// Thin HTTP layer for events. GET / and GET /:id are live (public); the admin
// handlers below are still stubs.
const eventsService = require('../services/events.service');

exports.listEvents = async (req, res, next) => {
  // GET /events (public) — see docs/api-spec.md §3.2
  try {
    const { date, page, limit } = req.query;
    const result = await eventsService.listEvents({ date, page, limit });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.getEventById = async (req, res, next) => {
  // GET /events/:id (public) — see docs/api-spec.md §3.2
  try {
    const event = await eventsService.getEventById(req.params.id);
    res.status(200).json(event);
  } catch (err) {
    next(err);
  }
};

exports.create = (req, res) => {
  // POST /events 🔒👑 — see docs/api-spec.md §3.2
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'events.create not implemented yet' } });
};

exports.uploadBanner = (req, res) => {
  // POST /events/:id/banner 🔒👑 — see docs/api-spec.md §3.2
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'events.uploadBanner not implemented yet' } });
};
