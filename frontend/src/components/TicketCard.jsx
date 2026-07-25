// Presentation only: a cinema-ticket-styled display of one booking. No fetching,
// no buttons, no click handlers — pages own behavior. My bookings wraps this in a
// <Link>; Booking detail renders it standalone, with actions in a row below it.
import { formatDateTime, formatDateShowtime, formatPrice } from '../utils/format';
import Barcode from './Barcode.jsx';
import './TicketCard.css';

// Single source now (previously duplicated in BookingCard and BookingDetail):
// confirmed+future = "Confirmed" (teal); confirmed+past = "Completed"; cancelled =
// "Cancelled". Both settled states read as grey.
function badgeFor(booking) {
  if (booking.status === 'cancelled') return { label: 'Cancelled', tone: 'muted' };
  if (new Date(booking.startsAt).getTime() < Date.now()) {
    return { label: 'Completed', tone: 'muted' };
  }
  return { label: 'Confirmed', tone: 'confirmed' };
}

export default function TicketCard({ booking }) {
  const cancelled = booking.status === 'cancelled';
  const badge = badgeFor(booking);
  // Human seat labels ("D5, D6") from row+number — never raw seat ids.
  const seatLabels = booking.seats.map((s) => `${s.row}${s.number}`).join(', ');

  return (
    <div className={`caerus-ticket${cancelled ? ' caerus-ticket--cancelled' : ''}`}>
      <div className="caerus-ticket-stub">
        <Barcode id={booking.id} />
      </div>
      <div className="caerus-ticket-perf" aria-hidden="true" />
      <div className="caerus-ticket-body">
        <div className="caerus-ticket-header">
          <p className="caerus-ticket-title">{booking.eventTitle}</p>
          <span className={`caerus-ticket-badge caerus-ticket-badge--${badge.tone}`}>
            {badge.label}
          </span>
        </div>

        <dl className="caerus-ticket-rows">
          <div className="caerus-ticket-row">
            <dt>Seats</dt>
            <dd>{seatLabels}</dd>
          </div>
          <div className="caerus-ticket-row">
            <dt>Booked on</dt>
            <dd>{formatDateTime(booking.createdAt)}</dd>
          </div>
          <div className="caerus-ticket-row">
            <dt>Total</dt>
            <dd className="caerus-ticket-total">{formatPrice(booking.totalPrice)}</dd>
          </div>
        </dl>

        <p className="caerus-ticket-showtime">{formatDateShowtime(booking.startsAt)}</p>
      </div>
    </div>
  );
}
