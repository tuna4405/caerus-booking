// Route: /events/:id/confirm?seats=101,103,104 — PROTECTED (wrapped in
// <ProtectedRoute>). Confirms and submits a booking (api-spec §3.4). This file owns
// URL validation, fetching + cross-check, submit and routing; presentation is inline.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { getEventById, getSeatMap, createBooking, ApiError } from '../api/client';
import { formatDateTimeLong, formatPrice } from '../utils/format';
import Poster from '../components/ui/Poster.jsx';
import Button from '../components/ui/Button.jsx';
import TimeZoneNote from '../components/ui/TimeZoneNote.jsx';
import './ConfirmBooking.css';

const MAX_SEATS = 6;

// The URL is untrusted (a user can hand-edit it). Accept only a comma list of 1..6
// positive integers with NO duplicates and NO junk; anything else is invalid.
function parseSeatParam(raw) {
  if (!raw) return { ids: [], valid: false };
  const parts = raw.split(',').map((s) => s.trim());
  const ids = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return { ids: [], valid: false }; // non-numeric / empty entry
    const n = Number(p);
    if (!Number.isInteger(n) || n <= 0 || n > 2147483647) return { ids: [], valid: false };
    ids.push(n);
  }
  if (ids.length < 1 || ids.length > MAX_SEATS) return { ids: [], valid: false };
  if (new Set(ids).size !== ids.length) return { ids: [], valid: false }; // duplicates
  return { ids, valid: true }; // already unique; order preserved for display
}

function CenteredMessage({ children }) {
  return (
    <main className="caerus-container caerus-confirm">
      <div className="caerus-confirm-message" role="alert">{children}</div>
    </main>
  );
}

function ConfirmSkeleton() {
  return (
    <main className="caerus-container caerus-confirm" aria-busy="true">
      <div className="caerus-confirm-card">
        <div className="caerus-confirm-skel-line caerus-confirm-skel-line--title" />
        <div className="caerus-confirm-event">
          <div className="caerus-confirm-skel-poster" />
          <div className="caerus-confirm-skel-lines">
            <div className="caerus-confirm-skel-line" />
            <div className="caerus-confirm-skel-line caerus-confirm-skel-line--short" />
          </div>
        </div>
        <div className="caerus-confirm-skel-line" />
        <div className="caerus-confirm-skel-line" />
      </div>
    </main>
  );
}

