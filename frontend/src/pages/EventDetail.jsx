// Route: /events/:id — PUBLIC event detail + seat picker (api-spec §3.2/§3.3),
// hands the chosen seats to /events/:id/confirm (§3.4). This file owns fetching,
// selection state and routing; SeatMap is presentation only.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { getEventById, getSeatMap, ApiError } from '../api/client';
import { formatDateTime, formatDuration, formatPrice } from '../utils/format';
import { useAuth } from '../context/AuthContext.jsx';
import SeatMap from '../components/SeatMap.jsx';
import Poster from '../components/ui/Poster.jsx';
import Button from '../components/ui/Button.jsx';
import TimeZoneNote from '../components/ui/TimeZoneNote.jsx';
import './EventDetail.css';

const MAX_SEATS = 6;

function parseIds(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function DetailSkeleton() {
  return (
    <main className="caerus-container caerus-detail" aria-busy="true">
      <div className="caerus-detail-columns">
        <div className="caerus-detail-poster-col">
          <div className="caerus-detail-skel-poster" />
        </div>
        <div className="caerus-detail-main">
          <div className="caerus-detail-skel-line caerus-detail-skel-line--title" />
          <div className="caerus-detail-skel-line" />
          <div className="caerus-detail-skel-line caerus-detail-skel-line--short" />
          <div className="caerus-seatmap-grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, r) => (
              <div className="caerus-seatmap-row" key={r}>
                {Array.from({ length: 10 }).map((_, c) => (
                  <span className="caerus-detail-skel-seat" key={c} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Pre-select seats handed back from the confirm page (?seats=...) so the user's
  // choice survives "Back". Not seeded on a conflict return (that selection is void).
  // Unavailable ids are pruned once the seat map loads (see the fetch effect below).
  const [selectedIds, setSelectedIds] = useState(() =>
    searchParams.get('conflicts') ? [] : [...new Set(parseIds(searchParams.get('seats')))]
  );
  const [limitMsg, setLimitMsg] = useState('');

  const conflictIds = useMemo(() => parseIds(searchParams.get('conflicts')), [searchParams]);

  // Fetch event + seat map together. No polling / no refetch-on-focus — that is
  // deliberate (the Week 3 two-browser double-booking test needs the second
  // browser to keep a stale seat long enough to submit). Refresh is manual.
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    Promise.all([getEventById(id), getSeatMap(id)])
      .then(([ev, sm]) => {
        if (ignore) return;
        const seatList = sm.seats ?? [];
        setEvent(ev);
        setSeats(seatList);
        // Drop any selected seat that is no longer available (e.g. after Refresh).
        const availableIds = new Set(
          seatList.filter((s) => s.status === 'available').map((s) => s.id)
        );
        setSelectedIds((prev) => prev.filter((sid) => availableIds.has(sid)));
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
  }, [id, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  // Once the user acts, the stale conflict warning must not resurrect on refresh.
  function clearConflictsParam() {
    if (searchParams.has('conflicts')) {
      const next = new URLSearchParams(searchParams);
      next.delete('conflicts');
      setSearchParams(next, { replace: true });
    }
  }

  function handleToggle(seatId) {
    clearConflictsParam();
    if (selectedIds.includes(seatId)) {
      setSelectedIds(selectedIds.filter((x) => x !== seatId));
      setLimitMsg('');
      return;
    }
    if (selectedIds.length >= MAX_SEATS) {
      // Don't select and don't disable the others — a message reads better than
      // 40 dead buttons.
      setLimitMsg(`You can book up to ${MAX_SEATS} seats at a time.`);
      return;
    }
    setSelectedIds([...selectedIds, seatId]);
    setLimitMsg('');
  }

  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const selectedSeats = useMemo(
    () =>
      selectedIds
        .map((sid) => seatById.get(sid))
        .filter(Boolean)
        .sort((a, b) => a.row.localeCompare(b.row) || a.number - b.number),
    [selectedIds, seatById]
  );
  const selectedLabels = selectedSeats.map((s) => `${s.row}${s.number}`).join(', ');

  function handleContinue() {
    const target = `/events/${id}/confirm?seats=${selectedIds.join(',')}`;
    if (isAuthenticated) {
      navigate(target);
    } else {
      // Send the full intended URL so login returns the user to their selection.
      navigate('/login', { state: { from: target } });
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error) {
    const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';
    return (
      <main className="caerus-container caerus-detail">
        <div className="caerus-detail-state" role="alert">
          {notFound ? (
            <>
              <p>Screening not found.</p>
              <Link to="/">Back to Home</Link>
            </>
          ) : (
            <>
              <p>Couldn’t load this screening.</p>
              <Button variant="secondary" onClick={reload}>Try again</Button>
            </>
          )}
        </div>
      </main>
    );
  }

  const soldOut = event.availableSeats === 0;
  const past = new Date(event.startsAt).getTime() < Date.now();
  const readOnly = soldOut || past;
  const hasConflicts = conflictIds.length > 0;

  return (
    <main className="caerus-container caerus-detail">
      <div className="caerus-detail-columns">
        <div className="caerus-detail-poster-col">
          <Poster
            src={event.bannerUrl}
            title={event.title}
            className="caerus-detail-poster"
            loading="eager"
          />
        </div>

        <div className="caerus-detail-main">
          <div className="caerus-detail-header">
            <h1>{event.title}</h1>
            <p className="caerus-detail-meta">
              <span>{formatDateTime(event.startsAt)}</span>
              <TimeZoneNote />
              <span className="caerus-detail-sep" aria-hidden="true">·</span>
              <span>{formatDuration(event.durationMinutes)}</span>
              <span className="caerus-detail-sep" aria-hidden="true">·</span>
              <span>{event.auditorium}</span>
            </p>
            <p className="caerus-detail-price">
              <span className="caerus-detail-price-value">{formatPrice(event.price)}</span>
            </p>
            {event.description && (
              <p className="caerus-detail-desc">{event.description}</p>
            )}
          </div>

          {soldOut && (
            <div className="caerus-detail-banner">This screening is sold out.</div>
          )}
          {past && !soldOut && (
            <div className="caerus-detail-banner">This screening has already started.</div>
          )}

          {hasConflicts && (
            <div className="caerus-detail-conflict" role="alert">
              <p className="caerus-detail-conflict-msg">
                Some seats were booked by someone else while you were choosing. Please pick again.
              </p>
              <Button variant="secondary" onClick={reload}>Refresh seat map</Button>
            </div>
          )}

          <section className="caerus-detail-mapsection" aria-label="Seats">
            <div className="caerus-detail-maphead">
              <h2>Seats</h2>
              {!hasConflicts && (
                <Button variant="secondary" onClick={reload}>Refresh seat map</Button>
              )}
            </div>
            <SeatMap
              seats={seats}
              selectedIds={selectedIds}
              conflictIds={conflictIds}
              onToggle={handleToggle}
              disabled={readOnly}
            />
          </section>

          {!readOnly && (
            <div className="caerus-detail-summary">
              {limitMsg && (
                <p className="caerus-detail-limit" role="status">{limitMsg}</p>
              )}
              <div className="caerus-detail-summary-row">
                <div className="caerus-detail-summary-info">
                  <p className="caerus-detail-selected">
                    {selectedLabels || 'No seats selected'}
                  </p>
                  <p className="caerus-detail-count">
                    {selectedIds.length} {selectedIds.length === 1 ? 'seat' : 'seats'} selected
                  </p>
                </div>
                <div className="caerus-detail-total">
                  <span className="caerus-detail-total-label">Total</span>
                  {/* Display estimate only — the authoritative total_price is
                      snapshotted by the backend at booking time (schema §3.4). */}
                  <span className="caerus-detail-total-value">
                    {formatPrice(event.price * selectedIds.length)}
                  </span>
                </div>
              </div>
              <Button
                variant="action"
                onClick={handleContinue}
                disabled={selectedIds.length === 0}
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
