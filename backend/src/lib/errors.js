// Custom error classes, each mapped to a status code + the machine-readable
// `code` from the standard error shape in docs/api-spec.md §2.4.
// Throw these from services/controllers; errorHandler.js turns them into
// { error: { code, message } } responses.

class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ValidationError extends ApiError {
  constructor(message = 'Request failed validation.') {
    super(400, 'VALIDATION_ERROR', message);
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = 'Missing or invalid token.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

class ForbiddenError extends ApiError {
  constructor(message = 'You do not have access to this resource.') {
    super(403, 'FORBIDDEN', message);
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found.') {
    super(404, 'NOT_FOUND', message);
  }
}

class SeatAlreadyBookedError extends ApiError {
  constructor(conflictingSeatIds = [], message = 'One or more selected seats have just been booked by another user.') {
    super(409, 'SEAT_ALREADY_BOOKED', message);
    this.conflictingSeatIds = conflictingSeatIds;
  }
}

class BookingNotCancellableError extends ApiError {
  constructor(message = 'This booking can no longer be cancelled.') {
    super(409, 'BOOKING_NOT_CANCELLABLE', message);
  }
}

class EmailAlreadyExistsError extends ApiError {
  constructor(message = 'An account with this email already exists.') {
    super(409, 'EMAIL_ALREADY_EXISTS', message);
  }
}

module.exports = {
  ApiError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  SeatAlreadyBookedError,
  BookingNotCancellableError,
  EmailAlreadyExistsError,
};
