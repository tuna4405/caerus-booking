// Props: { event } — shape from GET /events (docs/api-spec.md §3.2).
// All presentation lives here; the list page only fetches and lays out.
import { Link } from 'react-router-dom';

import { formatDateTime, formatDuration, formatPrice } from '../utils/format';
import './EventCard.css';

function Availability({ availableSeats, totalSeats }) {
  if (availableSeats <= 0) {
    return <span className="caerus-event-card-badge">Sold out</span>;
  }
  if (availableSeats <= 10) {
    return (
      <span className="caerus-event-card-avail caerus-event-card-avail--low">
        Only {availableSeats} seats left
      </span>
    );
  }
  return (
    <span className="caerus-event-card-avail caerus-event-card-avail--muted">
      {availableSeats} of {totalSeats} seats available
    </span>
  );
}

export default function EventCard({ event }) {
  const soldOut = event.availableSeats <= 0;
  const initial = (event.title?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <Link
      to={`/events/${event.id}`}
      className={`caerus-event-card${soldOut ? ' caerus-event-card--soldout' : ''}`}
    >
      {event.bannerUrl ? (
        <img
          className="caerus-event-card-banner"
          src={event.bannerUrl}
          alt=""
          loading="lazy"
        />
      ) : (
        <div className="caerus-event-card-banner-fallback" aria-hidden="true">
          {initial}
        </div>
      )}

      <h3 className="caerus-event-card-title">{event.title}</h3>

      <div className="caerus-event-card-meta">
        <span>{formatDateTime(event.startsAt)}</span>
        <span className="caerus-event-card-sep" aria-hidden="true">·</span>
        <span>{formatDuration(event.durationMinutes)}</span>
        <span className="caerus-event-card-sep" aria-hidden="true">·</span>
        <span>{event.auditorium}</span>
      </div>

      {event.description && (
        <p className="caerus-event-card-desc">{event.description}</p>
      )}

      <div className="caerus-event-card-footer">
        <span className="caerus-event-card-price">{formatPrice(event.price)}</span>
        <Availability
          availableSeats={event.availableSeats}
          totalSeats={event.totalSeats}
        />
      </div>
    </Link>
  );
}
