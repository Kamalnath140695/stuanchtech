# Quick Setup Guide - Microsoft Login Flow

## What Changed

### Backend (`backend/routers/auth.py`)
✅ Added `POST /api/auth/microsoft` endpoint
✅ Added ID token decoding function
✅ Added Microsoft Graph admin role checking
✅ Automatic user creation for new Microsoft users
✅ Email uniqueness enforced

### Frontend (`src/services/authService.ts`)
✅ Added `microsoftAuth()` function to call backend

### Frontend (`src/components/AuthCallback.tsx`)
✅ Updated to use new Microsoft auth endpoint
✅ Passes ID token and access token to backend

### Dependencies
✅ Added `PyJWT` to `backend/requirements.txt`

## Installation

1. **Install backend dependencies**:
```bash
cd backend
pip install -r requirements.txt
```

2. **Restart backend**:
```bash
python main.py
```

## How It Works Now

### User Clicks "Continue with Microsoft"

```
┌─────────────────────────────────────────────────────────────┐
│ 1. MSAL authenticates user                                  │
│    Returns: idToken, accessToken, email                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Frontend redirects to /auth-callback                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. AuthCallback calls POST /api/auth/microsoft               │
│    Sends: { idToken, accessToken }                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Backend:                                                  │
│    a) Decode ID token → extract email, name                 │
│    b) Check if user exists in MySQL                         │
│       - YES: Return user data → Login                        │
│       - NO: Check Microsoft Graph for admin role            │
│           - Is Admin: Create as GlobalAdmin                 │
│           - Not Admin: Create as PendingApproval            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Frontend receives user data with role                     │
│    - If PendingApproval: Show pending approval page         │
│    - Else: Redirect to dashboard                            │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

✅ **No Signup Page for Microsoft Users**
- Existing users login directly
- New users are created automatically

✅ **Automatic Role Assignment**
- Global Admins detected via Microsoft Graph
- Others get PendingApproval status

✅ **No Duplicate Users**
- Email is UNIQUE in database
- Case-insensitive matching

✅ **No Guest Creation**
- Only authenticated Microsoft users
- No temporary accounts

✅ **Proper Cache Management**
- Cleared on logout
- Not cleared on login

## Testing

### Test Case 1: Existing User
1. User already in database
2. Click "Continue with Microsoft"
3. Should login directly to dashboard
4. No signup page shown

### Test Case 2: New Non-Admin User
1. User not in database
2. Click "Continue with Microsoft"
3. Should create user with PendingApproval role
4. Should show pending approval page

### Test Case 3: New Admin User
1. User not in database
2. User is Global Admin in Azure AD
3. Click "Continue with Microsoft"
4. Should create user with GlobalAdmin role
5. Should redirect to dashboard

## Troubleshooting

### Error: "Email not found in token"
**Solution**: Ensure MSAL scopes include `email`
```typescript
// In msalConfig.ts
export const loginRequest = {
  scopes: ['User.Read', 'profile', 'openid', 'email'],
};
```

### Error: "Failed to check admin status"
**Solution**: Verify access token has Graph permissions
- Check that your Azure AD app has `Directory.Read.All` permission
- Ensure token includes Graph scopes

### User Created But Wrong Role
**Solution**: Check Microsoft Graph response
- Verify user's actual roles in Azure AD
- Check admin role names match: "Company Administrator" or "Global Administrator"

### Duplicate User Error
**Solution**: Email column must be UNIQUE
```sql
ALTER TABLE users ADD UNIQUE (email);
```

## API Endpoints

### POST /api/auth/microsoft
**Request**:
```json
{
  "idToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response (Existing User)**:
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

**Response (New User)**:
```json
{
  "id": 2,
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "PendingApproval",
  "auth_provider": "microsoft",
  "status": "ACTIVE"
}
```

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

## Important Notes

1. **Email is UNIQUE** - Prevents duplicate users
2. **No Signup Page** - Microsoft users skip signup entirely
3. **Admin Detection** - Uses Microsoft Graph API
4. **Case Insensitive** - All emails converted to lowercase
5. **Token Validation** - Frontend validates, backend decodes

## Next Steps

1. Test with existing user
2. Test with new user
3. Test with admin user
4. Verify pending approval flow
5. Check dashboard access for approved users
