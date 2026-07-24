// Route: /admin/events/new 🔒👑 (wrapped in <ProtectedRoute adminOnly>). Creates a
// screening via POST /events (api-spec §3.2); the backend auto-generates its 60 seats
// (schema §3.3). This file owns form state, validation, the UTC conversion call and
// submit. The wall-clock -> UTC conversion itself lives in utils/format.js.
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { createEvent, ApiError } from '../../api/client';
import { localCinemaToUtcIso } from '../../utils/format';
import Button from '../../components/ui/Button.jsx';
import FormError from '../../components/ui/FormError.jsx';
import './CreateEvent.css';

const FIELD_NAMES = ['title', 'description', 'startsAt', 'durationMinutes', 'auditorium', 'price'];

// "2026-08-30T12:30:00Z" -> "2026-08-30 12:30 UTC" for the sanity-check echo line.
function utcStamp(iso) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export default function CreateEvent() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(''); // datetime-local, cinema wall-clock
  const [durationMinutes, setDurationMinutes] = useState('');
  const [auditorium, setAuditorium] = useState('');
  const [price, setPrice] = useState('');

  const [errors, setErrors] = useState({}); // per-field messages
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // synchronous double-submit guard

  // The UTC the API will actually receive — shown back to the admin, and reused on submit.
  const resolvedUtc = useMemo(() => localCinemaToUtcIso(startsAt), [startsAt]);

  // Mirror the DB CHECK constraints so the admin gets feedback before a round trip.
  function validate() {
    const e = {};
    if (!title.trim()) e.title = 'Title is required.';
    if (!auditorium.trim()) e.auditorium = 'Auditorium is required.';

    if (durationMinutes === '') e.durationMinutes = 'Duration is required.';
    else if (!Number.isInteger(Number(durationMinutes)) || Number(durationMinutes) <= 0) {
      e.durationMinutes = 'Duration must be a whole number of minutes greater than 0.';
    }

    if (price === '') e.price = 'Price is required.';
    else if (!Number.isInteger(Number(price)) || Number(price) < 0) {
      e.price = 'Price must be a whole number of đồng (0 or more).';
    }

    if (!startsAt) e.startsAt = 'Start time is required.';
    else if (!resolvedUtc) e.startsAt = 'Enter a valid date and time.';
    else if (new Date(resolvedUtc).getTime() <= Date.now()) {
      e.startsAt = 'Screenings must be in the future.';
    }
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setFormError('');

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return; // block; nothing leaves the browser

    if (submittingRef.current) return; // a fast second click can't create a duplicate
    submittingRef.current = true;
    setSubmitting(true);

    try {
      await createEvent({
        title: title.trim(),
        description: description.trim(),
        startsAt: resolvedUtc, // ISO-8601 UTC, converted from cinema local time
        durationMinutes: Number(durationMinutes),
        auditorium: auditorium.trim(),
        price: Number(price),
      });
      // The list reads ?created=1 once and shows a success banner (same as elsewhere).
      navigate('/admin/events?created=1');
    } catch (err) {
      handleError(err);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleError(err) {
    if (err instanceof ApiError) {
      if (err.code === 'VALIDATION_ERROR') {
        setFormError('Please check the highlighted fields.');
        // The documented error shape is just { code, message }; if the backend ever
        // pinpoints a field, surface it there too.
        if (typeof err.field === 'string' && FIELD_NAMES.includes(err.field)) {
          setErrors((prev) => ({ ...prev, [err.field]: 'The server rejected this value.' }));
        }
        return;
      }
      if (err.code === 'UNAUTHORIZED') {
        navigate('/login', { state: { from: '/admin/events/new' } });
        return;
      }
      if (err.code === 'FORBIDDEN') {
        setFormError('You don’t have permission to create screenings.');
        return;
      }
    }
    setFormError('Couldn’t create the screening. Please try again.');
  }

  // aria-describedby helper: join the hint/error ids that actually exist.
  const describedBy = (id, hasHint, hasError) =>
    [hasHint && `${id}-hint`, hasError && `${id}-err`].filter(Boolean).join(' ') || undefined;

  return (
    <main className="caerus-container caerus-createevent">
      <div className="caerus-createevent-inner">
        <Button as={Link} to="/admin/events" variant="quiet" className="caerus-createevent-back">
          ← Manage screenings
        </Button>
        <h1>Create screening</h1>

        <form className="caerus-createevent-form" onSubmit={handleSubmit} noValidate>
          <FormError>{formError}</FormError>

          <div className="caerus-textfield">
            <label className="caerus-textfield-label" htmlFor="ce-title">Title</label>
            <input
              className="caerus-textfield-input"
              id="ce-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={errors.title ? 'true' : undefined}
              aria-describedby={describedBy('ce-title', false, !!errors.title)}
            />
            {errors.title && <p className="caerus-createevent-fielderror" id="ce-title-err" role="alert">{errors.title}</p>}
          </div>

          <div className="caerus-textfield">
            <label className="caerus-textfield-label" htmlFor="ce-desc">Description <span className="caerus-createevent-optional">(optional)</span></label>
            <textarea
              className="caerus-textfield-input caerus-createevent-textarea"
              id="ce-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="caerus-textfield">
            <label className="caerus-textfield-label" htmlFor="ce-starts">Start (cinema local time)</label>
            <input
              className="caerus-textfield-input"
              id="ce-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              aria-invalid={errors.startsAt ? 'true' : undefined}
              aria-describedby={describedBy('ce-starts', true, !!errors.startsAt)}
            />
            <div className="caerus-createevent-hint" id="ce-starts-hint">
              <span>Local cinema time (GMT+7)</span>
              {resolvedUtc && <span className="caerus-createevent-utc">Saves as {utcStamp(resolvedUtc)}</span>}
            </div>
            {errors.startsAt && <p className="caerus-createevent-fielderror" id="ce-starts-err" role="alert">{errors.startsAt}</p>}
          </div>

          <div className="caerus-textfield">
            <label className="caerus-textfield-label" htmlFor="ce-duration">Duration (minutes)</label>
            <input
              className="caerus-textfield-input"
              id="ce-duration"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              aria-invalid={errors.durationMinutes ? 'true' : undefined}
              aria-describedby={describedBy('ce-duration', false, !!errors.durationMinutes)}
            />
            {errors.durationMinutes && <p className="caerus-createevent-fielderror" id="ce-duration-err" role="alert">{errors.durationMinutes}</p>}
          </div>

          <div className="caerus-textfield">
            <label className="caerus-textfield-label" htmlFor="ce-auditorium">Auditorium</label>
            <input
              className="caerus-textfield-input"
              id="ce-auditorium"
              value={auditorium}
              onChange={(e) => setAuditorium(e.target.value)}
              placeholder="Room 1"
              aria-invalid={errors.auditorium ? 'true' : undefined}
              aria-describedby={describedBy('ce-auditorium', false, !!errors.auditorium)}
            />
            {errors.auditorium && <p className="caerus-createevent-fielderror" id="ce-auditorium-err" role="alert">{errors.auditorium}</p>}
          </div>

          <div className="caerus-textfield">
            <label className="caerus-textfield-label" htmlFor="ce-price">Price per seat (VND)</label>
            <input
              className="caerus-textfield-input"
              id="ce-price"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-invalid={errors.price ? 'true' : undefined}
              aria-describedby={describedBy('ce-price', true, !!errors.price)}
            />
            <p className="caerus-createevent-hint" id="ce-price-hint">Whole đồng, e.g. 90000</p>
            {errors.price && <p className="caerus-createevent-fielderror" id="ce-price-err" role="alert">{errors.price}</p>}
          </div>

          {/* Poster upload is stubbed. POST /events/:id/banner is not built yet (needs
              S3). When it lands, the flow is: create the event (get its id from the
              201), THEN upload the file to /events/:id/banner — client.js request()
              already handles FormData, so no multipart work is added here now. */}
          <section className="caerus-createevent-banner" aria-labelledby="ce-poster-h">
            <h2 className="caerus-createevent-banner-title" id="ce-poster-h">Poster</h2>
            <div className="caerus-createevent-dropzone">
              <input type="file" accept="image/png,image/jpeg" disabled aria-label="Poster upload (coming soon)" />
              <p className="caerus-createevent-dropzone-text">Poster upload arrives with the S3 release.</p>
            </div>
            <p className="caerus-createevent-hint">Portrait 2:3 image (e.g. 400×600).</p>
          </section>

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create screening'}
          </Button>
        </form>
      </div>
    </main>
  );
}
