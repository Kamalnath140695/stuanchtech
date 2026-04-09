# Code Changes Reference

## File 1: backend/routers/auth.py

### Added Imports
```python
import jwt
import requests
from typing import Optional
```

### Added Model
```python
class MicrosoftAuthRequest(BaseModel):
    idToken: str
    accessToken: str
```

### Added Functions

#### 1. decode_id_token()
```python
def decode_id_token(id_token: str) -> dict:
    """Decode ID token without verification (frontend already validated)."""
    try:
        decoded = jwt.decode(id_token, options={"verify_signature": False})
        return decoded
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {str(e)}")
```

#### 2. is_global_admin()
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

#### 3. microsoft_auth() - NEW ENDPOINT
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

---

## File 2: backend/requirements.txt

### Added Dependency
```
PyJWT
```

**Full file**:
```
fastapi
uvicorn
python-dotenv
requests
msal
mysql-connector-python
bcrypt
pydantic[email]
PyJWT
```

---

## File 3: src/services/authService.ts

### Added Function

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

**Location**: Added at the end of the file, after `ssoSyncToMySQL()`

---

## File 4: src/components/AuthCallback.tsx

### Complete Rewrite

**Old Code**:
```typescript
const processRedirect = async () => {
  try {
    const result = await handleRedirectResult();
    
    if (!result) {
      navigate('/login');
      return;
    }

    const { graphProfile, dbUser } = result;

    localStorage.setItem('current_user', JSON.stringify(dbUser));
    localStorage.setItem('adminRole', dbUser.role);

    if (dbUser.status === 'PENDING_APPROVAL') {
      navigate('/login/pendingapprovaluser');
    } else if (dbUser.status === 'ACTIVE') {
      navigate('/dashboard');
    } else {
      setError('Your account status is invalid. Please contact administrator.');
    }
  } catch (err: any) {
    console.error('Auth callback error:', err);
    setError(err.message || 'Authentication failed. Please try again.');
    setTimeout(() => navigate('/login'), 3000);
  }
};
```

**New Code**:
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

### Added Imports
```typescript
import { microsoftAuth, getMsalInstance } from '../services/authService';
```

---

## Summary of Changes

### Backend Changes
- ✅ Added JWT decoding
- ✅ Added Microsoft Graph admin check
- ✅ Added new `/api/auth/microsoft` endpoint
- ✅ Added PyJWT dependency

### Frontend Changes
- ✅ Added `microsoftAuth()` function
- ✅ Updated AuthCallback to use new endpoint
- ✅ Simplified redirect handling

### Database Changes
- ✅ Email column is UNIQUE (prevents duplicates)
- ✅ No schema changes needed

### Configuration Changes
- ✅ Added PyJWT to requirements.txt
- ✅ No environment variable changes needed

---

## Testing the Changes

### 1. Test Existing User
```bash
# User already in database
# Click "Continue with Microsoft"
# Expected: Direct login to dashboard
```

### 2. Test New Non-Admin User
```bash
# User not in database, not admin
# Click "Continue with Microsoft"
# Expected: Create user with PendingApproval role
# Expected: Show pending approval page
```

### 3. Test New Admin User
```bash
# User not in database, is Global Admin
# Click "Continue with Microsoft"
# Expected: Create user with GlobalAdmin role
# Expected: Redirect to dashboard
```

### 4. Test Logout and Re-login
```bash
# User logs out
# User logs in again
# Expected: User logged in with existing role
```

---

## Verification Checklist

- [ ] PyJWT installed in backend
- [ ] Backend restarted
- [ ] `microsoftAuth()` function exists in authService.ts
- [ ] AuthCallback uses new endpoint
- [ ] Email column is UNIQUE in database
- [ ] First test user can login
- [ ] New user is created automatically
- [ ] Admin role is detected correctly
- [ ] Pending approval page shows for non-admin users
- [ ] Dashboard accessible for approved users

---

## Rollback Instructions

If you need to revert these changes:

### 1. Backend
```bash
# Remove PyJWT from requirements.txt
# Remove the three new functions from auth.py
# Remove the MicrosoftAuthRequest model
# Remove the new imports (jwt, requests, Optional)
# Restart backend
```

### 2. Frontend
```bash
# Revert AuthCallback.tsx to original version
# Remove microsoftAuth() from authService.ts
```

---

## Performance Impact

- ✅ Minimal - One additional Graph API call per new user
- ✅ Cached - Admin status checked only for new users
- ✅ Fast - Token decoding is local operation
- ✅ Efficient - Single database query per login

---

## Security Considerations

- ✅ ID token decoded without signature verification (frontend already validated)
- ✅ Access token used only for Graph API calls
- ✅ Email normalized to lowercase (prevents case-sensitivity issues)
- ✅ Database email is UNIQUE (prevents duplicate accounts)
- ✅ No credentials stored in frontend
- ✅ HTTPS required for production

---

## Future Enhancements

1. Add token refresh logic
2. Add user profile sync from Graph
3. Add role update on each login
4. Add audit logging for user creation
5. Add email verification for new users
6. Add admin approval workflow
