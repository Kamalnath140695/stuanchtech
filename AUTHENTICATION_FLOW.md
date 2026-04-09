# Authentication Flow Documentation

## Overview
This document describes the complete authentication flow for the StaunchTech Document Management System (DMS) using Microsoft Entra ID (Azure AD) with support for both Microsoft and Google accounts.

## Authentication Flow Diagram

```
User clicks "Continue with Microsoft" or "Continue with Google"
                    ↓
Microsoft Entra login page
                    ↓
User authenticates (Google OR Microsoft)
                    ↓
Microsoft issues Access Token
                    ↓
Call Microsoft Graph /me
                    ↓
Check user exists in DMS DB
        ↓                      ↓
      Yes                     No
      ↓                       ↓
   Login user         Create user in DB
                          ↓
                     Assign default role
                          ↓
                       Login success
```

## Implementation Details

### Step 1: User Clicks Login Button

**UI Components:**
- `SimpleLoginPage.tsx` - Login page with Microsoft and Google buttons
- `SimpleSignupPage.tsx` - Signup page with Microsoft and Google buttons

**Buttons:**
- "Continue with Microsoft" - Direct Microsoft account login
- "Continue with Google" - Google account login via Microsoft federation

### Step 2: MSAL Login

**For Microsoft:**
```typescript
instance.loginRedirect({
  scopes: ["User.Read"]
});
```

**For Google:**
```typescript
instance.loginRedirect({
  scopes: ["User.Read"],
  extraQueryParameters: {
    domain_hint: "google.com"
  }
});
```

### Step 3: Microsoft Returns Access Token

After successful authentication, Microsoft Entra ID returns:
```typescript
{
  accessToken: "eyJ0eXAiOiJKV1QiLCJhbGc...",
  account: { ... }
}
```

### Step 4: Get User Profile from Microsoft Graph

**API Call:**
```typescript
const response = await fetch(
  "https://graph.microsoft.com/v1.0/me",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);
```

**Response:**
```json
{
  "id": "abc123",
  "displayName": "John Doe",
  "mail": "user@gmail.com",
  "userPrincipalName": "user@gmail.com"
}
```

### Step 5: Check User in DMS Database

**Query:**
```sql
SELECT * FROM users WHERE email = 'user@gmail.com'
```

**Implementation:**
```typescript
const user = await checkUserExists(profile.mail);
```

### Step 6: Create User if Not Exists

**Database Insert:**
```sql
INSERT INTO users (entra_id, email, name, role, created_date)
VALUES ('abc123', 'user@gmail.com', 'John Doe', 'User', NOW())
```

**Default Role:** `User`

**Implementation:**
```typescript
if (!user) {
  user = await createDMSUser(
    profile.id,
    profile.mail,
    profile.displayName,
    'User'
  );
}
```

### Step 7: Optional - Create Guest User in Microsoft

For external users, you can optionally create a guest user in your tenant:

```typescript
POST https://graph.microsoft.com/v1.0/invitations
{
  "invitedUserEmailAddress": "user@gmail.com",
  "inviteRedirectUrl": "https://yourdomain.com",
  "sendInvitationMessage": true
}
```

**Note:** This is NOT mandatory for login. Microsoft federation handles external accounts automatically.

## Authentication Responsibilities

### Microsoft Handles:
- ✅ User signup
- ✅ Password management
- ✅ OTP/MFA
- ✅ Google login federation
- ✅ Microsoft account login
- ✅ Token generation
- ✅ Token refresh

### Your App Handles:
- ✅ User creation in DMS database
- ✅ Role assignment
- ✅ Permission management
- ✅ Container access control
- ✅ Application-specific data

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entra_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('GlobalAdmin', 'UserAdmin', 'User') DEFAULT 'User',
  tenant_id VARCHAR(255),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_entra_id (entra_id)
);
```

### What to Store:
- `entra_id` - Unique Microsoft Entra ID (use as primary key)
- `email` - User email address
- `name` - Display name
- `role` - User role (GlobalAdmin, UserAdmin, User)
- `tenant_id` - Optional tenant identifier
- `created_date` - Account creation timestamp

## Production Flow

```
Login
  ↓
