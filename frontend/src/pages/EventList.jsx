// Route: / — public Home / event list (GET /events, api-spec §3.2).
// Thin by design: fetching + state only; all card presentation is in EventCard.
import { useEffect, useState } from 'react';

import { getEvents, ApiError } from '../api/client';
import EventCard from '../components/EventCard.jsx';
import Button from '../components/ui/Button.jsx';
import './EventList.css';

const PAGE_SIZE = 12;
const SKELETON_COUNT = 6;

// Friendly text by code; never render err.message raw.
function errorMessage(err) {
  if (err instanceof ApiError && err.code === 'NOT_FOUND') {
    return 'No screenings found.';
  }
  return 'Couldn’t load screenings. Check your connection and try again.';
}

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Query params.
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0); // bump to refetch ("Try again")

  useEffect(() => {
    // Ignore flag guards against out-of-order responses: a stale request that
    // resolves after a newer one must not overwrite state.
    let ignore = false;
    setLoading(true);
    setError(null);

    getEvents({ date: date || undefined, page, limit: PAGE_SIZE })
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
  }, [date, page, reloadKey]);

  function handleDateChange(e) {
    setDate(e.target.value);
    setPage(1); // new filter starts from the first page
  }
  function clearDate() {
    setDate('');
    setPage(1);
  }
  function retry() {
    setReloadKey((k) => k + 1);
  }

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <main className="caerus-container caerus-eventlist">
      <h1>Now showing</h1>

      <div className="caerus-eventlist-filter">
        <label className="caerus-eventlist-field">
          <span className="caerus-eventlist-field-label">Show screenings on</span>
          <input
            type="date"
            className="caerus-eventlist-date"
            value={date}
            onChange={handleDateChange}
          />
        </label>
        {date && (
          <Button variant="secondary" onClick={clearDate}>
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="caerus-eventlist-grid" aria-busy="true">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="caerus-eventlist-skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : error ? (
        <div className="caerus-eventlist-state" role="alert">
          <p className="caerus-eventlist-error">{errorMessage(error)}</p>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="caerus-eventlist-state">
          {date ? (
            <>
              <p>No screenings on that date.</p>
              <Button variant="secondary" onClick={clearDate}>
                Clear
              </Button>
            </>
          ) : (
            <p>No upcoming screenings yet.</p>
          )}
        </div>
      ) : (
        <>
          <div className="caerus-eventlist-grid">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="caerus-eventlist-pagination" aria-label="Pagination">
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="caerus-eventlist-pageinfo">
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
