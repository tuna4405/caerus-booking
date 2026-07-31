// src/api/client.js — the single place the frontend knows about the API.
// Calls the LIVE Express API (see .env: VITE_API_BASE_URL). No mocks:
// the backend is built, so every screen talks to the real thing.

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_KEY = 'caerus_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Every failure throws this. Screens switch on `code` (never on `message`),
// per api-spec §2.4.
export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    Object.assign(this, extra); // carries conflictingSeatIds
  }
}

async function request(method, path, { body, auth = false } = {}) {
  const headers = {};
  let payload;

  if (body instanceof FormData) {
    payload = body; // let the browser set the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });

  if (res.status === 204) return null; // cancel booking returns no body

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { /* leave null */ }
  }

  if (!res.ok) {
    const { code, message, ...extra } = data?.error ?? {};
    throw new ApiError(res.status, code, message, extra);
  }
  return data;
}

// ---- Auth (api-spec §3.1) ----
export function login(email, password) {
  return request('POST', '/auth/login', { body: { email, password } });
}
export function register(name, email, password) {
  return request('POST', '/auth/register', { body: { name, email, password } });
}

// ---- Events (§3.2) ----
export function getEvents(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return request('GET', `/events${qs ? `?${qs}` : ''}`);
}
export function getEventById(id) {
  return request('GET', `/events/${id}`);
}
export function createEvent(event) {
  return request('POST', '/events', { body: event, auth: true });
}
export function uploadBanner(eventId, file) {
  const body = new FormData();
  body.append('image', file);
  return request('POST', `/events/${eventId}/banner`, { body, auth: true });
}

// ---- Seats (§3.3) ----
export function getSeatMap(eventId) {
  return request('GET', `/events/${eventId}/seats`);
}

// ---- Bookings (§3.4) ----
export function createBooking(eventId, seatIds) {
  return request('POST', '/bookings', { body: { eventId, seatIds }, auth: true });
}
export function getMyBookings() {
  return request('GET', '/bookings', { auth: true });
}
export function getBookingById(id) {
  return request('GET', `/bookings/${id}`, { auth: true });
}
export function cancelBooking(bookingId) {
  return request('DELETE', `/bookings/${bookingId}`, { auth: true });
}
export function generateTicket(bookingId) {
  return request('POST', `/bookings/${bookingId}/ticket`, { auth: true });
}