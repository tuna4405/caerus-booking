import './TimeZoneNote.css';

// Small muted "(GMT+7)" tag to sit beside a prominently displayed showtime so
// the cinema's timezone is explicit. Drop it in next to the time on the event
// detail and booking detail screens (which render times prominently).
export default function TimeZoneNote() {
  return <span className="caerus-tz-note">(GMT+7)</span>;
}
