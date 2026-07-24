// Props: { booking } — the booking object from GET /bookings (api-spec §3.4).
// Presentation only: no fetching, no cancel action. A horizontal card linking to
// the booking detail page.
import { Link } from 'react-router-dom';

import { formatDate, formatDateTime, formatPrice } from '../utils/format';
import Poster from './ui/Poster.jsx';
import TimeZoneNote from './ui/TimeZoneNote.jsx';
import './BookingCard.css';

// The badge reflects both status and time: a confirmed booking is "Confirmed"
// while the show is still ahead, and "Completed" once it has started. A cancelled
// booking is always "Cancelled". Confirmed = teal; the two settled states = grey.
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
  // Build human seat labels ("A1, A3") from row+number — never expose raw seat ids.
  const seatLabels = booking.seats.map((s) => `${s.row}${s.number}`).join(', ');

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className={`caerus-booking-card${cancelled ? ' caerus-booking-card--cancelled' : ''}`}
    >
      {/* No bannerUrl on the booking payload, and fetching each event just for a
          poster would be one request per card — wasteful. Show the letter
          placeholder built from the title instead (src omitted → placeholder). */}
      <Poster
        src={null}
        title={booking.eventTitle}
        className="caerus-booking-card-poster"
      />

      <div className="caerus-booking-card-body">
        <div className="caerus-booking-card-info">
          <p className="caerus-booking-card-title">{booking.eventTitle}</p>
          <p className="caerus-booking-card-when">
            {formatDateTime(booking.startsAt)} <TimeZoneNote />
          </p>
          <p className="caerus-booking-card-seats">{seatLabels}</p>
          <p className="caerus-booking-card-price">{formatPrice(booking.totalPrice)}</p>
          <p className="caerus-booking-card-booked">Booked {formatDate(booking.createdAt)}</p>
        </div>

        <span className={`caerus-booking-badge caerus-booking-badge--${badge.tone}`}>
          {badge.label}
        </span>
      </div>
    </Link>
  );
}
