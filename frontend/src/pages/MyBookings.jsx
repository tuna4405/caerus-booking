// Route: /my-bookings 🔒 (wrapped in <ProtectedRoute>). Lists the logged-in user's
// own bookings from GET /bookings (api-spec §3.4). This file owns fetching, grouping
// and page states; BookingCard is presentation only. (Booking detail uses the
// fuller, ticket-styled TicketCard instead — this list stays plain and quiet.)
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getMyBookings, ApiError } from '../api/client';
import BookingCard from '../components/BookingCard.jsx';
import Button from '../components/ui/Button.jsx';
import './MyBookings.css';

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch once on mount (and on "Try again"). No polling. The ignore flag drops a
  // stale response if a second fetch resolves out of order or after unmount.
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    getMyBookings()
      .then((data) => {
        if (ignore) return;
        setBookings(data?.bookings ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        // Shouldn't happen behind ProtectedRoute, but a token can expire mid-session.
        // Treat 401 as "log back in", returning here afterwards.
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login', { state: { from: '/my-bookings' }, replace: true });
          return;
        }
        setError(err);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey, navigate]);

  // "Upcoming" = still to come AND not cancelled. Everything else (already started,
  // or cancelled) is "Past". The API's newest-first order is preserved by filter().
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const isUpcoming = (b) =>
      b.status === 'confirmed' && new Date(b.startsAt).getTime() > now;
    return {
      upcoming: bookings.filter(isUpcoming),
      past: bookings.filter((b) => !isUpcoming(b)),
    };
  }, [bookings]);

  return (
    <main className="caerus-container caerus-mybookings">
      <div className="caerus-mybookings-inner">
        <h1>My bookings</h1>

        {loading && (
          <div className="caerus-mybookings-list" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="caerus-booking-skeleton" key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="caerus-mybookings-state" role="alert">
            <p className="caerus-mybookings-error">
              Couldn’t load your bookings. Please try again.
            </p>
            <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div className="caerus-mybookings-state">
            <p>You haven’t booked any seats yet.</p>
            <Button as={Link} to="/" variant="primary">Browse screenings</Button>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <>
            {upcoming.length > 0 && (
              <section className="caerus-mybookings-group">
                <h2 className="caerus-mybookings-subhead">Upcoming</h2>
                <ul className="caerus-mybookings-list">
                  {upcoming.map((b) => (
                    <li key={b.id}>
                      <BookingCard booking={b} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {past.length > 0 && (
              <section className="caerus-mybookings-group">
                <h2 className="caerus-mybookings-subhead">Past</h2>
                <ul className="caerus-mybookings-list">
                  {past.map((b) => (
                    <li key={b.id}>
                      <BookingCard booking={b} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
