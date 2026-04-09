import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * MSALHandler component that processes Microsoft authentication redirect responses.
 * Should be placed at the top of the component hierarchy to handle redirect flows.
 */
export default function MSALHandler({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    const hasMsalPayload = hash.includes('code=') || hash.includes('id_token=') || hash.includes('access_token=');
    const savedHash = sessionStorage.getItem('msal_redirect_hash');
    const isAuthCallback = location.pathname === '/auth-callback';

    console.log('[MSALHandler] Route check:', {
      pathname: location.pathname,
      hasMsalPayload,
      hasSavedHash: !!savedHash,
      isAuthCallback,
    });

    // If Microsoft returned to the wrong route with the auth hash, forward it to the callback route.
    if (!isAuthCallback && hasMsalPayload) {
      console.log('[MSALHandler] Redirect payload detected outside callback. Forwarding to /auth-callback');
      sessionStorage.setItem('msal_redirect_hash', hash);
      navigate('/auth-callback', { replace: true });
      return;
    }

    // If the app already preserved the auth hash but the browser lost it, ensure the callback route is used.
    if (!isAuthCallback && savedHash) {
      console.log('[MSALHandler] Saved redirect hash found outside callback. Forwarding to /auth-callback');
      navigate('/auth-callback', { replace: true });
    }
  }, [location.hash, location.pathname, navigate]);

  return <>{children}</>;
}
