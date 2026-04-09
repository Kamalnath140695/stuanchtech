# Unified Authentication Flow

## Overview
Single authentication flow for both login and signup using Microsoft/Google accounts.

## Flow Diagram

```
User clicks button
        ↓
provider.login()
        ↓
Microsoft/Google login
        ↓
Redirect back to app
        ↓
completeAuthFlow()
        ↓
Backend /api/auth/login
        ↓
Check user exists?
   ↓           ↓
  Yes         No
   ↓           ↓
LOGIN      SIGNUP
   ↓           ↓
Return     Create user
 user      (PendingApproval)
   ↓           ↓
Dashboard   Dashboard
```

## Frontend Implementation

### Login & Signup Pages
Both pages use the **same authentication function**:

```typescript
const handleMicrosoftLogin = async () => {
  const provider = Providers.globalProvider;
  await provider.login();
};
```

### Buttons
- **Continue with Microsoft** - Calls `handleMicrosoftLogin()`
- **Continue with Google** - Calls `handleMicrosoftLogin()` (Microsoft handles Gmail accounts)

### Auth Service
```typescript
export const completeAuthFlow = async (): Promise<DMSUser> => {
  const provider = Providers.globalProvider;
  const graphClient = provider.graph.client;

  const profile = await graphClient.api('/me').get();
  const email = profile.mail || profile.userPrincipalName;
  const name = profile.displayName;

  // Backend handles login/signup logic
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name })
  });

  const user = await response.json();
  localStorage.setItem('current_user', JSON.stringify(user));
  
  return user;
};
```

## Backend Implementation

### Endpoint: POST /api/auth/login

```python
@router.post("/auth/login")
async def unified_auth(request: Request):
    data = await request.json()
    email = data.get("email", "").lower()
    name = data.get("name", "")

    users_store = _read_users_store()

    # Check if user exists
    if email in users_store:
        # LOGIN - existing user
        return users_store[email]
    else:
        # SIGNUP - new user
        role = "GlobalAdmin" if len(users_store) == 0 else "PendingApproval"
        
        new_user = {
            "email": email,
            "name": name,
            "role": role,
            "created_date": datetime.utcnow().isoformat()
        }
        
        users_store[email] = new_user
        _write_users_store(users_store)
        
        return new_user
```

## Role Assignment

### First User
- Automatically assigned **GlobalAdmin** role
- Full system access

### Subsequent Users
- Assigned **PendingApproval** role
- Shown pending approval page
- GlobalAdmin must approve and assign role

### Available Roles
- **GlobalAdmin** - Full system access
- **UserAdmin** - Manage users and containers
- **NormalUser** - Basic access
- **PendingApproval** - Awaiting approval

## User Experience

### New User Flow
1. Click "Continue with Microsoft" or "Continue with Google"
2. Enter email (Gmail or Microsoft account)
3. Complete authentication
4. Redirected to dashboard
5. If first user → Full access
6. If not first user → Pending approval page

### Existing User Flow
1. Click "Continue with Microsoft" or "Continue with Google"
2. Enter email
3. Complete authentication
4. Redirected to dashboard with existing role

## Storage

### Users Store
Location: `backend/users_store.json`

Structure:
```json
{
  "user@example.com": {
    "email": "user@example.com",
    "name": "User Name",
    "role": "PendingApproval",
    "created_date": "2024-01-01T00:00:00"
  }
}
```

## Key Features

✅ Single button for login/signup
✅ Works with Microsoft accounts
✅ Works with Gmail accounts (via Microsoft)
✅ Automatic user creation
✅ First user becomes GlobalAdmin
✅ Role-based access control
✅ Pending approval workflow
