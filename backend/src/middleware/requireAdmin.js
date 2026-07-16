// Guards 🔒👑 endpoints. Must run after auth.js has set req.user.
// Insufficient role -> 403 FORBIDDEN (api-spec.md §2.3).
// TODO: check req.user.role === 'admin'
module.exports = function requireAdmin(req, res, next) {
  // TODO: implement
  next();
};
