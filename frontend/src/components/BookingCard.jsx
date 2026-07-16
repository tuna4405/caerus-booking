// Props: { booking } — shape from GET /bookings (docs/api-spec.md §3.4)
export default function BookingCard({ booking }) {
  // TODO: render event title, seats, totalPrice, status; cancel button
  return <div className="booking-card">{booking?.eventTitle ?? 'TODO: BookingCard'}</div>;
}
