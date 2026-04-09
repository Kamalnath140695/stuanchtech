import { PublicClientApplication, AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../config/msalConfig';
import { initiateGoogleLogin, redirectToGoogleLogin } from '../config/googleConfig';

export interface DMSUser {
  id?: number;
  entra_id: string;
  email: string;
  name: string;
  role: 'GlobalAdmin' | 'UserAdmin' | 'NormalUser' | 'PendingApproval';
  created_date: string;
  is_guest?: boolean;
  dashboard?: string;
}

export interface GraphProfile {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  officeLocation?: string;
}

let msalInstance: PublicClientApplication | null = null;
let isInitializing = false;

export const getMsalInstance = async (): Promise<PublicClientApplication> => {
  if (msalInstance && !isInitializing) {
    console.log('[MSAL] Returning existing instance');
    return msalInstance;
  }
  if (isInitializing) {
    console.log('[MSAL] Waiting for initialization...');
    while (isInitializing) await new Promise(r => setTimeout(r, 100));
    return msalInstance!;
  }
  isInitializing = true;
  console.log('[MSAL] Creating new instance...');
  try {
    msalInstance = new PublicClientApplication(msalConfig);
    console.log('[MSAL] Initializing...');
    await msalInstance.initialize();
    console.log('[MSAL] Initialized successfully');
    return msalInstance;
  } catch (error) {
    console.error('[MSAL] Initialization error:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
};

/**
 * Initiates redirect login for Microsoft
 */
export const loginRedirect = async (): Promise<void> => {
  console.log('[MSAL] Starting Microsoft redirect login...');

  // Clear any existing MSAL interaction state to prevent "interaction_in_progress" errors
  console.log('[MSAL] Clearing existing interaction state...');
  sessionStorage.removeItem('msal.interaction.status');
  sessionStorage.removeItem('msal_interaction_in_progress');
  sessionStorage.removeItem('msal.redirect.hash');
  sessionStorage.removeItem('msal.redirect.state');

  // Get the MSAL instance
  const instance = await getMsalInstance();

  sessionStorage.setItem('sso_provider', 'microsoft');

  // Explicitly pass the redirectUri to ensure it goes to /auth-callback
  await instance.loginRedirect({
    scopes: loginRequest.scopes,
    prompt: 'select_account',
    redirectUri: msalConfig.auth.redirectUri,
  });
};

/**
 * Must be called on app load to handle the redirect response.
 * Returns the Graph profile + synced DB user if a redirect just completed.
 */
export const handleRedirectResult = async (): Promise<{
  graphProfile: GraphProfile;
  dbUser: DMSUser;
} | null> => {
  const instance = await getMsalInstance();
  const hashToProcess = sessionStorage.getItem('msal_redirect_hash') || window.location.hash;
  let result: AuthenticationResult | null = null;
  try {
    console.log('[MSAL] handleRedirectPromise hash source:', hashToProcess ? 'saved/current hash found' : 'no hash found');
    result = await instance.handleRedirectPromise(
      hashToProcess
        ? {
            hash: hashToProcess,
            navigateToLoginRequestUrl: false,
          }
        : undefined
    );
  } catch (e) {
    console.error('Redirect error:', e);
    sessionStorage.removeItem('msal_interaction_in_progress');
    return null;
  }

  sessionStorage.removeItem('msal_interaction_in_progress');
  if (!result) return null;

  instance.setActiveAccount(result.account);

  // Fetch Graph profile with the access token
  const graphProfile = await fetchGraphProfile(result.accessToken);

  // Sync to MySQL
  const provider = (sessionStorage.getItem('sso_provider') as 'microsoft' | 'google') || 'microsoft';
  sessionStorage.removeItem('sso_provider');

  const dbUser = await ssoSyncToMySQL(
    graphProfile.displayName || result.account.name || '',
    graphProfile.mail || graphProfile.userPrincipalName || result.account.username,
    provider
  );

  return { graphProfile, dbUser };
};

/**
 * Fetch Microsoft Graph /me profile using an access token
 */
export const fetchGraphProfile = async (accessToken?: string): Promise<GraphProfile> => {
  let token = accessToken;
  if (!token) {
    const instance = await getMsalInstance();
    const account = instance.getActiveAccount();
    if (!account) throw new Error('No active account');
    const resp = await instance.acquireTokenSilent({ scopes: loginRequest.scopes, account });
    token = resp.accessToken;
  }
  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle,officeLocation', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Graph profile');
  return res.json();
};

/**
 * Sync SSO user to MySQL backend and store locally
 * Called from handleRedirectResult after Graph profile fetch
 */
export const ssoSyncToMySQL = async (name: string, email: string, provider: 'microsoft' | 'google'): Promise<DMSUser> => {
  const instance = await getMsalInstance();
  const account = instance.getActiveAccount();
  if (!account) throw new Error('No active MSAL account for token acquisition');

  // Acquire tokens silently for backend
  const tokenResponse = await instance.acquireTokenSilent({
    scopes: loginRequest.scopes,
    account,
  });

  if (!tokenResponse.idToken || !tokenResponse.accessToken) {
    throw new Error('Failed to acquire tokens silently');
  }

  // Call backend Microsoft auth endpoint (handles upsert/role assignment)
  const API_BASE = 'http://localhost:8000/api/auth';
  const response = await fetch(`${API_BASE}/microsoft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken: tokenResponse.idToken,
      accessToken: tokenResponse.accessToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `Backend auth failed: ${response.status}`);
  }

  const data = await response.json();

  // Normalize backend roles to frontend DMSUser format
  let normalizedRole: DMSUser['role'] = 'NormalUser';
  switch (data.role) {
    case 'GLOBAL_ADMIN':
    case 'GlobalAdmin':
      normalizedRole = 'GlobalAdmin';
      break;
    case 'USER_ADMIN':
    case 'UserAdmin':
      normalizedRole = 'UserAdmin';
      break;
    case 'USER':
      normalizedRole = 'NormalUser';
      break;
    case 'PendingApproval':
      normalizedRole = 'PendingApproval';
      break;
    default:
      normalizedRole = 'NormalUser';
  }

  // Use storeUser to save and dispatch events
  const dbUser: DMSUser = {
    id: parseInt(data.id?.toString() || '0'),
    entra_id: data.id?.toString() || '',
    email: data.email,
    name: data.name,
    role: normalizedRole,
    created_date: new Date().toISOString(),
    dashboard: data.dashboard || getDashboardByRole(normalizedRole),
  };

  storeUser({
    id: parseInt(data.id?.toString() || '0'),
    name: data.name,
    email: data.email,
    role: normalizedRole,
    auth_provider: provider,
    dashboard: data.dashboard,
  });

  console.log(`[SSO Sync] ${provider} user synced:`, { email, role: normalizedRole });
  return dbUser;
};

export const logout = async (): Promise<void> => {
  console.log('[Auth] Starting logout process...');

  // Always clear local storage first (for all login types)
  console.log('[Auth] Clearing local storage...');
  localStorage.removeItem('current_user');
  localStorage.removeItem('adminRole');
  sessionStorage.clear();

  // Clear MSAL instance and cache
  if (msalInstance) {
    console.log('[Auth] Clearing MSAL cache...');
    try {
      msalInstance = null;
      // Clear MSAL's cached accounts from session storage
      sessionStorage.removeItem('msal.interaction.status');
      sessionStorage.removeItem('msal.client.info');
    } catch (e) {
      console.error('[Auth] Error clearing MSAL:', e);
    }
  }

  // Dispatch logout event for other components to react
  window.dispatchEvent(new CustomEvent('app-logout'));

  // Navigate to login page
  console.log('[Auth] Redirecting to login...');
  window.location.href = '/login';
};

export const getCurrentAccount = (): AccountInfo | null => {
  if (!msalInstance) return null;
  return msalInstance.getActiveAccount();
};

export const getCurrentUser = (): DMSUser | null => {
  try {
    const s = localStorage.getItem('current_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
};

export const hasPendingApproval = (): boolean =>
  sessionStorage.getItem('pending_approval') === 'true';

export const getStorageWarning = (): any => {
  try {
    const w = sessionStorage.getItem('storage_warning');
    return w ? JSON.parse(w) : null;
  } catch { return null; }
};

export const clearStorageWarning = (): void =>
  sessionStorage.removeItem('storage_warning');

// ── MySQL-backed auth ──────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000/api/auth';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  auth_provider: string;
  dashboard?: string;
}

export const getDashboardByRole = (role?: string): string => {
  switch (role) {
    case 'PendingApproval':
      return '/login/pendingapprovaluser';
    case 'GLOBAL_ADMIN':
    case 'GlobalAdmin':
      return '/globaladmin/homepage';
    case 'USER_ADMIN':
    case 'UserAdmin':
      return '/useradmin/homepage';
    case 'USER':
    case 'User':
    case 'NormalUser':
    default:
      return '/user/homepage';
  }
};

const storeUser = (data: AuthUser): DMSUser => {
  // Normalize role names
  let normalizedRole = data.role;
  if (normalizedRole === 'User') normalizedRole = 'NormalUser';
  const dashboard = data.dashboard || getDashboardByRole(normalizedRole);
  
  const userData: DMSUser = { 
    id: data.id,
    entra_id: data.id?.toString() || '', 
    email: data.email,
    name: data.name,
    role: normalizedRole as DMSUser['role'],
    created_date: new Date().toISOString(),
    dashboard,
  };
  
  localStorage.setItem('current_user', JSON.stringify(userData));
  localStorage.setItem('adminRole', normalizedRole);
  
  if (normalizedRole === 'PendingApproval') {
    sessionStorage.setItem('pending_approval', 'true');
  } else {
    sessionStorage.removeItem('pending_approval');
  }
  
  // Trigger storage event for cross-tab/component sync
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('auth-state-changed'));
  
  return userData;
};

/**
 * Google SSO using popup flow
 * Opens a popup for Google OAuth and returns the authentication result
 */
export const loginWithGoogle = (): Promise<{
  idToken: string;
  accessToken: string;
  email: string;
  name: string;
  picture?: string;
}> => {
  return new Promise((resolve, reject) => {
    // Open Google popup
    const popup = initiateGoogleLogin();
    if (!popup) {
      reject(new Error('Failed to open Google login popup'));
      return;
    }

    let finished = false;
    const storageKey = 'google_login_result';

    const tryConsumeStoredResult = (): boolean => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return false;
      }

      try {
        const payload = JSON.parse(raw);
        localStorage.removeItem(storageKey);
        cleanup();
        finished = true;

        if (payload?.error) {
          reject(new Error(payload.error));
        } else if (payload?.tokens) {
          resolve(payload.tokens);
        } else {
          reject(new Error('Invalid Google login result'));
        }
        return true;
      } catch {
        localStorage.removeItem(storageKey);
        return false;
      }
    };

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (popupMonitor) {
        window.clearInterval(popupMonitor);
      }
    };

    // Listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      // Make sure the message is from the popup we opened
      if (event.source !== popup) {
        return;
      }

      if (!event.data || typeof event.data !== 'object') {
        cleanup();
        finished = true;
        reject(new Error('Invalid message from popup'));
        return;
      }

      const { type, error, tokens } = event.data;

      if (type === 'google_login_result') {
        cleanup();
        finished = true;
        if (error) {
          reject(new Error(error));
        } else if (tokens) {
          resolve(tokens);
        } else {
          reject(new Error('No tokens received from popup'));
        }
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey && !finished) {
        tryConsumeStoredResult();
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    // Safely detect if the user closes the popup before auth completes.
    const popupMonitor = window.setInterval(() => {
      if (!finished && popup.closed) {
        if (tryConsumeStoredResult()) {
          return;
        }
        cleanup();
        finished = true;
        reject(new Error('Google popup was closed before authentication completed'));
      }
    }, 500);
  });
};

export const loginWithGoogleRedirect = (): void => {
  sessionStorage.setItem('sso_provider', 'google');
  redirectToGoogleLogin();
};

export const microsoftAuth = async (idToken: string, accessToken: string): Promise<DMSUser> => {
  const res = await fetch(`${API_BASE}/microsoft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Microsoft auth failed.');
  const user = storeUser(data);
  console.log('Microsoft auth successful, user stored:', user);
  return user;
};
