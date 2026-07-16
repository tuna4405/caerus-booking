// Central error handler — must be mounted last in app.js.
// Formats every error into the { error: { code, message } } shape from
// docs/api-spec.md §2.4. Custom error classes (see lib/errors.js) already
// carry statusCode + code; anything else falls back to 500 INTERNAL_ERROR.
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Something went wrong.';

  const body = { error: { code, message } };
  if (err.conflictingSeatIds) {
    body.error.conflictingSeatIds = err.conflictingSeatIds;
  }

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
