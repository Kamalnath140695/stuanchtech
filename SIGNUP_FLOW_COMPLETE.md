# StaunchTech Document Management System - Signup Flow

## Overview
Complete signup and approval system with Microsoft Entra ID, Microsoft Graph API, SharePoint Embedded, and MySQL/JSON storage.

## User Roles
- **GLOBAL_ADMIN** - Full system access, can approve users
- **USER_ADMIN** - Can manage users and approve signups
- **NORMAL_USER** - Standard user with limited access

## User Status
- **PENDING_APPROVAL** - New user waiting for admin approval
- **ACTIVE** - Approved user with full access
- **REJECTED** - User rejected by admin

---

## Signup Methods

### 1. Email Signup Flow

**Step 1: User Registration**
```
User fills form:
- Full Name
- Email
- Password
- Confirm Password
```

**Step 2: Frontend Request**
```typescript
POST /api/auth/signup
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Step 3: Backend Processing**
- Creates guest invitation in Microsoft Entra ID
- Stores user in MySQL/JSON with status=PENDING_APPROVAL
- Returns success message

**Step 4: User Response**
```json
{
  "success": true,
  "message": "Your account is pending approval from administrator",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "entra_user_id": "abc-123",
    "provider": "email",
    "role": "NormalUser",
    "status": "PENDING_APPROVAL",
    "created_at": "2024-01-01T00:00:00"
  }
}
```

**Step 5: User Sees Pending Page**
- Redirected to `/pending-approval`
- Shows "Waiting for admin approval" message
- Cannot access system until approved

---

### 2. Google Signup Flow

**Step 1: User Clicks "Continue with Google"**
```typescript
await loginRedirect('google');
```

**Step 2: Google OAuth**
- User authenticates with Google
- Redirects back to `/auth-callback`

**Step 3: Backend Processing**
```typescript
POST /api/auth/sso
{
  "name": "John Doe",
  "email": "john@gmail.com",
  "provider": "google"
}
```

**Step 4: Guest Invitation**
- Creates guest user in Microsoft Entra ID
- Sends invitation email
- Stores user with status=PENDING_APPROVAL

**Step 5: User Accepts Invitation**
- Clicks link in email
- Completes Microsoft guest setup

**Step 6: Pending Approval**
- User sees pending approval page
- Waits for admin approval

---

### 3. Microsoft Signup Flow

**Step 1: User Clicks "Continue with Microsoft"**
```typescript
await loginRedirect('microsoft');
```

**Step 2: MSAL Login**
- User authenticates with Microsoft
- Redirects back to `/auth-callback`

**Step 3: Backend Processing**
```typescript
POST /api/auth/sso
{
  "name": "John Doe",
  "email": "john@company.com",
  "provider": "microsoft"
}
```

**Step 4: User Creation**
- Stores user with status=PENDING_APPROVAL
- No guest invitation needed (already in tenant)

**Step 5: Pending Approval**
- User sees pending approval page
- Waits for admin approval

---

## Login Flow with Status Check

### Login Request
```typescript
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

### Login Response - Pending
```json
{
  "success": false,
  "message": "Your account is pending approval from administrator",
  "status": "PENDING_APPROVAL",
  "user": { ... }
}
```

