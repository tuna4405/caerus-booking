// Caerus logo. Built to accept a real file later: swap in the real brand mark by
// replacing ONLY src/assets/logo.svg — no edits to this component or any JSX are
// needed, because the import below resolves to whatever that file contains.
import logo from '../assets/logo.svg';
import './Logo.css';

export default function Logo() {
  return <img className="caerus-logo" src={logo} alt="Caerus" />;
}
