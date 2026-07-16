// Props: { event } — shape from GET /events (docs/api-spec.md §3.2)
export default function EventCard({ event }) {
  // TODO: render title, startsAt, price, availableSeats; link to /events/:id
  return <div className="event-card">{event?.title ?? 'TODO: EventCard'}</div>;
}
