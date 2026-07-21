// Verifies the JWT in the Authorization header and attaches { id, role } to
// req.user. Missing/malformed header or invalid/expired token → 401 UNAUTHORIZED
// (api-spec §2.3). Uses verifyToken() from lib/jwt.js — never re-implements JWT.
const { verifyToken } = require('../lib/jwt');
const { UnauthorizedError } = require('../lib/errors');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');

  // Must be exactly "Bearer <token>" — reject missing/malformed headers.
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return next(new UnauthorizedError());
  }

  try {
    // Bad signature, malformed, or expired all throw here → collapse to 401.
    const payload = verifyToken(parts[1]);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    next(new UnauthorizedError());
  }
};
