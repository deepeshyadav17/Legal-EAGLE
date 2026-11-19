import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as authService from '../services/authService';
import UnauthorizedPage from '../pages/public/UnauthorizedPage';

/**
 * Route guard enforcing signed session validity and role-based access control (RBAC)
 * alongside backend JWT + RBAC middleware.
 */
export default function ProtectedRoute({ roles }) {
  const { user, logout, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return (
      <div className="grid min-h-[40vh] place-items-center" role="status" aria-label="Restoring session">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-navy" />
      </div>
    );
  }

  // Verify the underlying signed session has not expired or been tampered with
  const verifiedUser = authService.getSessionUser();
  if (!user || !verifiedUser) {
    if (user && !verifiedUser) {
      logout();
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(verifiedUser.role)) {
    return <UnauthorizedPage requiredRoles={roles} />;
  }

  return <Outlet />;
}