### Login Response - Active
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "status": "ACTIVE",
    ...
  }
}
```

### Login Response - Rejected
```json
{
  "error": "Your account has been rejected. Please contact administrator."
}
```

---

## Admin Approval Flow

### 1. View Pending Users

**Endpoint:**
```
GET /api/admin/pending-users
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "provider": "email",
      "role": "NormalUser",
      "status": "PENDING_APPROVAL",
      "created_at": "2024-01-01T00:00:00"
    }
  ]
}
```

### 2. Approve User

**Endpoint:**
```
POST /api/admin/approve-user/1
```

**Response:**
```json
{
  "success": true,
  "message": "User John Doe has been approved",
  "user": {
    "id": 1,
    "status": "ACTIVE",
    "approved_at": "2024-01-02T00:00:00",
    "approved_by": "admin@company.com"
  }
}
```

### 3. Reject User

**Endpoint:**
```
POST /api/admin/reject-user/1
{
  "reason": "Invalid email domain"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User John Doe has been rejected",
  "user": {
    "id": 1,
    "status": "REJECTED",
    "rejected_at": "2024-01-02T00:00:00",
    "rejected_by": "admin@company.com",
    "rejection_reason": "Invalid email domain"
  }
}
```

### 4. Get All Users

**Endpoint:**
```
GET /api/admin/users?status=ACTIVE
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "users": [ ... ]
}
```

---

## Database Schema

### Users Table (MySQL/JSON)

```sql
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "entra_user_id": "abc-123-def-456",
  "provider": "email|google|microsoft",
  "role": "NormalUser|UserAdmin|GlobalAdmin",
  "status": "PENDING_APPROVAL|ACTIVE|REJECTED",
  "created_at": "2024-01-01T00:00:00",
  "approved_at": "2024-01-02T00:00:00",
  "approved_by": "admin@company.com",
  "rejected_at": null,
  "rejected_by": null,
  "rejection_reason": null
}
```

---

## Frontend Components

### 1. Signup.tsx
- Email/password signup form
- SSO buttons (Microsoft/Google)
- Redirects to `/pending-approval` after signup

### 2. Login.tsx
- Email/password login form
- SSO buttons (Microsoft/Google)
- Checks user status before allowing access

### 3. PendingApprovalPage.tsx
- Shows "Waiting for approval" message
- Displays status and next steps
- Logout button

### 4. AuthCallback.tsx
- Handles SSO redirect responses
- Processes Microsoft/Google authentication
- Redirects based on user status

---

## Access Control

### Pending Approval Users
- ❌ Cannot access dashboard
- ❌ Cannot upload files
- ❌ Cannot view containers
- ✅ Can see pending approval page
- ✅ Can logout

### Active Users
- ✅ Can access dashboard
- ✅ Can upload files (if assigned container)
- ✅ Can view assigned containers
- ✅ Full system access based on role

### Rejected Users
- ❌ Cannot login
- ❌ Shows rejection message
- ❌ Must contact administrator

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/signup` - Email signup
- `POST /api/auth/login` - Email login
- `POST /api/auth/sso` - SSO signup/login

### Admin Management
- `GET /api/admin/pending-users` - List pending users
- `POST /api/admin/approve-user/{id}` - Approve user
- `POST /api/admin/reject-user/{id}` - Reject user
- `GET /api/admin/users` - List all users (with status filter)

---

## Expected Behavior

### Email Signup
```
User fills form → Backend creates guest → Invitation sent → 
User accepts → Pending approval → Admin approves → User can login
```

### Google Signup
```
Google OAuth → Backend creates guest → Invitation sent → 
User accepts → Pending approval → Admin approves → User can login
```

### Microsoft Signup
```
Microsoft OAuth → Backend creates user → Pending approval → 
Admin approves → User can login
```

### Login (Pending User)
```
User enters credentials → Backend checks status → 
Status = PENDING_APPROVAL → Show pending page → No access
```

### Login (Active User)
```
User enters credentials → Backend checks status → 
Status = ACTIVE → Allow access → Redirect to dashboard
```

---

## Security Features

1. **Guest Invitations** - External users invited via Microsoft Graph API
2. **Status Checks** - Every login validates user status
3. **Admin Approval** - No access until admin approves
4. **Role-Based Access** - Different permissions per role
5. **Audit Logs** - All actions logged for compliance

---

## Testing Checklist

- [ ] Email signup creates pending user
- [ ] Google signup creates guest invitation
- [ ] Microsoft signup creates pending user
- [ ] Pending users see approval page
- [ ] Pending users cannot access dashboard
- [ ] Admin can view pending users
- [ ] Admin can approve users
- [ ] Admin can reject users
- [ ] Approved users can login
- [ ] Rejected users cannot login
- [ ] Status persists across sessions
