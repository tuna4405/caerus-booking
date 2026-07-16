// The ONE file that changes on integration day — every fetch call lives
// here. Base URL comes from VITE_API_BASE_URL (see .env.example); until
// the backend is reachable, callers should fall back to src/mocks/*.json.

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(path, options = {}) {
  const token = localStorage.getItem('token');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Shape from docs/api-spec.md §2.4: { error: { code, message } }
    const err = new Error(data?.error?.message || 'Request failed');
    err.code = data?.error?.code;
    throw err;
  }

  return data;
}

// TODO: implement each call below, then fall back to the matching
// mocks/*.json while the backend endpoint isn't ready yet.

export async function login(email, password) {
  throw new Error('api/client#login not implemented yet');
}

export async function register(name, email, password) {
  throw new Error('api/client#register not implemented yet');
}

export async function getEvents(params) {
  throw new Error('api/client#getEvents not implemented yet');
}

export async function getEventById(id) {
  throw new Error('api/client#getEventById not implemented yet');
}

export async function getSeatMap(eventId) {
  throw new Error('api/client#getSeatMap not implemented yet');
}

export async function createBooking(eventId, seatIds) {
  throw new Error('api/client#createBooking not implemented yet');
}

export async function getMyBookings() {
  throw new Error('api/client#getMyBookings not implemented yet');
}

export async function cancelBooking(bookingId) {
  throw new Error('api/client#cancelBooking not implemented yet');
}
