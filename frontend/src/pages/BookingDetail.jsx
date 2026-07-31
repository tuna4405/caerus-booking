// Route: /bookings/:id 🔒 (wrapped in <ProtectedRoute>). One booking, with the
// cancel flow (api-spec §3.4) and the ticket download flow (§3.5).
// This file owns fetching, cancel/download logic and routing; presentation is inline.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { getBookingById, cancelBooking, generateTicket, ApiError } from '../api/client';
import Button from '../components/ui/Button.jsx';
import TicketCard from '../components/TicketCard.jsx';
import './BookingDetail.css';

const CANCEL_TRIGGER_ID = 'caerus-cancel-trigger';

function Frame({ children, busy = false }) {
  return (
    <main className="caerus-container caerus-bookingdetail" aria-busy={busy || undefined}>
      <div className="caerus-bookingdetail-inner">{children}</div>
    </main>
  );
}

function BackLink() {
  return (
    <Button as={Link} to="/my-bookings" variant="quiet" className="caerus-bookingdetail-back">
      ← My bookings
    </Button>
  );
}

function DetailSkeleton() {
  return (
    <Frame busy>
      <div className="caerus-bookingdetail-skel-line caerus-bookingdetail-skel-line--title" />
      <div className="caerus-bookingdetail-skel-line caerus-bookingdetail-skel-line--short" />
    </Frame>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Banners. `created` is captured once so clearing the URL doesn't drop it; a
  // successful cancel replaces it with the cancelled banner.
  const [showCreated, setShowCreated] = useState(() => searchParams.get('created') === '1');
  const [cancelledBanner, setCancelledBanner] = useState(false);

  // Cancel flow.
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState(null); // string | node
  const cancellingRef = useRef(false); // synchronous double-submit guard
  const confirmRef = useRef(null);

  // Ticket download flow.
  const [downloading, setDownloading] = useState(false);
  const downloadingRef = useRef(false); // synchronous double-click guard

  // Strip ?created=1 after the first render so a refresh won't replay the banner.
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
    let ignore = false;
    setLoading(true);
    setError(null);

    getBookingById(id)
      .then((data) => {
        if (ignore) return;
        // API wraps as { booking }; tolerate a bare object just in case.
        setBooking(data?.booking ?? data);
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

  // Move focus into the confirmation panel when it opens.
  useEffect(() => {
    if (showConfirm) confirmRef.current?.focus();
  }, [showConfirm]);

  async function refetch() {
    try {
      const data = await getBookingById(id);
      setBooking(data?.booking ?? data);
    } catch {
      /* keep the current view; the action message already explains the situation */
    }
  }

  function closeConfirm() {
    setShowConfirm(false);
    // Return focus to the trigger for keyboard users.
    requestAnimationFrame(() => document.getElementById(CANCEL_TRIGGER_ID)?.focus());
  }

  async function handleCancelConfirm() {
    if (cancellingRef.current) return; // fast double-click: the ref beats the re-render
    cancellingRef.current = true;
    setCancelling(true);
    setActionError(null);

    try {
      await cancelBooking(id); // 204 No Content -> client returns null; don't read a body
      await refetch(); // authoritative new state (status: cancelled) rather than a guess
      setShowConfirm(false);
      setShowCreated(false);
      setCancelledBanner(true);
    } catch (err) {
      handleCancelError(err);
    } finally {
      cancellingRef.current = false;
      setCancelling(false);
    }
  }

  function handleCancelError(err) {
    if (err instanceof ApiError) {
      if (err.code === 'BOOKING_NOT_CANCELLABLE') {
        setActionError(
          'This booking can no longer be cancelled — the screening has already started.'
        );
        setShowConfirm(false);
        refetch(); // reflect reality: the cancel button drops away after the refetch
        return;
      }
      if (err.code === 'FORBIDDEN') {
        setActionError("You don’t have permission to cancel this booking.");
        return;
      }
      if (err.code === 'NOT_FOUND') {
        setShowConfirm(false);
        setActionError(
          <>This booking no longer exists. <Link to="/my-bookings">Back to My bookings</Link></>
        );
        return;
      }
      if (err.code === 'UNAUTHORIZED') {
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
    }
    // Generic / network failure: the DELETE may or may not have committed.
    setActionError(
      'Couldn’t cancel your booking. Please try again. It may or may not have gone through — refresh to check before retrying.'
    );
  }

  async function handleDownloadTicket() {
    if (downloadingRef.current) return; // fast double-click: the ref beats the re-render
    downloadingRef.current = true;
    setDownloading(true);
    setActionError(null);

    try {
      const { ticketUrl } = await generateTicket(id);
      // A new tab so the booking page (and its cancel flow) stays put behind it.
      window.open(ticketUrl, '_blank', 'noopener');
    } catch (err) {
      handleDownloadError(err);
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  }

  function handleDownloadError(err) {
    if (err instanceof ApiError) {
      if (err.code === 'NOT_FOUND') {
        setActionError('This booking has no ticket to download.');
        return;
      }
      if (err.code === 'FORBIDDEN') {
        setActionError("You don’t have permission to download this ticket.");
        return;
      }
      if (err.code === 'UNAUTHORIZED') {
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
    }
    setActionError('Couldn’t generate the ticket. Please try again.');
  }

  if (loading) return <DetailSkeleton />;

  if (error) {
    const code = error instanceof ApiError ? error.code : null;
    return (
      <Frame>
        <BackLink />
        <div className="caerus-bookingdetail-state" role="alert">
          {code === 'NOT_FOUND' ? (
            <>
              <p>Booking not found.</p>
              <Button as={Link} to="/my-bookings" variant="secondary">Back to My bookings</Button>
            </>
          ) : code === 'FORBIDDEN' ? (
            <>
              <p>You don’t have permission to view this booking.</p>
              <Button as={Link} to="/my-bookings" variant="secondary">Back to My bookings</Button>
            </>
          ) : (
            <>
              <p>Couldn’t load this booking.</p>
              <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>
            </>
          )}
        </div>
      </Frame>
    );
  }

  const cancelled = booking.status === 'cancelled';
  const past = new Date(booking.startsAt).getTime() < Date.now();
  const canCancel = booking.status === 'confirmed' && !past;
  const seatLabels = booking.seats.map((s) => `${s.row}${s.number}`).join(', ');

  return (
    <Frame>
      <BackLink />

      {/* TicketCard's own title is presentational (not a heading element), so the
          page keeps one real, visually-hidden h1 for document structure / a11y. */}
      <h1 className="sr-only">{booking.eventTitle} — booking details</h1>

      {cancelledBanner ? (
        <div className="caerus-bookingdetail-banner caerus-bookingdetail-banner--cancelled" role="status">
          Booking cancelled. Your seats have been released.
        </div>
      ) : (
        showCreated && (
          <div className="caerus-bookingdetail-banner caerus-bookingdetail-banner--success" role="status">
            Booking confirmed. Your seats are reserved.
          </div>
        )
      )}

      <TicketCard booking={booking} />

      {actionError && (
        <div className="caerus-bookingdetail-error" role="alert">{actionError}</div>
      )}

      {(canCancel || !cancelled) && (
        <div className="caerus-bookingdetail-actions">
          {/* Ticket download (api-spec §3.5) — hidden once cancelled, since a
              cancelled booking has no ticket (the API 404s for it too). */}
          {!cancelled && (
            <div className="caerus-bookingdetail-ticket">
              <Button variant="secondary" onClick={handleDownloadTicket} disabled={downloading}>
                {downloading ? 'Generating…' : 'Download ticket'}
              </Button>
            </div>
          )}
          {canCancel && (
            <Button
              id={CANCEL_TRIGGER_ID}
              variant="danger"
              onClick={() => setShowConfirm(true)}
            >
              Cancel
            </Button>
          )}
        </div>
      )}

      {showConfirm && (
        <div
          className="caerus-bookingdetail-confirm"
          role="alertdialog"
          aria-label="Confirm cancellation"
          aria-describedby="caerus-cancel-desc"
          tabIndex={-1}
          ref={confirmRef}
          onKeyDown={(e) => { if (e.key === 'Escape') closeConfirm(); }}
        >
          <p id="caerus-cancel-desc" className="caerus-bookingdetail-confirm-msg">
            Cancel this booking? Your seats ({seatLabels}) will be released and may be
            booked by someone else. This cannot be undone.
          </p>
          <div className="caerus-bookingdetail-confirm-actions">
            <Button variant="danger" onClick={handleCancelConfirm} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Yes, cancel booking'}
            </Button>
            <Button variant="quiet" onClick={closeConfirm} disabled={cancelling}>
              Keep booking
            </Button>
          </div>
        </div>
      )}
    </Frame>
  );
}
