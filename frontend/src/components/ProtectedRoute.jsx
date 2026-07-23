import { Navigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

// Gate for routes that need a session. `adminOnly` additionally requires role 'admin'.
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, initializing } = useAuth();

  // Still reading localStorage — render nothing rather than bounce on refresh.
  if (initializing) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return children;
}
