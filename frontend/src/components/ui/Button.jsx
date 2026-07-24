import './Button.css';

// The one button in the app. Pick a variant; never restyle a button per page.
//   action    — filled yellow, compact (navbar / inline actions)
//   primary   — filled yellow, generous padding (prominent form submits)
//   secondary — outlined blue-teal, fills on hover
//   danger    — filled red, for destructive actions (cancel booking)
//   quiet     — text-only action (no border or background)
//
// Renders a <button> by default. Pass `as` (e.g. a react-router Link) for
// navigation actions, so they stay real links while sharing button styling:
//   <Button as={Link} to="/register" variant="action">Register</Button>
export default function Button({
  as: Component = 'button',
  variant = 'action',
  type,
  className = '',
  children,
  ...rest
}) {
  const classes = `caerus-button caerus-button--${variant} ${className}`.trim();
  // Only a native <button> takes a `type`; don't leak it onto a link/other tag.
  const nativeProps = Component === 'button' ? { type: type ?? 'button' } : {};
  return (
    <Component className={classes} {...nativeProps} {...rest}>
      {children}
    </Component>
  );
}
