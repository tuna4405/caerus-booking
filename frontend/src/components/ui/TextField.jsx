import './TextField.css';

// Labelled text input. `id` wires the <label> to the <input> for a11y.
// value/onChange/type/required/autoComplete etc. pass through via ...rest.
export default function TextField({ id, label, type = 'text', className = '', ...rest }) {
  return (
    <div className={`caerus-textfield ${className}`.trim()}>
      <label className="caerus-textfield-label" htmlFor={id}>
        {label}
      </label>
      <input className="caerus-textfield-input" id={id} type={type} {...rest} />
    </div>
  );
}
