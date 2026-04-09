# Microsoft Login Flow - Quick Reference Card

## What Was Changed

| Component | File | Change |
|-----------|------|--------|
| Backend | `backend/routers/auth.py` | Added `/api/auth/microsoft` endpoint |
| Backend | `backend/requirements.txt` | Added `PyJWT` |
| Frontend | `src/services/authService.ts` | Added `microsoftAuth()` function |
| Frontend | `src/components/AuthCallback.tsx` | Updated to use new endpoint |

## Installation

```bash
# 1. Install dependencies
cd backend
pip install -r requirements.txt

# 2. Restart backend
python main.py
```

## User Flow (One Diagram)

```
Click "Continue with Microsoft"
         ↓
    MSAL Authenticates
         ↓
  Redirect to /auth-callback
         ↓
  Call POST /api/auth/microsoft
         ↓
    ┌────┴────┐
    ↓         ↓
User Exists  User NOT Exists
    ↓         ↓
  Login    Check Admin
    ↓         ↓
    └────┬────┘
         ↓
  Return User Data
         ↓
    ┌────┴────┐
    ↓         ↓
PendingAppr  Dashboard
    ↓         ↓
  Pending   Logged In
```

## API Endpoint

### POST /api/auth/microsoft

**Request**:
```json
{
  "idToken": "JWT_TOKEN",
  "accessToken": "GRAPH_TOKEN"
}
```

**Response**:
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "GlobalAdmin",
  "auth_provider": "microsoft",
  "status": "ACTIVE"
}
```

## Key Functions

### Backend
```python
# Decode ID token
decode_id_token(id_token: str) -> dict

# Check if user is admin
is_global_admin(access_token: str) -> bool

# Main endpoint
@router.post("/microsoft")
def microsoft_auth(body: MicrosoftAuthRequest)
```

### Frontend
```typescript
// Call backend
export const microsoftAuth = async (
  idToken: string,
  accessToken: string
): Promise<AuthUser>
```

## Database

```sql
-- Email is UNIQUE (prevents duplicates)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    auth_provider ENUM('email', 'google', 'microsoft'),
    role ENUM('GlobalAdmin', 'UserAdmin', 'User', 'PendingApproval'),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Role Assignment

| Scenario | Role |
|----------|------|
| First user ever | GlobalAdmin |
| Existing user | Keep existing role |
| New user + Global Admin | GlobalAdmin |
| New user + Not Admin | PendingApproval |

## Important Rules

1. ✅ **Email is UNIQUE** - No duplicates
2. ✅ **No Signup Page** - Microsoft users skip signup
3. ✅ **Auto Create** - New users created automatically
4. ✅ **Admin Detection** - Via Microsoft Graph
5. ✅ **Case Insensitive** - All emails lowercase

## Testing

```
Test 1: Existing user
  → Should login directly

Test 2: New non-admin user
  → Should create with PendingApproval

Test 3: New admin user
  → Should create with GlobalAdmin

Test 4: Logout and re-login
  → Should login again
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Email not found in token" | Add `email` to MSAL scopes |
| "Failed to check admin status" | Verify Graph permissions |
| "Duplicate user" | Email column must be UNIQUE |
| "Wrong role assigned" | Check Azure AD admin roles |

## Files to Review

1. `backend/routers/auth.py` - Main logic
2. `src/services/authService.ts` - Frontend API call
3. `src/components/AuthCallback.tsx` - Redirect handler
4. `MICROSOFT_LOGIN_IMPLEMENTATION.md` - Full details
5. `MICROSOFT_LOGIN_FLOW_DIAGRAM.md` - Flow diagrams

## Environment Variables

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=staunchtech_dms
API_ENTRA_APP_CLIENT_ID=<your-id>
API_ENTRA_APP_CLIENT_SECRET=<your-secret>
API_ENTRA_APP_AUTHORITY=https://login.microsoftonline.com/common
```

## MSAL Configuration

```typescript
export const msalConfig = {
  auth: {
    clientId: '44e5a5e8-847f-465d-a68a-3a516aefbe97',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin + '/auth-callback',
    postLogoutRedirectUri: window.location.origin + '/login',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true,
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'profile', 'openid', 'email'],
};
```

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid token or email not found |
| 401 | Unauthorized |
| 409 | Email already exists (register only) |
| 500 | Server error |

## Next Steps

1. ✅ Install PyJWT
2. ✅ Restart backend
3. ✅ Test with existing user
4. ✅ Test with new user
5. ✅ Test with admin user
6. ✅ Verify pending approval flow
7. ✅ Check dashboard access

## Summary

**Before**: Users had to sign up separately for Microsoft login
**After**: Users click "Continue with Microsoft" and are automatically logged in or created

**Key Benefit**: Seamless Microsoft authentication with automatic user management
