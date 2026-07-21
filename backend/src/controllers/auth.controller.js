// Thin HTTP layer — parse the body, call the service, shape the response.
// Errors are forwarded to next() so errorHandler formats them (api-spec §2.4).
const authService = require('../services/auth.service');

exports.register = async (req, res, next) => {
  // POST /auth/register — see docs/api-spec.md §3.1
  try {
    const { name, email, password } = req.body || {};
    const result = await authService.registerUser({ name, email, password });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  // POST /auth/login — see docs/api-spec.md §3.1
  try {
    const { email, password } = req.body || {};
    const result = await authService.loginUser({ email, password });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
