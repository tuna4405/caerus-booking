// Decorative only. Real scannable code is generated on the PDF ticket in the
// serverless phase (api-spec §3.5). This never reads as scannable — no barcode/QR
// library, no check digits — it exists purely so the ticket stub isn't a blank
// placeholder, and so two different bookings visibly look like different tickets.
import './Barcode.css';

// Cycles the booking id's own digits out to a fixed length, so a short id still
// produces a full-height bar pattern / code string instead of a couple of stripes.
function expandDigits(id, length) {
  const base = String(Math.abs(Number(id) || 0)).split('');
  return Array.from({ length }, (_, i) => Number(base[i % base.length]));
}

// Groups a digit sequence into space-separated chunks; the chunk size (2 or 3)
// also comes from the digits, so the printed code isn't a uniform grid.
function codeStringFrom(digits) {
  const groups = [];
  let i = 0;
  while (i < digits.length) {
    const size = 2 + (digits[i] % 2);
    groups.push(digits.slice(i, i + size).join(''));
    i += size;
  }
  return groups.join(' ');
}

export default function Barcode({ id }) {
  // The bars are built directly in their final stacked-stripe form — the same
  // pattern a row of vertical barcode bars traces out once rotated 90° into the
  // stub, just without any CSS transform math to get there.
  const bars = expandDigits(id, 26);
  const code = codeStringFrom(expandDigits(id, 18));

  return (
    <div className="caerus-barcode" aria-hidden="true">
      <span className="caerus-barcode-code">{code}</span>
      <span className="caerus-barcode-bars">
        {bars.map((d, i) => (
          <span
            key={i}
            className="caerus-barcode-bar"
            style={{ height: `calc(var(--ticket-barcode-unit) * ${1 + (d % 4)})` }}
          />
        ))}
      </span>
    </div>
  );
}
