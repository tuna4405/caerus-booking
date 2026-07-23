import './FormError.css';

// Inline form-level error banner. Renders nothing when there's no message,
// so callers can pass a possibly-empty string. role="alert" announces it.
export default function FormError({ children }) {
  if (!children) return null;
  return (
    <p className="caerus-formerror" role="alert">
      {children}
    </p>
  );
}
