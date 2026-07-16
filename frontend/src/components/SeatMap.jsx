// Props: { seats, selectedSeatIds, onToggleSeat } — seats shape from
// GET /events/:id/seats (docs/api-spec.md §3.3)
export default function SeatMap({ seats = [], selectedSeatIds = [], onToggleSeat }) {
  // TODO: render a 6x10 grid, disable/highlight booked seats, call
  // onToggleSeat(seatId) on click
  return <div className="seat-map">TODO: SeatMap ({seats.length} seats)</div>;
}
