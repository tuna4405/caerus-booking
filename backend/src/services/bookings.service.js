// Business logic for bookings.
// TODO: create() must run the atomic SELECT ... FOR UPDATE transaction in
// docs/database-schema.md §5.1. cancel() must run the transaction in §5.2.
// Both are the critical correctness paths of this project — do not
// shortcut the row locking.

async function create({ userId, eventId, seatIds }) {
  throw new Error('bookings.service#create not implemented yet');
}

async function listMine(userId) {
  throw new Error('bookings.service#listMine not implemented yet');
}

async function getById(id, requestingUser) {
  throw new Error('bookings.service#getById not implemented yet');
}

async function cancel(id, requestingUser) {
  throw new Error('bookings.service#cancel not implemented yet');
}

module.exports = { create, listMine, getById, cancel };
