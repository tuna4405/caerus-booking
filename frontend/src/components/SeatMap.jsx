// Props: { seats, selectedIds, conflictIds, onToggle, disabled } — seats shape
// from GET /events/:id/seats (docs/api-spec.md §3.3). Pure presentation: no
// fetching, no routing. EventDetail owns all state.
import './SeatMap.css';

// State precedence: a conflicting seat (someone just took it) wins over booked,
// which wins over the user's own selection.
function seatStateOf(seat, selectedIds, conflictIds) {
  if (conflictIds.includes(seat.id)) return 'conflict';
  if (seat.status === 'booked') return 'booked';
  if (selectedIds.includes(seat.id)) return 'selected';
  return 'available';
}

const STATE_LABEL = {
  available: 'available',
  selected: 'selected',
  booked: 'already booked',
  conflict: 'unavailable',
};

// The API sends seats ordered by row then number — group consecutively, don't re-sort.
function groupByRow(seats) {
  const rows = [];
  let current = null;
  for (const seat of seats) {
    if (!current || current.row !== seat.row) {
      current = { row: seat.row, seats: [] };
      rows.push(current);
    }
    current.seats.push(seat);
  }
  return rows;
}

export default function SeatMap({
  seats = [],
  selectedIds = [],
  conflictIds = [],
  onToggle,
  disabled = false,
}) {
  const rows = groupByRow(seats);
  const hasConflicts = conflictIds.length > 0;

  return (
    <div className="caerus-seatmap">
      {/* Orients the user — row A is nearest the screen. A stroked SVG arc gives a
          constant-thickness curved band (a filled shape would read as a dome). */}
      <div className="caerus-seatmap-screen">
        <span className="caerus-seatmap-screen-label">SCREEN</span>
        <svg
          className="caerus-seatmap-screen-arc"
          viewBox="0 0 800 60"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M 4 52 Q 400 -2 796 52"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="caerus-seatmap-grid" role="group" aria-label="Seat map">
        {rows.map((r) => (
          <div className="caerus-seatmap-row" key={r.row}>
            <span className="caerus-seatmap-rowlabel" aria-hidden="true">{r.row}</span>
            {r.seats.map((seat) => {
              const state = seatStateOf(seat, selectedIds, conflictIds);
              const seatDisabled = disabled || state === 'booked' || state === 'conflict';
              return (
                <button
                  key={seat.id}
                  type="button"
                  className={`caerus-seat caerus-seat--${state}`}
                  aria-label={`Row ${seat.row} seat ${seat.number}, ${STATE_LABEL[state]}`}
                  aria-pressed={state === 'selected'}
                  disabled={seatDisabled}
                  onClick={() => onToggle(seat.id)}
                >
                  {seat.number}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <ul className="caerus-seatmap-legend">
        <li>
          <span className="caerus-seat-swatch caerus-seat--available" aria-hidden="true" /> Available
        </li>
        <li>
          <span className="caerus-seat-swatch caerus-seat--selected" aria-hidden="true" /> Selected
        </li>
        <li>
          <span className="caerus-seat-swatch caerus-seat--booked" aria-hidden="true" /> Booked
        </li>
        {hasConflicts && (
          <li>
            <span className="caerus-seat-swatch caerus-seat--conflict" aria-hidden="true" /> Unavailable just now
          </li>
        )}
      </ul>
    </div>
  );
}
