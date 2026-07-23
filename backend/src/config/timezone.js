// The cinema's wall-clock timezone. Storage and the wire format stay UTC; this
// only governs interpretation of LOCAL calendar dates — chiefly the
// GET /events ?date filter (events.service.js). Read once here so the literal
// isn't scattered through the codebase. Override with CINEMA_TIMEZONE in .env.
const CINEMA_TIMEZONE = process.env.CINEMA_TIMEZONE || 'Asia/Ho_Chi_Minh';

module.exports = { CINEMA_TIMEZONE };
