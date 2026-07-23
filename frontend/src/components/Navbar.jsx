import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import Button from './ui/Button.jsx';
import './Navbar.css';

export default function Navbar() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();

  return (
    <header className="caerus-navbar">
      <div className="caerus-container caerus-navbar-row">
        {/* LEFT — logo, links home */}
        <div className="caerus-navbar-left">
          <Link to="/" className="caerus-navbar-logo-link" aria-label="Caerus home">
            <Logo />
          </Link>
        </div>

        {/* CENTER — primary nav. NavLink auto-adds `.active` + aria-current="page". */}
        <nav className="caerus-navbar-center" aria-label="Main">
          <NavLink to="/" end className="caerus-navbar-link">
            Home
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/my-bookings" className="caerus-navbar-link">
              My bookings
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin/events" className="caerus-navbar-link">
              Manage events
            </NavLink>
          )}
        </nav>

        {/* RIGHT — auth actions */}
        <div className="caerus-navbar-right">
          {isAuthenticated ? (
            <>
              <span className="caerus-navbar-user">{user?.name}</span>
              <Button variant="secondary" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button as={Link} to="/login" variant="quiet">
                Log in
              </Button>
              <Button as={Link} to="/register" variant="action">
                Register
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
