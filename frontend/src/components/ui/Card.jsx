import './Card.css';

// Neutral surface panel. Extra classes and props (role, etc.) pass through.
export default function Card({ className = '', children, ...rest }) {
  return (
    <div className={`caerus-card ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
