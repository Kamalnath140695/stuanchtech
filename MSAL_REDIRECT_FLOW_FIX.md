# MSAL Redirect Flow - Fixed Implementation

## Problem: Login Loop
The original implementation caused an infinite loop because:
1. `handleRedirectPromise()` was not being called properly
2. Redundant login calls after redirect
3. Complex hash handling that was unnecessary for MSAL 2.x

## Correct MSAL Redirect Flow (NO LOOP)

```
Click "Continue with Microsoft"
        ↓
msal.loginRedirect()
        ↓
Microsoft login page
        ↓
Redirect back to /auth-callback
        ↓
handleRedirectPromise() ← Called ONCE
        ↓
Get account + email + name
        ↓
Send to backend /api/auth/microsoft
        ↓
Create/update DB user
        ↓
Store role in localStorage
        ↓
Redirect to dashboard
```

## Key Files Modified

### 1. Login.tsx - Microsoft Login Button
```typescript
const handleMicrosoftLogin = async () => {
  if (ssoLoading) return;
  setSsoLoading('microsoft');
  setError('');
  
  try {
    console.log('[Login] Starting Microsoft redirect login...');
    
    // This will redirect to Microsoft login page
    // After login, Microsoft redirects back to /auth-callback
    // AuthCallback.tsx handles the rest of the flow
    await loginRedirect('microsoft');
    
    // NOTE: loginRedirect() causes a redirect - code below this line will NOT execute
    
  } catch (err: any) {
    console.error('[Login] Microsoft login error:', err);
    setError(err.message || 'Microsoft login failed. Please try again.');
    setSsoLoading(null);
  }
};
```

**KEY POINT**: DO NOT call login again after redirect. Let `AuthCallback.tsx` handle everything.

### 2. AuthCallback.tsx - Handle Redirect (MOST IMPORTANT)
```typescript
useEffect(() => {
  const processAuth = async () => {
    console.log('[AuthCallback] Processing Microsoft redirect...');
    
    try {
      // STEP 1: Call handleRedirectPromise() to process the redirect
      const result = await handleMicrosoftRedirect();
      
      if (!result.success) {
        console.error('[AuthCallback] Redirect failed:', result.error);
        setStatus('error');
        setErrorMessage(result.error || 'Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // STEP 2: Send to backend
      const response = await fetch('http://localhost:8000/api/auth/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: result.email,
          name: result.name
        })
      });

      const userData = await response.json();

      // STEP 3: Store user data
      localStorage.setItem('current_user', JSON.stringify(userData));
      localStorage.setItem('adminRole', userData.role);
      
      setStatus('success');

      // STEP 4: Determine dashboard based on role
      let dashboard = '/user/homepage';
      if (userData.role === 'PendingApproval') {
        dashboard = '/login/pendingapprovaluser';
      } else if (userData.role === 'GlobalAdmin') {
        dashboard = '/globaladmin/homepage';
      } else if (userData.role === 'UserAdmin') {
        dashboard = '/useradmin/homepage';
      }

      // STEP 5: Navigate to dashboard
      setTimeout(() => {
        window.location.href = dashboard;
      }, 1500);

    } catch (err: any) {
      console.error('[AuthCallback] Error:', err);
      setStatus('error');
      setErrorMessage(err.message);
      setTimeout(() => navigate('/login'), 3000);
    }
  };

  processAuth();
}, [navigate]);
```

### 3. authService.ts - handleMicrosoftRedirect Function
```typescript
export const handleMicrosoftRedirect = async (): Promise<{
  success: boolean;
  account?: AccountInfo;
  email?: string;
  name?: string;
  error?: string;
}> => {
  console.log('[handleMicrosoftRedirect] Starting...');
  
  try {
    const instance = await getMsalInstance();
    
    // STEP 1: Call handleRedirectPromise() ONCE to process the redirect
    const response = await instance.handleRedirectPromise();
    
    console.log('[handleMicrosoftRedirect] handleRedirectPromise result:', response);
    
    // STEP 2: If no response, this was NOT a redirect - check existing accounts
    if (!response) {
      console.log('[handleMicrosoftRedirect] No redirect response - checking existing accounts');
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];
        instance.setActiveAccount(account);
        return {
          success: true,
          account,
          email: account.username,
          name: account.name || '',
        };
      }
      return { success: false, error: 'No redirect response and no existing accounts' };
    }
    
    // STEP 3: We have a response - user just logged in
    instance.setActiveAccount(response.account);
    
    const email = response.account.username;
    const name = response.account.name || '';
    
    console.log('[handleMicrosoftRedirect] User logged in:', email);
    
    return {
      success: true,
      account: response.account,
      email,
      name,
    };
    
  } catch (error: any) {
    console.error('[handleMicrosoftRedirect] Error:', error);
    return { success: false, error: error.message || 'Authentication failed' };
  }
};
```

## What NOT to Do

❌ **WRONG** (causes loop):
```typescript
// DON'T do this - causes infinite loop!
if (!accounts.length) {
  loginRedirect();
}
```

❌ **WRONG**:
```typescript
// DON'T call loginRedirect() again after redirect
const handleMicrosoftLogin = async () => {
  await loginRedirect('microsoft');
  // User comes back from Microsoft, but we call loginRedirect() AGAIN!
  await loginRedirect('microsoft'); // LOOP!
};
```

## Backend API

POST `/api/auth/microsoft`
```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

Response:
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "User",
  "auth_provider": "microsoft"
}
```

## Testing the Flow

1. Clear browser localStorage and sessionStorage
2. Click "Continue with Microsoft" button
3. You should be redirected to Microsoft login
4. After login, you should be redirected back to /auth-callback
5. AuthCallback should process the redirect and navigate to dashboard
6. NO LOOP should occur

## Common Issues

1. **Still looping?** - Check if `handleRedirectPromise()` is being called more than once
2. **Stuck on callback?** - Check browser console for errors
3. **Token exchange fails?** - Ensure redirectUri in msalConfig matches Azure portal
