import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMsalInstance, handleRedirectResult, getCurrentUser } from '../services/authService';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [userName, setUserName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const processAuth = async () => {
      console.log('[AuthCallback] Processing Microsoft redirect...');
      console.log('[AuthCallback] Current URL:', window.location.href);

      // Restore saved MSAL hash if present (from index.tsx)
      const savedHash = sessionStorage.getItem('msal_redirect_hash');
      if (savedHash) {
        console.log('[AuthCallback] Restoring saved hash');
        window.location.hash = savedHash;
        sessionStorage.removeItem('msal_redirect_hash');
        sessionStorage.removeItem('msal_redirect_state');
      }

      try {
        // Get MSAL instance and process redirect
        const instance = await getMsalInstance();
        const result = await instance.handleRedirectPromise();

        if (!result || !result.account) {
          throw new Error('No valid authentication result');
        }

        instance.setActiveAccount(result.account);

        // Use service to sync with backend/DB (handles fetch, storeUser, events)
        const authResult = await handleRedirectResult();
        if (!authResult) {
          throw new Error('Backend auth sync failed');
        }

        // Get the stored user data
        const user = getCurrentUser();
        if (!user) {
          throw new Error('User data not stored after auth');
        }

        console.log('[AuthCallback] Auth success, user:', user.name, user.role);

        setUserName(user.name);
        setStatus('success');

        // Role-based dashboard (normalize backend roles)
        let dashboard = '/user/homepage';
        const role = user.role as string;
        if (role === 'PendingApproval') {
          dashboard = '/login/pendingapprovaluser';
        } else if (role === 'GlobalAdmin' || role === 'GLOBAL_ADMIN') {
          dashboard = '/globaladmin/homepage';
        } else if (role === 'UserAdmin' || role === 'USER_ADMIN') {
          dashboard = '/useradmin/homepage';
        }

        console.log('[AuthCallback] Navigating to:', dashboard);

        // SPA-safe navigation - no race condition
        navigate(dashboard, { replace: true });

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Authentication failed. Redirecting to login.');
          setTimeout(() => navigate('/login', { replace: true }), 3000);
        }
      }
    };

    processAuth();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (status === 'loading') {
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
            <Loader2 size={48} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
            Completing Sign In
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
            Verifying your Microsoft account and setting up your dashboard...
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

  if (status === 'success') {
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
          maxWidth: '450px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <CheckCircle size={44} color="white" />
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
            Welcome, {userName}!
          </h2>
          <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '8px' }}>
            Authentication successful. Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

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
        maxWidth: '450px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <AlertCircle size={44} color="white" />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626', marginBottom: '12px' }}>
          Sign In Failed
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
          {errorMessage}
        </p>
        <p style={{ fontSize: '13px', color: '#94a3b8' }}>
          Redirecting to login...
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;

