// Google OAuth Configuration
// Uses Google Identity Services (GIS) for OAuth 2.0

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 
                                 process.env.REACT_APP_GOOGLE_CLIENT_ID || 
                                 '34136734678-3vjbmtrjvo6m4ere5v7iktdfq5lt15n1.apps.googleusercontent.com';

export const GOOGLE_REDIRECT_URI = window.location.origin + '/auth-callback';

const buildGoogleAuthUrl = () => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'id_token token');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('nonce', Math.random().toString(36));
  return authUrl;
};

// OAuth 2.0 same-window redirect flow
export const redirectToGoogleLogin = () => {
  const authUrl = buildGoogleAuthUrl();
  window.location.assign(authUrl.toString());
};

// Legacy popup flow kept as fallback
export const initiateGoogleLogin = () => {
  const authUrl = buildGoogleAuthUrl();
  const width = 500;
  const height = 600;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;
  
  const popup = window.open(
    authUrl.toString(),
    'Google Sign-In',
    `width=${width},height=${height},left=${left},top=${top}`
  );
  
  return popup;
};

declare global {
  interface Window {
    google?: any;
  }
}