Get Microsoft token
  ↓
Call Graph API /me
  ↓
Check user in DMS DB
  ↓
Create user if not exists
  ↓
Assign default role (User)
  ↓
Store session data
  ↓
Redirect to dashboard
```

## File Structure

```
src/
├── services/
│   └── authService.ts          # Authentication service
├── components/
│   ├── SimpleLoginPage.tsx     # Login page
│   └── SimpleSignupPage.tsx    # Signup page
├── App.tsx                      # Main app with auth check
└── common/
    └── constants.ts             # Azure AD configuration
```

## Key Functions

### authService.ts

1. **getAccessToken()** - Get Microsoft Graph access token
2. **getUserProfile()** - Fetch user profile from Microsoft Graph
3. **checkUserExists()** - Check if user exists in DMS database
4. **createDMSUser()** - Create new user in DMS database
5. **completeAuthFlow()** - Complete authentication flow
6. **logoutUser()** - Logout and cleanup
7. **getCurrentUser()** - Get current logged-in user

## Environment Variables

```env
# Azure AD Configuration
REACT_APP_CLIENT_ID=your-client-id
REACT_APP_TENANT_ID=your-tenant-id
REACT_APP_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
```

## User Roles

### GlobalAdmin
- Full system access
- Can manage all users
- Can create/manage apps
- Can assign permissions
- Can view audit logs

### UserAdmin
- Can manage normal users
- Can manage assigned apps
- Can assign permissions to normal users
- Can view audit logs

### User (Default)
- Basic access
- Can view own containers
- Can manage own files
- Limited permissions

## Login Scenarios

### New Microsoft User
```
Continue with Microsoft
  → Microsoft login
  → User auto-created in DMS
  → Role: User
  → Login success
```

### New Google User
```
Continue with Google
  → Microsoft federation
  → Google login
  → User auto-created in DMS
  → Role: User
  → Login success
```

### Existing User
```
Continue with Microsoft/Google
  → Authentication
  → User found in DMS
  → Load existing role
  → Login success
```

## Security Considerations

1. **Token Storage**: Access tokens are managed by MSAL library
2. **Session Management**: User data stored in localStorage (temporary)
3. **Role Validation**: Server-side validation required for production
4. **API Security**: All API calls should validate user permissions
5. **HTTPS**: Always use HTTPS in production

## Migration to Backend API

Currently using localStorage for demonstration. For production:

1. Replace `checkUserExists()` with API call:
```typescript
const response = await fetch('/api/users/check?email=' + email);
```

2. Replace `createDMSUser()` with API call:
```typescript
const response = await fetch('/api/users', {
  method: 'POST',
  body: JSON.stringify(userData)
});
```

3. Implement proper session management with JWT tokens
4. Add server-side role validation
5. Implement proper error handling and logging

## Testing

### Test New User Flow
1. Clear localStorage
2. Click "Continue with Microsoft"
3. Login with Microsoft account
4. Verify user created in DMS
5. Check default role assigned
6. Verify redirect to dashboard

### Test Existing User Flow
1. Login with existing account
2. Verify user data loaded
3. Check role preserved
4. Verify dashboard access

## Troubleshooting

### Common Issues

1. **"state_not_found" error**
   - Solution: Add `redirectUri: window.location.origin` to MSAL config

2. **User not created in DMS**
   - Check console for errors
   - Verify Microsoft Graph API permissions
   - Check access token validity

3. **Google login not working**
   - Verify `domain_hint: "google.com"` is set
   - Check Azure AD external identities configuration

## Next Steps

1. ✅ Implement backend API for user management
2. ✅ Add proper database integration
3. ✅ Implement JWT token-based session management
4. ✅ Add role-based access control middleware
5. ✅ Implement audit logging
6. ✅ Add user profile management
7. ✅ Implement password reset (if using local accounts)
8. ✅ Add multi-factor authentication support

## Support

For issues or questions, contact the development team or refer to:
- Microsoft Graph API documentation
- MSAL.js documentation
- Azure AD documentation
