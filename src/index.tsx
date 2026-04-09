import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// CRITICAL: Save the MSAL hash before React processes the URL
// This is necessary because MSAL uses the hash (#) for token responses
// and React Router may clear it before MSAL can process it
const saveMSALHash = () => {
  const hash = window.location.hash;
  
  // Check if this is an MSAL redirect (has code or id_token in hash)
  if (hash && (hash.includes('code=') || hash.includes('id_token='))) {
    console.log('[Preload] Saving MSAL hash from URL:', hash.substring(0, 50) + '...');
    sessionStorage.setItem('msal_redirect_hash', hash);
  }
  
  // Also save state if present
  const urlParams = new URLSearchParams(hash.substring(1));
  const state = urlParams.get('state');
  if (state) {
    sessionStorage.setItem('msal_redirect_state', state);
    console.log('[Preload] Saving MSAL state');
  }
};

// Run immediately before React loads
saveMSALHash();

// Remove StrictMode to prevent double-rendering which breaks MSAL
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <App />
);

reportWebVitals();
