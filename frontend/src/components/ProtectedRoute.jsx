import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

// Gate for routes that need a session. `adminOnly` additionally requires role 'admin'.
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, initializing } = useAuth();
  const location = useLocation();

  // Still reading localStorage — render nothing rather than bounce on refresh.
  if (initializing) return null;

  // Pass the bounced-from location so login can return the user here.
  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return children;
}
