# Authentication & Authorization Flow - Complete Guide

## Overview
This document describes the complete authentication and authorization flow for the StaunchTech Document Management System, supporting three login methods: Email/Password, Google SSO, and Microsoft SSO.

## Role Hierarchy

### 1. GlobalAdmin
- **Full system access**
- Can manage all users (create, approve, reject, delete)
- Can assign any role (GlobalAdmin, UserAdmin, NormalUser)
- Can create/delete containers, apps, and container types
- Can view all audit logs
- Can override all permissions

### 2. UserAdmin
- **Limited administrative access**
- Can manage NormalUser accounts only
- Can approve/reject pending user registrations
- Can assign NormalUser role only
- Can manage assigned containers (writer/reader permissions)
- Can view audit logs
- Cannot manage other admins

### 3. NormalUser
- **Standard user access**
- Can access assigned containers
- Can view/upload/download files in permitted containers
- Cannot manage users or system settings
- Limited to read/write operations on assigned resources

### 4. PendingApproval
- **Temporary state for new registrations**
- No system access until approved
- Redirected to pending approval page
- Requires admin approval to become active

---

## Authentication Flow

### A. Email/Password Registration & Login

#### Registration Flow:
1. User fills registration form (name, email, password)
2. Backend (`POST /api/auth/register`):
   - Checks if email already exists in MySQL database
   - First user automatically becomes **GlobalAdmin**
   - Subsequent users get **PendingApproval** status
   - User record created in MySQL with hashed password
3. Frontend stores user data in localStorage
4. If PendingApproval → redirect to `/login/pendingapprovaluser`
5. If GlobalAdmin → redirect to `/dashboard`

#### Login Flow:
1. User enters email and password
2. Backend (`POST /api/auth/login`):
   - Validates credentials against MySQL database
   - Checks user status (PENDING_APPROVAL, ACTIVE, REJECTED)
   - Returns user object with role
3. Frontend:
   - Stores user in localStorage with normalized role
   - Sets `adminRole` in localStorage
   - Redirects based on status:
     - PENDING_APPROVAL → `/login/pendingapprovaluser`
     - ACTIVE → `/dashboard`
     - REJECTED → Error message

---

### B. Microsoft SSO Login

#### Flow:
1. User clicks "Continue with Microsoft"
2. Frontend calls `loginRedirect('microsoft')` from authService
3. MSAL redirects to Microsoft login page
4. User authenticates with Microsoft credentials
5. Microsoft redirects back to `/auth-callback`
6. AuthCallback component:
   - Calls `handleRedirectPromise()` to get tokens
   - Extracts `idToken` and `accessToken`
   - Calls backend `POST /api/auth/microsoft` with tokens
7. Backend (`/api/auth/microsoft`):
   - Decodes ID token to extract email, name, oid (user ID)
   - Checks if user exists in MySQL database
   - **If user exists**: Return existing user (LOGIN)
   - **If user doesn't exist**:
     - Verify user exists in Microsoft tenant via Graph API
     - Check Microsoft Graph roles:
       - "Global Administrator" → **GlobalAdmin**
       - "User Administrator" → **UserAdmin**
       - Default → **NormalUser**
     - Create user in MySQL with determined role
     - Return new user object
8. Frontend:
   - Stores user in localStorage
   - Shows success message
   - Redirects to `/dashboard`

---

### C. Google SSO Login

#### Flow:
1. User clicks "Continue with Google"
2. Frontend calls `loginRedirect('google')` from authService
3. MSAL redirects to Google login page (via Azure AD B2C or federation)
4. User authenticates with Google credentials
5. Redirects back to `/auth-callback`
6. Backend (`POST /api/auth/sso`):
   - Checks if user exists in MySQL
   - **If exists**: Return user (LOGIN)
   - **If new**: 
     - Create guest invitation in Microsoft Entra ID
     - Create user with **NormalUser** role and **PENDING_APPROVAL** status
     - Return user object
