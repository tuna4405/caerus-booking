// Props: { booking } — the booking object from GET /bookings (api-spec §3.4).
// Presentation only: no fetching, no cancel/download logic. A plain horizontal
// list row linking to the booking detail page (which shows the full, ticket-styled
// TicketCard) — this row is deliberately quiet, not ticket-like.
import { Link } from 'react-router-dom';

import { formatDateTime, formatPrice } from '../utils/format';
import Poster from './ui/Poster.jsx';
import TimeZoneNote from './ui/TimeZoneNote.jsx';
import './BookingCard.css';

// confirmed+future = "Confirmed" (teal); confirmed+past = "Completed"; cancelled =
// "Cancelled". Both settled states read as grey. (TicketCard keeps its own copy —
// the two components don't share a module.)
function badgeFor(booking) {
  if (booking.status === 'cancelled') return { label: 'Cancelled', tone: 'muted' };
  if (new Date(booking.startsAt).getTime() < Date.now()) {
    return { label: 'Completed', tone: 'muted' };
  }
  return { label: 'Confirmed', tone: 'confirmed' };
}

export default function BookingCard({ booking }) {
  const cancelled = booking.status === 'cancelled';
  const badge = badgeFor(booking);
  // Human seat labels ("D5, D6") from row+number — never raw seat ids.
  const seatLabels = booking.seats.map((s) => `${s.row}${s.number}`).join(', ');

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className={`caerus-booking-card${cancelled ? ' caerus-booking-card--cancelled' : ''}`}
    >
      {/* No bannerUrl on the booking payload, and fetching each event just for a
          poster would be one request per card — wasteful. Letter placeholder built
          from the title instead (src omitted -> Poster shows the letter). */}
      <Poster
        src={null}
        title={booking.eventTitle}
        className="caerus-booking-card-poster"
      />

      <div className="caerus-booking-card-info">
        <p className="caerus-booking-card-title">{booking.eventTitle}</p>
        <p className="caerus-booking-card-when">
          {formatDateTime(booking.startsAt)} <TimeZoneNote />
        </p>
        <p className="caerus-booking-card-seats">{seatLabels}</p>
      </div>

      <div className="caerus-booking-card-side">
        <span className={`caerus-booking-badge caerus-booking-badge--${badge.tone}`}>
          {badge.label}
        </span>
        <span className="caerus-booking-card-price">{formatPrice(booking.totalPrice)}</span>
      </div>

      <span className="caerus-booking-card-chevron" aria-hidden="true">›</span>
    </Link>
  );
}
