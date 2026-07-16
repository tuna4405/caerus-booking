// Small request-validation helpers shared across controllers.
// TODO: flesh out as endpoints are implemented; throw ValidationError
// (see lib/errors.js) on failure so errorHandler formats it consistently.

function isValidEmail(email) {
  // TODO: implement
  return typeof email === 'string';
}

function isNonEmptyString(value) {
  // TODO: implement
  return typeof value === 'string' && value.length > 0;
}

module.exports = {
  isValidEmail,
  isNonEmptyString,
};