export default function ConfirmBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { ids: seatIds, valid: idsValid } = useMemo(
    () => parseSeatParam(searchParams.get('seats')),
    [searchParams]
  );

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notInEvent, setNotInEvent] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null); // generic/retryable message
  const [submitTerminal, setSubmitTerminal] = useState(null); // 'invalid' | 'gone'
  const submittingRef = useRef(false); // synchronous double-submit guard

  // Fetch event + seat map together. The URL carries only seat IDS, so labels like
  // "A1" must come from the seat map; fetching also lets us catch a stale selection.
  useEffect(() => {
    if (!idsValid) return; // invalid URL — no fetch, no submit (handled in render)
    let ignore = false;
    setLoading(true);
    setLoadError(null);
    setNotInEvent(false);

    Promise.all([getEventById(id), getSeatMap(id)])
      .then(([ev, sm]) => {
        if (ignore) return;
        const seatList = sm.seats ?? [];
        const byId = new Map(seatList.map((s) => [s.id, s]));

        // Any requested id that isn't a seat of THIS event -> invalid selection.
        if (!seatIds.every((sid) => byId.has(sid))) {
          setNotInEvent(true);
          setLoading(false);
          return;
        }

        // Courtesy pre-check: if a requested seat is already booked, bounce to the
        // picker's conflict view. This is NOT a guarantee — Caerus v1 has no seat
        // hold, so seats stay available to everyone until the booking transaction
        // commits; a seat can still be taken between this check and submit. That is
        // exactly what the 409 path in handleConfirm handles. Do not add a hold,
        // timer, or countdown here — out of scope for v1.
        const booked = seatIds.filter((sid) => byId.get(sid).status === 'booked');
        if (booked.length > 0) {
          navigate(`/events/${id}?conflicts=${booked.join(',')}`, { replace: true });
          return;
        }

        setEvent(ev);
        setSeats(seatList);
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        setLoadError(err);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [id, idsValid, seatIds, reloadKey, navigate]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function handleConfirm() {
    // Guard synchronously with a ref: a fast double-click can fire the second
    // handler before the `submitting` state re-render disables the button. This
    // endpoint is NOT idempotent, so two clicks would create two bookings.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { booking } = await createBooking(Number(id), seatIds);
      // replace: the user must not be able to press Back onto this page and resubmit.
      navigate(`/bookings/${booking.id}?created=1`, { replace: true });
    } catch (err) {
      handleSubmitError(err);
    }
  }

  function handleSubmitError(err) {
    if (err instanceof ApiError) {
      if (err.code === 'SEAT_ALREADY_BOOKED') {
        // The headline path: the visible proof of SELECT ... FOR UPDATE. Forward the
        // conflicting ids to the picker so it highlights exactly what was lost.
        const conflicts = Array.isArray(err.conflictingSeatIds)
          ? err.conflictingSeatIds.filter((n) => Number.isInteger(n))
          : [];
        const q = conflicts.length ? `?conflicts=${conflicts.join(',')}` : '';
        navigate(`/events/${id}${q}`, { replace: true });
        return; // navigating away — leave the guard set (this view unmounts)
      }
      if (err.code === 'UNAUTHORIZED') {
        // Token expired mid-flow. Return here after logging back in.
        const from = `/events/${id}/confirm?seats=${seatIds.join(',')}`;
        navigate('/login', { state: { from } });
        return;
      }
      if (err.code === 'VALIDATION_ERROR') {
        submittingRef.current = false;
        setSubmitting(false);
        setSubmitTerminal('invalid');
        return;
      }
      if (err.code === 'NOT_FOUND') {
        submittingRef.current = false;
        setSubmitting(false);
        setSubmitTerminal('gone');
        return;
      }
    }
    // Generic / network failure: the booking MAY or may not have been created, so
    // steer the user to My bookings before retrying. Re-enable + clear the guard.
    submittingRef.current = false;
    setSubmitting(false);
    setSubmitError(
      'Couldn’t complete your booking. It may or may not have gone through — check My bookings before retrying.'
    );
  }

  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);

  // ---- Terminal / non-card views (order matters) ------------------------------
  if (!idsValid || notInEvent || submitTerminal === 'invalid') {
    return (
      <CenteredMessage>
        <p>That seat selection isn’t valid.</p>
        <Button as={Link} to={`/events/${id}`} variant="secondary">
          Back to seat selection
        </Button>
      </CenteredMessage>
    );
  }
  if ((loadError instanceof ApiError && loadError.code === 'NOT_FOUND') || submitTerminal === 'gone') {
    return (
      <CenteredMessage>
        <p>This screening no longer exists.</p>
        <Button as={Link} to="/" variant="secondary">Back to Home</Button>
      </CenteredMessage>
    );
  }
  if (loading) return <ConfirmSkeleton />;
  if (loadError) {
    return (
      <CenteredMessage>
        <p className="caerus-confirm-error">Couldn’t load your booking details. Please try again.</p>
        <Button variant="secondary" onClick={reload}>Try again</Button>
      </CenteredMessage>
    );
  }

  const soldOut = event.availableSeats === 0;
  const past = new Date(event.startsAt).getTime() < Date.now();
  if (soldOut || past) {
    return (
      <CenteredMessage>
        <p>This screening can no longer be booked.</p>
        <Button as={Link} to="/" variant="secondary">Back to Home</Button>
      </CenteredMessage>
    );
  }

  // ---- Main confirm card ------------------------------------------------------
  const count = seatIds.length;
  const seatLabels = seatIds
    .map((sid) => seatById.get(sid))
    .filter(Boolean)
    .map((s) => `${s.row}${s.number}`)
    .join(', ');
  const backTo = `/events/${id}?seats=${seatIds.join(',')}`;

  return (
    <main className="caerus-container caerus-confirm">
      <div className="caerus-confirm-card caerus-decor-card">
        <h1 className="caerus-confirm-title">Confirm booking</h1>

        <div className="caerus-confirm-event">
          <Poster
            src={event.bannerUrl}
            title={event.title}
            className="caerus-confirm-poster"
            loading="eager"
          />
          <div className="caerus-confirm-event-info">
            <h2 className="caerus-confirm-event-title">{event.title}</h2>
            <p className="caerus-confirm-event-meta">
              <span>{formatDateTimeLong(event.startsAt)}</span>
              <TimeZoneNote />
            </p>
            <p className="caerus-confirm-event-aud">{event.auditorium}</p>
          </div>
        </div>

        <dl className="caerus-confirm-rows">
          <div className="caerus-confirm-row">
            <dt>Seats</dt>
            <dd>{seatLabels}</dd>
          </div>
          <div className="caerus-confirm-row">
            <dt>
              {formatPrice(event.price)} × {count} {count === 1 ? 'seat' : 'seats'}
            </dt>
            {/* Display calculation only — the authoritative total_price is
                snapshotted server-side at booking time (schema §3.4). */}
            <dd>{formatPrice(event.price * count)}</dd>
          </div>
          <div className="caerus-confirm-row caerus-confirm-row--total">
            <dt>Total</dt>
            <dd className="caerus-confirm-total-value">{formatPrice(event.price * count)}</dd>
          </div>
        </dl>

        {submitError && (
          <p className="caerus-confirm-error" role="alert">
            {submitError} <Link to="/my-bookings">Go to My bookings</Link>
          </p>
        )}

        <div className="caerus-confirm-actions">
          <Button variant="action" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Booking…' : 'Confirm booking'}
          </Button>
          <Button as={Link} to={backTo} variant="secondary">Back</Button>
        </div>
      </div>
    </main>
  );
}