7. Frontend:
   - Stores user in localStorage
   - Redirects to `/login/pendingapprovaluser` (pending approval)

---

## Authorization Flow

### 1. Role Detection (Frontend)

**RBACContext** (`src/context/RBACContext.tsx`):
- Reads user from localStorage on mount
- Extracts role from stored user object
- Maps role to permissions using `ROLE_PERMISSIONS` object
- Provides `can(permission)` function to check permissions
- Supports role simulation for testing (GlobalAdmin can simulate lower roles)

**Key Functions**:
```typescript
const { role, can, currentUser } = useRBAC();

// Check if user can perform action
if (can('manageNormalUsers')) {
  // Show user management UI
}
```

### 2. Route Protection

**RBACGuard Component** (`src/components/RBACGuard.tsx`):
- Wraps protected routes
- Checks user role against required roles
- Checks specific permissions
- Shows "Access Denied" if unauthorized

**Usage**:
```tsx
<RBACGuard roles={['GlobalAdmin', 'UserAdmin']}>
  <AdminManagement />
</RBACGuard>

<RBACGuard permission="manageNormalUsers">
  <UserManagement />
</RBACGuard>
```

### 3. Dashboard & UI Rendering

**App.tsx** routing logic:
```typescript
// Not authenticated → Login/Signup pages
if (!isAuthenticated) {
  return <Login /> or <Signup />
}

// Pending approval → Pending approval page
if (isPendingApproval) {
  return <PendingApprovalPage />
}

// Active users → Dashboard + role-based routes
if (isAdmin) {
  // Show admin routes (/admin/users, /admin/containers, etc.)
} else {
  // Show only dashboard and user-accessible routes
}
```

### 4. Permission Matrix

| Permission | GlobalAdmin | UserAdmin | NormalUser |
|-----------|-------------|-----------|------------|
| createContainer | ✅ | ❌ | ❌ |
| deleteContainer | ✅ | ✅ (assigned only) | ❌ |
| createApp | ✅ | ❌ | ❌ |
| deleteApp | ✅ | ❌ | ❌ |
| manageAllUsers | ✅ | ❌ | ❌ |
| manageNormalUsers | ✅ | ✅ | ❌ |
| assignAdminRole | ✅ | ❌ | ❌ |
| assignNormalUserRole | ✅ | ✅ | ❌ |
| viewAuditLogs | ✅ | ✅ | ❌ |
| overridePermissions | ✅ | ❌ | ❌ |

---

## Backend Role Verification

### 1. Role Detection (`backend/routers/rbac_utils.py`)

**get_user_role(request)**:
- Extracts UPN (User Principal Name) from request headers or JWT token
- Checks local role store (JSON file) for overrides
- Falls back to Microsoft Graph API jobTitle
- Returns role: GlobalAdmin, UserAdmin, or NormalUser

### 2. Role Enforcement

**Decorators & Middleware**:
```python
from routers.rbac_utils import get_user_role

@router.post("/users")
async def create_user(request: Request):
    role = get_user_role(request)
    
    if role not in ["GlobalAdmin", "UserAdmin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # UserAdmin can only create NormalUsers
    if role == "UserAdmin" and assigned_role != "NormalUser":
        raise HTTPException(status_code=403, detail="UserAdmin can only create NormalUsers")
```

---

## User Approval Workflow

### 1. New User Registration
- User signs up via email or Google SSO
- Status set to **PENDING_APPROVAL**
- User redirected to pending approval page

### 2. Admin Reviews Pending Users
- Admin navigates to User Management
- Views list of pending users
- Can approve or reject with reason

### 3. Approval
- Admin clicks "Approve"
- Backend updates status to **ACTIVE**
- User can now log in and access system

### 4. Rejection
- Admin clicks "Reject" with reason
- Backend updates status to **REJECTED**
- User cannot log in (shows rejection message)

