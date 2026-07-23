// Props: { event } — shape from GET /events (docs/api-spec.md §3.2).
// Portrait card: a 2:3 poster over a decorative info footer (docs/design/event-card.png).
// Only title, date+time, and availability appear here — price lives on the detail page.
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDateTime } from '../utils/format';
import './EventCard.css';

function availabilityText(availableSeats, totalSeats) {
  if (availableSeats === 0) return 'Sold out';
  if (availableSeats <= 10) return `Only ${availableSeats} left`;
  return `${availableSeats}/${totalSeats} available`;
}

export default function EventCard({ event }) {
  // Fall back to the letter placeholder if the poster URL fails to load
  // (bad S3 URL, missing object, wrong bucket policy) — no broken-image icon.
  const [imgFailed, setImgFailed] = useState(false);

  const soldOut = event.availableSeats === 0;
  const initial = (event.title?.trim()?.[0] ?? '?').toUpperCase();
  const showImage = Boolean(event.bannerUrl) && !imgFailed;

  return (
    <Link
      to={`/events/${event.id}`}
      className={`caerus-event-card${soldOut ? ' caerus-event-card--soldout' : ''}`}
    >
      {/* Poster — bannerUrl is a 2:3 portrait poster, not a landscape banner. */}
      <div className="caerus-event-card-poster">
        {showImage ? (
          <img
            className="caerus-event-card-poster-img"
            src={event.bannerUrl}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="caerus-event-card-poster-letter" aria-hidden="true">
            {initial}
          </span>
        )}
      </div>

      {/* Decorative footer — orange base + three shapes; text rides above (z-index). */}
      <div className="caerus-event-card-footer">
        <span className="caerus-event-card-shape caerus-event-card-shape--teal" aria-hidden="true" />
        <span className="caerus-event-card-shape caerus-event-card-shape--dark" aria-hidden="true" />
        <span className="caerus-event-card-shape caerus-event-card-shape--square" aria-hidden="true" />

        <div className="caerus-event-card-heading">
          <h3 className="caerus-event-card-title">{event.title}</h3>
          <p className="caerus-event-card-date">{formatDateTime(event.startsAt)}</p>
        </div>
        <p className="caerus-event-card-avail">
          {availabilityText(event.availableSeats, event.totalSeats)}
        </p>
      </div>
    </Link>
  );
}
