import { Providers, ProviderState } from '@microsoft/mgt-element';
import * as Constants from '../common/constants';

export async function getToken(): Promise<string> {
  const provider = Providers.globalProvider;
  if (provider && provider.state === ProviderState.SignedIn) {
    return provider.getAccessToken({ scopes: ['https://graph.microsoft.com/.default'] });
  }

  const storedUser = localStorage.getItem('current_user');
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      if (user?.id) {
        return String(user.id);
      }
    } catch {}
  }

  throw new Error('Not signed in');
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const storedUser = (() => {
    try {
      const raw = localStorage.getItem('current_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const res = await fetch(`${Constants.API_SERVER_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-User-UPN': (() => {
        const u = (Providers.globalProvider as any)?.account?.mail || 
                  (Providers.globalProvider as any)?.account?.userPrincipalName || 
                  (Providers.globalProvider as any)?.account?.username || 
                  (Providers.globalProvider as any)?.account?.idTokenClaims?.preferred_username || 
                  storedUser?.email ||
                  '';
        console.log(`[API] Fetching with X-User-UPN: "${u}"`);
        return u;
      })(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const d = await res.json(); detail = typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail ?? d); } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function logAudit(action: string, target: string, details = '', status = 'success') {
  apiFetch('/api/audit-logs', {
    method: 'POST',
    body: JSON.stringify({ action, actor: 'ui-user', target, details, status }),
  }).catch(() => {});
}
