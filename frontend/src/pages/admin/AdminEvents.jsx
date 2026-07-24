// Route: /admin/events 🔒👑 (wrapped in <ProtectedRoute adminOnly>). Admin list of
// upcoming screenings from GET /events (api-spec §3.2) — the same public endpoint
// Home uses, so this only ever shows future events. No edit/delete: the API has no
// such endpoints (only POST /events and POST /events/:id/banner exist). This file
// owns fetching, state and pagination.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getEvents } from '../../api/client';
import { formatDateTime, formatDuration, formatPrice } from '../../utils/format';
import Button from '../../components/ui/Button.jsx';
import TimeZoneNote from '../../components/ui/TimeZoneNote.jsx';
import './AdminEvents.css';

const PAGE_SIZE = 20;
const SKELETON_COUNT = 5;

// One screening: a <tr> on wide screens, a stacked card below 720px (CSS-driven).
// data-label feeds the mobile label/value rows via ::before.
function AdminEventRow({ event }) {
  const soldOut = event.availableSeats === 0;
  const booked = event.totalSeats - event.availableSeats;
  // Data-driven fill width (a computed value, not a design constant) — colour comes
  // from the CSS class, only the length is inline.
  const pct = event.totalSeats > 0 ? Math.round((booked / event.totalSeats) * 100) : 0;

  return (
    <tr className="caerus-adminevents-row">
      <td className="caerus-adminevents-screening" data-label="Screening">
        <span className="caerus-adminevents-title">{event.title}</span>
        <span className="caerus-adminevents-when">
          {formatDateTime(event.startsAt)} <TimeZoneNote />
        </span>
      </td>
      <td data-label="Room">{event.auditorium}</td>
      <td data-label="Runtime">{formatDuration(event.durationMinutes)}</td>
      <td data-label="Price">{formatPrice(event.price)}</td>
      <td className="caerus-adminevents-seats" data-label="Seats">
        <span className="caerus-adminevents-seats-text">
          {soldOut ? 'Sold out' : `${booked} / ${event.totalSeats} booked`}
        </span>
        <span className="caerus-adminevents-bar" aria-hidden="true">
          <span
            className={`caerus-adminevents-bar-fill${soldOut ? ' caerus-adminevents-bar-fill--full' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </span>
      </td>
      <td data-label="Poster">
        {event.bannerUrl ? (
          'Yes'
        ) : (
          <span className="caerus-adminevents-poster-none">None</span>
        )}
      </td>
      <td className="caerus-adminevents-actions" data-label="">
        <Link to={`/events/${event.id}`}>View</Link>
      </td>
    </tr>
  );
}

function CreateButton() {
  return (
    <Button as={Link} to="/admin/events/new" variant="primary">
      Create screening
    </Button>
  );
}

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // A screening just created on /admin/events/new arrives as ?created=1. Capture it
  // into state, then strip the param so a refresh doesn't replay the banner.
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreated] = useState(() => searchParams.get('created') === '1');
  useEffect(() => {
    if (searchParams.get('created')) {
      const next = new URLSearchParams(searchParams);
      next.delete('created');
      setSearchParams(next, { replace: true });
    }
    // Mount only — the banner lives in state now, not the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let ignore = false; // drop out-of-order / post-unmount responses
    setLoading(true);
    setError(null);

    getEvents({ page, limit: PAGE_SIZE })
      .then((data) => {
        if (ignore) return;
        setEvents(data.events ?? []);
        setPagination(data.pagination ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [page, reloadKey]);

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <main className="caerus-container caerus-adminevents">
      <div className="caerus-adminevents-header">
        <div className="caerus-adminevents-heading">
          <h1>Manage screenings</h1>
          <p className="caerus-adminevents-note">
            Showing upcoming screenings only. Past screenings are not listed.
          </p>
        </div>
        <CreateButton />
      </div>

      {showCreated && (
        <div className="caerus-adminevents-banner" role="status">
          Screening created.
        </div>
      )}

      {loading ? (
        <div className="caerus-adminevents-skeletons" aria-busy="true">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="caerus-adminevents-skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : error ? (
        <div className="caerus-adminevents-state" role="alert">
          <p className="caerus-adminevents-error">
            Couldn’t load screenings. Please try again.
          </p>
          <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="caerus-adminevents-state">
          <p>No upcoming screenings.</p>
          <CreateButton />
        </div>
      ) : (
        <>
          <table className="caerus-adminevents-table">
            <caption className="sr-only">Upcoming screenings</caption>
            <thead>
              <tr>
                <th scope="col">Screening</th>
                <th scope="col">Room</th>
                <th scope="col">Runtime</th>
                <th scope="col">Price</th>
                <th scope="col">Seats</th>
                <th scope="col">Poster</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <AdminEventRow key={event.id} event={event} />
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <nav className="caerus-adminevents-pagination" aria-label="Pagination">
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="caerus-adminevents-pageinfo">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
