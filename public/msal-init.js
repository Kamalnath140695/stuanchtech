// This script runs BEFORE React initializes to handle MSAL redirects
// It prevents the hash from being cleared by React Router

(function() {
  console.log('[Pre-Init] Checking for MSAL redirect...');
  console.log('[Pre-Init] Current URL:', window.location.href);
  
  const hash = window.location.hash;
  const hasCode = hash.includes('code=');
  const hasIdToken = hash.includes('id_token=');
  const hasAccessToken = hash.includes('access_token=');
  
  console.log('[Pre-Init] Has code:', hasCode);
  console.log('[Pre-Init] Has id_token:', hasIdToken);
  console.log('[Pre-Init] Has access_token:', hasAccessToken);
  
  if (hasCode || hasIdToken || hasAccessToken) {
    console.log('[Pre-Init] MSAL redirect detected - redirecting to auth-callback');
    sessionStorage.setItem('msal_redirect_hash', hash);
    sessionStorage.setItem('msal_redirect_detected', 'true');
    
    // Immediately redirect to auth-callback with the hash
    if (window.location.pathname !== '/auth-callback') {
      console.log('[Pre-Init] Redirecting to /auth-callback');
      window.location.href = '/auth-callback' + hash;
    }
  }
})();
