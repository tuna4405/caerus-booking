import { Link } from 'react-router-dom';

export default function Navbar() {
  // TODO: show login/logout state from AuthContext
  return (
    <nav>
      <Link to="/">Caerus</Link>
      {' | '}
      <Link to="/my-bookings">My Bookings</Link>
      {' | '}
      <Link to="/login">Login</Link>
    </nav>
  );
}
