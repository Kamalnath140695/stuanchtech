import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getDashboardByRole, handleRedirectResult } from '../services/authService';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const processGoogleCallback = async (idToken: string, accessToken: string) => {
      try {
        const response = await fetch('http://localhost:8000/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken,
            accessToken,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Backend error: ${response.status}`);
        }

        const result = await response.json();
        const normalizedRole = result.role === 'GLOBAL_ADMIN'
          ? 'GlobalAdmin'
          : result.role === 'USER_ADMIN'
            ? 'UserAdmin'
            : result.role === 'PendingApproval'
              ? 'PendingApproval'
              : 'NormalUser';

        localStorage.setItem('current_user', JSON.stringify({
          id: result.id || 0,
          entra_id: result.entraId || '',
          email: result.email,
          name: result.name,
          role: normalizedRole,
          created_date: new Date().toISOString(),
          is_guest: result.is_guest,
          dashboard: result.dashboard,
        }));
        localStorage.setItem('adminRole', normalizedRole);
        if (normalizedRole === 'PendingApproval') {
          sessionStorage.setItem('pending_approval', 'true');
        } else {
          sessionStorage.removeItem('pending_approval');
        }
        sessionStorage.removeItem('sso_provider');
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('auth-state-changed'));

        navigate(result.dashboard || getDashboardByRole(normalizedRole), { replace: true });
      } catch (err) {
        console.error('[AuthCallback] Google auth error:', err);
        const message = err instanceof Error ? err.message : 'Google authentication failed';
        sessionStorage.setItem('last_auth_error', message);
        setErrorMessage(message);
        setStatus('error');
      }
    };

    const handleMicrosoftAuth = async () => {
      try {
        console.log('[AuthCallback] Processing Microsoft authentication...');
        console.log('[AuthCallback] Current URL:', window.location.href);

        const savedHash = sessionStorage.getItem('msal_redirect_hash');
        if (savedHash && !window.location.hash) {
          console.log('[AuthCallback] Restoring saved MSAL hash');
          window.location.hash = savedHash;
        }

        const result = await handleRedirectResult();
        const userData = result?.dbUser || getCurrentUser();

        sessionStorage.removeItem('msal_redirect_hash');
        sessionStorage.removeItem('msal_redirect_state');
        sessionStorage.removeItem('msal_redirect_detected');

        if (!userData) {
          const message = 'No authenticated Microsoft user was found after the callback completed.';
          console.log('[AuthCallback] ' + message);
          sessionStorage.setItem('last_auth_error', message);
          setErrorMessage(message);
          setStatus('error');
          return;
        }

        const dashboard = userData.dashboard || getDashboardByRole(userData.role);

        console.log('[AuthCallback] User authenticated successfully:', {
          email: userData.email,
          role: userData.role,
          dashboard,
        });

        navigate(dashboard, { replace: true });
      } catch (error) {
        console.error('[AuthCallback] Authentication error:', error);
        const message = error instanceof Error ? error.message : 'Authentication failed during Microsoft callback.';
        sessionStorage.setItem('last_auth_error', message);
        setErrorMessage(message);
        setStatus('error');
      }
    };

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');
    const accessToken = params.get('access_token');
    const error = params.get('error');
    const provider = sessionStorage.getItem('sso_provider');

    if (provider === 'google' && error) {
      sessionStorage.setItem('last_auth_error', error);
      setErrorMessage(error);
      setStatus('error');
      return;
    }

    if (provider === 'google' && idToken && accessToken) {
      console.log('[AuthCallback] Running Google redirect authentication flow');
      processGoogleCallback(idToken, accessToken);
      return;
    }

    if (window.opener) {
      console.log('[AuthCallback] Running Google popup authentication flow');

      if (error) {
        localStorage.setItem('google_login_result', JSON.stringify({
          error,
          timestamp: Date.now(),
        }));
        window.opener.postMessage({
          type: 'google_login_result',
          error,
        }, window.location.origin);
        window.close();
        return;
      }

      if (idToken && accessToken) {
        (async () => {
          try {
            const response = await fetch('http://localhost:8000/api/auth/google', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                idToken,
                accessToken,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.detail || `Backend error: ${response.status}`);
            }

            const result = await response.json();
            console.log('[AuthCallback] Google auth result:', result);

            localStorage.setItem('google_login_result', JSON.stringify({
              tokens: {
                idToken,
                accessToken,
                ...result,
              },
              timestamp: Date.now(),
            }));

            window.opener.postMessage({
              type: 'google_login_result',
              tokens: {
                idToken,
                accessToken,
                ...result,
              },
            }, window.location.origin);
          } catch (err: any) {
            console.error('[AuthCallback] Google auth error:', err);
            localStorage.setItem('google_login_result', JSON.stringify({
              error: err.message || 'Authentication failed',
              timestamp: Date.now(),
            }));
            window.opener.postMessage({
              type: 'google_login_result',
              error: err.message || 'Authentication failed',
            }, window.location.origin);
          } finally {
            setTimeout(() => {
              if (!window.closed) {
                window.close();
              }
            }, 500);
          }
        })();
        return;
      }
    }

    handleMicrosoftAuth();
  }, [navigate]);

  if (status === 'error') {
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
          padding: '32px',
          maxWidth: '720px',
          width: '100%',
          margin: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#b91c1c', margin: '0 0 12px 0' }}>
            Microsoft sign-in failed
          </h2>
          <p style={{ fontSize: '14px', color: '#334155', margin: '0 0 16px 0' }}>
            The app stayed on this page so we can capture the real callback error.
          </p>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#0f172a',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {errorMessage || 'Unknown authentication error'}
          </div>
          <div style={{
            background: '#0f172a',
            color: '#e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            URL: {window.location.href}
          </div>
          <button
            onClick={() => navigate('/login', { replace: true })}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Back to login
          </button>
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
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
          Signing you in...
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
          {window.opener ? 'Completing Google authentication...' : 'Please wait while we authenticate with Microsoft...'}
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
