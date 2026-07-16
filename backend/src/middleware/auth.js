// Verifies the JWT in the Authorization header and attaches { id, role }
// to req.user. Missing/invalid token -> 401 UNAUTHORIZED (api-spec.md §2.3).
// TODO: implement with jsonwebtoken + process.env.JWT_SECRET.
module.exports = function auth(req, res, next) {
  // TODO: read "Authorization: Bearer <token>", verify, set req.user
  next();
};