---

## Data Storage

### MySQL Database Schema
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    entra_user_id VARCHAR(255),
    provider ENUM('email', 'google', 'microsoft') DEFAULT 'email',
    role ENUM('GlobalAdmin', 'UserAdmin', 'NormalUser') DEFAULT 'NormalUser',
    status ENUM('PENDING_APPROVAL', 'ACTIVE', 'REJECTED') DEFAULT 'PENDING_APPROVAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by VARCHAR(255) NULL,
    rejected_at TIMESTAMP NULL,
    rejected_by VARCHAR(255) NULL,
    rejection_reason TEXT NULL
);
```

### LocalStorage (Frontend)
```json
{
  "current_user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "GlobalAdmin",
    "auth_provider": "microsoft",
    "entra_id": "abc-123",
    "created_date": "2024-01-01T00:00:00Z"
  },
  "adminRole": "GlobalAdmin"
}
```

---

## Security Considerations

### 1. Token Validation
- Microsoft tokens validated via MSAL library
- Backend verifies tokens with Microsoft Graph API
- Tokens stored securely in memory (not localStorage)

### 2. Role Verification
- Frontend role checks are for UI only
- Backend always verifies role from authoritative source
- Cannot bypass backend permission checks

### 3. Password Security
- Passwords hashed with bcrypt
- Minimum password requirements enforced
- No plain text password storage

### 4. Session Management
- JWT tokens expire after configured time
- Refresh tokens used for silent renewal
- Logout clears all stored credentials

---

## Testing the Flow

### Test Scenario 1: First User (GlobalAdmin)
1. Register with email/password
2. Should automatically become GlobalAdmin
3. Can access all admin features
4. Can create other users

### Test Scenario 2: Microsoft User (Existing Tenant)
1. Click "Continue with Microsoft"
2. Login with Microsoft account
3. If Global Admin in Azure AD → GlobalAdmin role
4. If User Admin in Azure AD → UserAdmin role
5. Otherwise → NormalUser role
6. Redirect to dashboard

### Test Scenario 3: New Google User
1. Click "Continue with Google"
2. Login with Google account
3. Status set to PENDING_APPROVAL
4. Redirect to pending approval page
5. Admin approves user
6. User can now access system as NormalUser

### Test Scenario 4: Role-Based Access
1. Login as NormalUser
2. Try to access `/admin/users` → Access Denied
3. Login as UserAdmin
4. Can access user management
5. Cannot create GlobalAdmin users
6. Login as GlobalAdmin
7. Full access to all features

---

## Troubleshooting

### Issue: User stuck in PendingApproval
**Solution**: Admin must approve user via User Management panel

### Issue: Microsoft login fails
**Solution**: 
- Check Azure AD app registration
- Verify redirect URIs configured
- Check user exists in tenant

### Issue: Role not updating after assignment
**Solution**: 
- User must log out and log back in
- Frontend reads role from localStorage on login
- Backend updates MySQL database

### Issue: Permission denied despite correct role
**Solution**:
- Check RBACContext is properly initialized
- Verify role stored in localStorage matches database
- Check ROLE_PERMISSIONS mapping in RBACContext.tsx

---

## Summary

✅ **Correct Flow Implemented**:
1. ✅ Three authentication methods (Email, Google, Microsoft)
2. ✅ Role detection from Microsoft Graph for Microsoft users
3. ✅ Proper role hierarchy (GlobalAdmin > UserAdmin > NormalUser)
4. ✅ Pending approval workflow for new users
5. ✅ Role-based dashboard and permission rendering
6. ✅ Frontend and backend permission checks
7. ✅ Consistent role naming across all components
8. ✅ MySQL database for persistent user storage
9. ✅ Secure token handling and validation
10. ✅ Comprehensive RBAC system with permission matrix

The system now correctly handles authentication from any provider and applies appropriate role-based permissions throughout the application.
