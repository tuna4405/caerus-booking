// TODO: wire these up to services/auth.service.js once it's implemented.

exports.register = (req, res) => {
  // POST /auth/register — see docs/api-spec.md §3.1
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'auth.register not implemented yet' } });
};

exports.login = (req, res) => {
  // POST /auth/login — see docs/api-spec.md §3.1
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'auth.login not implemented yet' } });
};
