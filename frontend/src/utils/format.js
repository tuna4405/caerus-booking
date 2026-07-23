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

// Minutes -> "1h 36m" (drops the empty half: 120 -> "2h", 45 -> "45m").
export function formatDuration(mins) {
  if (mins == null || Number.isNaN(mins)) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
