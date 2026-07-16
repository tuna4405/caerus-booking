// TODO: wire these up to services/events.service.js once it's implemented.

exports.list = (req, res) => {
  // GET /events — see docs/api-spec.md §3.2
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'events.list not implemented yet' } });
};

exports.getById = (req, res) => {
  // GET /events/:id — see docs/api-spec.md §3.2
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'events.getById not implemented yet' } });
};

exports.create = (req, res) => {
  // POST /events 🔒👑 — see docs/api-spec.md §3.2
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'events.create not implemented yet' } });
};

exports.uploadBanner = (req, res) => {
  // POST /events/:id/banner 🔒👑 — see docs/api-spec.md §3.2
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'events.uploadBanner not implemented yet' } });
};
