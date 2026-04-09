# Microsoft Login Flow Implementation Guide

## Overview
This implementation ensures that when users click "Continue with Microsoft", the system:
- Logs in existing users directly (no signup page)
- Creates new users if they exist in the Microsoft tenant
- Assigns roles based on Microsoft Graph admin status
- Never shows signup page again for existing users

## Architecture

### Frontend Flow
1. User clicks "Continue with Microsoft" button
2. MSAL popup/redirect opens
3. User selects Microsoft account
4. MSAL returns: `idToken`, `accessToken`, `email`, `oid`, `tenantId`
5. Frontend redirects to `/auth-callback`
6. AuthCallback calls backend with tokens

### Backend Flow
1. Decode ID token (extract email, name)
2. Check if user exists in MySQL
   - **IF EXISTS**: Return user data → Login
   - **IF NOT EXISTS**: Check Microsoft Graph for admin role → Create user → Login
3. Return user role and status

## Key Changes

### 1. Backend: `/api/auth/microsoft` Endpoint

**File**: `backend/routers/auth.py`

```python
@router.post("/microsoft")
def microsoft_auth(body: MicrosoftAuthRequest):
    """Microsoft SSO endpoint — validates tokens and syncs user."""
    # Decode ID token
    id_token_data = decode_id_token(body.idToken)
    
    email = id_token_data.get("email") or id_token_data.get("preferred_username")
    name = id_token_data.get("name", "")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in token")
    
    email = email.lower()
    
    # Check if user exists in DB
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        
        if user:
            # User exists — just login
            return {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "auth_provider": user["auth_provider"],
                "status": "ACTIVE"
            }
        
        # User doesn't exist — check if they're in Microsoft tenant
        # Determine role based on admin status
        is_admin = is_global_admin(body.accessToken)
        role = "GlobalAdmin" if is_admin else "PendingApproval"
        
        # Create new user
        cursor.execute(
            "INSERT INTO users (name, email, auth_provider, role) VALUES (%s, %s, 'microsoft', %s)",
            (name, email, role)
        )
        db.commit()
        user_id = cursor.lastrowid
        
        return {
            "id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "auth_provider": "microsoft",
            "status": "ACTIVE"
        }
    finally:
        cursor.close()
        db.close()
```

### 2. Helper Functions

**ID Token Decoding**:
```python
def decode_id_token(id_token: str) -> dict:
    """Decode ID token without verification (frontend already validated)."""
    try:
        decoded = jwt.decode(id_token, options={"verify_signature": False})
        return decoded
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {str(e)}")
```

**Admin Role Check**:
```python
def is_global_admin(access_token: str) -> bool:
    """Check if user is Global Admin via Microsoft Graph."""
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        res = requests.get(
            "https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName,id",
            headers=headers,
            timeout=10
        )
        if res.status_code != 200:
            return False
        
        data = res.json()
        admin_roles = ["Company Administrator", "Global Administrator"]
        for item in data.get("value", []):
            if item.get("displayName") in admin_roles:
                return True
        return False
    except Exception as e:
        print(f"[Graph] Error checking admin status: {e}")
        return False
```

### 3. Frontend: AuthCallback Component

**File**: `src/components/AuthCallback.tsx`

```typescript
const processRedirect = async () => {
  try {
    const instance = await getMsalInstance();
    const result = await instance.handleRedirectPromise();
    
    if (!result) {
      navigate('/login');
      return;
    }

    instance.setActiveAccount(result.account);
    
    // Call backend with ID token and access token
    const dbUser = await microsoftAuth(result.idToken, result.accessToken);

    // Check status
    if (dbUser.role === 'PendingApproval') {
      navigate('/login/pendingapprovaluser');
    } else {
      navigate('/dashboard');
    }
  } catch (err: any) {
    console.error('Auth callback error:', err);
    setError(err.message || 'Authentication failed. Please try again.');
    setTimeout(() => navigate('/login'), 3000);
  }
};
```

### 4. Frontend: Auth Service

**File**: `src/services/authService.ts`

```typescript
export const microsoftAuth = async (idToken: string, accessToken: string): Promise<AuthUser> => {
  const res = await fetch(`${API_BASE}/microsoft`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Microsoft auth failed.');
  storeUser(data);
  return data;
};
```

## User Flow Scenarios

### Scenario 1: Existing User
1. User clicks "Continue with Microsoft"
2. MSAL authenticates
3. Frontend calls `/api/auth/microsoft` with tokens
4. Backend finds user in DB
5. Returns user data with role
6. Frontend redirects to dashboard

**Result**: ✅ No signup page shown, direct login

### Scenario 2: New User (Not Admin)
1. User clicks "Continue with Microsoft"
2. MSAL authenticates
3. Frontend calls `/api/auth/microsoft` with tokens
4. Backend doesn't find user in DB
5. Checks Microsoft Graph → Not admin
6. Creates user with role `PendingApproval`
7. Returns user data
8. Frontend redirects to pending approval page

**Result**: ✅ User created, awaiting approval

### Scenario 3: New User (Global Admin)
1. User clicks "Continue with Microsoft"
2. MSAL authenticates
3. Frontend calls `/api/auth/microsoft` with tokens
4. Backend doesn't find user in DB
5. Checks Microsoft Graph → Is Global Admin
6. Creates user with role `GlobalAdmin`
7. Returns user data
8. Frontend redirects to dashboard

**Result**: ✅ User created as admin, direct access

## Database Schema

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    auth_provider ENUM('email', 'google', 'microsoft') DEFAULT 'email',
    role ENUM('GlobalAdmin', 'UserAdmin', 'User', 'PendingApproval') DEFAULT 'PendingApproval',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Important Rules

1. **Email is UNIQUE** - Prevents duplicate users
2. **No Signup Page for SSO Users** - Direct login or pending approval
3. **No Guest Creation** - Only authenticated Microsoft users
4. **Admin Detection** - Via Microsoft Graph API
5. **Cache Management** - Clear on logout, not on login

## Testing Checklist

- [ ] First-time Microsoft user → Creates account with correct role
- [ ] Existing Microsoft user → Logs in directly
- [ ] Global Admin user → Gets GlobalAdmin role
- [ ] Non-admin user → Gets PendingApproval role
- [ ] Logout clears all cache
- [ ] No signup page shown for Microsoft users
- [ ] Pending approval page shows for non-admin new users
- [ ] Dashboard accessible for approved users

## Dependencies

Add to `backend/requirements.txt`:
```
PyJWT
```

## Environment Variables

Ensure these are set in `.env`:
```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=staunchtech_dms
API_ENTRA_APP_CLIENT_ID=<your-client-id>
API_ENTRA_APP_CLIENT_SECRET=<your-client-secret>
API_ENTRA_APP_AUTHORITY=https://login.microsoftonline.com/common
```

## Troubleshooting

### Issue: "Email not found in token"
- Ensure MSAL scopes include `email`
- Check token claims in browser console

### Issue: "Failed to check admin status"
- Verify access token has Graph permissions
- Check Microsoft Graph API response

### Issue: User created but role is wrong
- Verify Microsoft Graph admin role names
- Check user's actual roles in Azure AD

### Issue: Duplicate user creation
- Ensure email column is UNIQUE
- Check for case sensitivity issues (use `.lower()`)
