// Shared JWT helpers — the ONE place token logic lives, so registerUser,
// loginUser, and (later) the auth middleware all sign/verify the same way.
// Payload carries { id, role } so protected routes need no DB lookup (api-spec §2.3).

const jwt = require('jsonwebtoken');

const TOKEN_TTL = '7d';

// Sign a token for a user. JWT_SECRET is read at call time (not captured at
// module load) so the current env value always wins.
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

// Verify + decode a token, returning its payload. Throws (JsonWebTokenError /
// TokenExpiredError) if the token is missing, malformed, tampered, or expired.
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
