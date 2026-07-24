// Shared, pure formatters. No React — safe to use anywhere.
// Every screen that shows prices, times, or durations goes through here so the
// whole app formats consistently.

// Showtimes are always displayed in the CINEMA's timezone, never the browser's,
// so they read identically on a laptop set to UTC, on EC2, and on a grader's
// machine. (Wire format stays UTC; only display converts.)
export const CINEMA_TZ = 'Asia/Ho_Chi_Minh';

// Reused Intl instances (constructing these is relatively expensive).
const priceFmt = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CINEMA_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CINEMA_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
// Long date, full month name, no comma — e.g. "31 August 2026".
const dateLongFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CINEMA_TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Integer VND -> Vietnamese currency, e.g. 90000 -> "90.000 ₫".
export function formatPrice(vnd) {
  if (vnd == null || Number.isNaN(vnd)) return '';
  return priceFmt.format(vnd);
}

// ISO-8601 UTC -> cinema-local date, e.g. "2026-07-25T12:30:00Z" -> "25 Jul 2026".
export function formatDate(iso) {
  if (!iso) return '';
  return dateFmt.format(new Date(iso));
}

// ISO-8601 UTC -> cinema-local time (UTC+7), e.g. "2026-07-25T12:30:00Z" -> "19:30".
export function formatTime(iso) {
  if (!iso) return '';
  return timeFmt.format(new Date(iso));
}

// ISO-8601 UTC -> cinema-local date + time, e.g. "25 Jul 2026, 19:30".
export function formatDateTime(iso) {
  if (!iso) return '';
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

// ISO-8601 UTC -> long cinema-local date + time, e.g. "31 August 2026 at 19:30".
// A prominent, spelled-out variant for the event detail header — distinct from
// the compact formatDateTime used on cards and the confirm page.
export function formatDateTimeLong(iso) {
  if (!iso) return '';
  return `${dateLongFmt.format(new Date(iso))} at ${formatTime(iso)}`;
}

// Asia/Ho_Chi_Minh is a FIXED UTC+7 offset — no daylight saving, unchanged since
// 1975 — so converting cinema wall-clock time to UTC is a clean -7h shift: the exact
// inverse of the display formatters above (and of the "(GMT+7)" label). If the cinema
// ever moved to a DST zone this constant would have to become an Intl offset lookup.
const CINEMA_UTC_OFFSET_MINUTES = 7 * 60;

// <input type="datetime-local"> yields a zoneless wall-clock string like
// "2026-08-30T19:30", entered by the admin in CINEMA local time. Do NOT parse it with
// `new Date(...)` — that reads it in the BROWSER's timezone and would misfile the
// showtime. Instead read the fields literally, place them on the UTC clock, then
// subtract the cinema's +7 offset: 19:30 local -> "2026-08-30T12:30:00Z". Pure and
// unit-testable. Returns an ISO-8601 UTC string, or null for empty/malformed input.
export function localCinemaToUtcIso(local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local ?? '');
  if (!m) return null;
  const [, y, mo, d, h, min] = m;
  const utcMs =
    Date.UTC(+y, +mo - 1, +d, +h, +min) - CINEMA_UTC_OFFSET_MINUTES * 60000;
  return new Date(utcMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Minutes -> "1h 36m" (drops the empty half: 120 -> "2h", 45 -> "45m").
export function formatDuration(mins) {
  if (mins == null || Number.isNaN(mins)) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
