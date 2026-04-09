# Quick Fix: Azure AD Redirect URI Configuration

## Error: server_error

This error occurs because the redirect URI is not properly configured in Azure AD.

## Fix Steps (5 minutes)

### 1. Go to Azure Portal
- Navigate to https://portal.azure.com
- Sign in with your admin account

### 2. Open App Registration
- Go to **Azure Active Directory**
- Click **App registrations**
- Find your app: `MyEmbeddedApp` (Client ID: 44e5a5e8-847f-465d-a68a-3a516aefbe97)

### 3. Add Redirect URIs (CRITICAL!)
- Click on your app
- Go to **Authentication** in the left menu
- **IMPORTANT:** You should see a section called "Web" - click on it (NOT SPA)
- Add these redirect URIs (MUST include auth-callback):
  ```
  http://localhost:3000/auth-callback
  http://localhost:3000/
  http://localhost:3000
  http://localhost:3000/login
  http://localhost:3000/signup
  ```
- Click **Save**

**ALTERNATIVE: If using SPA platform**
- If you prefer SPA, click "Add a platform" → "Single-page application"
- Add: `http://localhost:3000/auth-callback` (ONLY this one)
- Also add under "Web" platform if available

**IMPORTANT:** The `http://localhost:3000/auth-callback` URI is REQUIRED!

### 4. Update Supported Account Types
- Still in **Authentication**
- Under "Supported account types", select:
  - ✅ **Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)**
- Click **Save**

### 5. Enable Implicit Grant (if needed)
- Still in **Authentication**
- Under "Implicit grant and hybrid flows", check:
  - ✅ **Access tokens (used for implicit flows)**
  - ✅ **ID tokens (used for implicit and hybrid flows)**
- Click **Save**

### 6. Update API Permissions
- Go to **API permissions**
- Click **Add a permission**
- Select **Microsoft Graph**
- Select **Delegated permissions**
- Add these permissions:
  - ✅ `User.Read`
  - ✅ `User.ReadWrite`
  - ✅ `Files.ReadWrite.All`
  - ✅ `Sites.ReadWrite.All`
- Click **Add permissions**
- Click **Grant admin consent for [Your Organization]**
- Click **Yes**

### 7. Clear Browser Cache
- Press `Ctrl + Shift + Delete`
- Clear "Cookies" and "Cached images"
- Close all browser windows

### 8. Restart Your App
```bash
# Stop the server (Ctrl+C)
npm start
```

### 9. Test Login
- Go to http://localhost:3000/login
- Click "Continue with Microsoft"
- Should work now!

## Common Issues

### Issue: "Reply URL mismatch"
**Solution:** Make sure redirect URI exactly matches: `http://localhost:3000`

### Issue: "AADSTS50011: The reply URL specified in the request does not match"
**Solution:** Add all these URIs:
- `http://localhost:3000`
- `http://localhost:3000/`
- `http://localhost:3000/auth-callback`
- `http://localhost:3000/login`
- `http://localhost:3000/signup`

### Issue: "AADSTS65001: User or administrator has not consented"
**Solution:** Grant admin consent in API permissions

### Issue: "AADSTS700016: Application not found"
**Solution:** Check your Client ID is correct

## Production Setup

For production, add your production URLs:
```
https://yourdomain.com
https://yourdomain.com/
https://yourdomain.com/auth-callback
https://yourdomain.com/login
https://yourdomain.com/signup
```

**IMPORTANT:** Always include the `/auth-callback` redirect URI!

## Verification Checklist

- [ ] Redirect URIs added (http://localhost:3000)
- [ ] Platform set to "Single-page application"
- [ ] Supported accounts set to "Multitenant + Personal"
- [ ] Implicit grant enabled
- [ ] API permissions added
- [ ] Admin consent granted
- [ ] Browser cache cleared
- [ ] App restarted

## Still Having Issues?

Check the browser console for the exact error message and compare with:
- Client ID: 44e5a5e8-847f-465d-a68a-3a516aefbe97
- Redirect URI: http://localhost:3000
- Authority: https://login.microsoftonline.com/common
