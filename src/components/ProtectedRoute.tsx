import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import React from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuthentication?: boolean;
  allowedRoles?: string[];
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuthentication = true,
  allowedRoles,
  redirectTo = '/login',
}) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '48px 64px',
          maxWidth: '400px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
            Loading...
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
            Please wait while we check your authentication status.
          </p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // If authentication is required and user is not authenticated, redirect to login
  if (requireAuthentication && !currentUser) {
    return <Navigate to={redirectTo} replace />;
  }

  // If allowedRoles is specified and user doesn't have a matching role, redirect to unauthorized or specific page
  if (allowedRoles && currentUser) {
    if (!allowedRoles.includes(currentUser.role)) {
      // For PendingApproval users, redirect to pending approval page
      if (currentUser.role === 'PendingApproval') {
        return <Navigate to="/login/pendingapprovaluser" replace />;
      }
      // For other non-authorized roles, redirect to homepage or dashboard
      return <Navigate to="/user/homepage" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

