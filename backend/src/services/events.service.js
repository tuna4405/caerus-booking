// Business logic for events + seats.
// TODO: implement against db/config/db.js — see queries in
// docs/database-schema.md §6.1 (list) and §6.2 (seat map), and the seat
// auto-generation statement in §3.3.

async function list({ date, page, limit }) {
  throw new Error('events.service#list not implemented yet');
}

async function getById(id) {
  throw new Error('events.service#getById not implemented yet');
}

async function create(eventData) {
  throw new Error('events.service#create not implemented yet');
}

async function uploadBanner(id, file) {
  throw new Error('events.service#uploadBanner not implemented yet');
}

async function getSeatMap(eventId) {
  throw new Error('events.service#getSeatMap not implemented yet');
}

module.exports = { list, getById, create, uploadBanner, getSeatMap };
