// Guards 🔒👑 endpoints. Must run AFTER auth.js has set req.user.
// Non-admin (or missing req.user) → 403 FORBIDDEN (api-spec §2.3).
// Defined for later use — deliberately not attached to any route yet.
const { ForbiddenError } = require('../lib/errors');

module.exports = function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError());
  }
  next();
};
