# Microsoft Login Complete Flow - Implementation Guide

## Overview
This document describes the complete Microsoft login flow that automatically logs in existing users without showing the signup page.

## Flow Steps

### STEP 1 — Microsoft Login (Frontend)

1. User clicks "Continue with Microsoft"
2. MSAL login popup/redirect opens
3. User selects Microsoft account
4. Microsoft returns:
   - ID token
   - Access token
   - Email
   - OID (user id)
   - Tenant ID

5. Frontend calls backend:
```typescript
POST /auth/microsoft
{
  idToken: string,
  accessToken: string
}
```

### STEP 2 — Backend Validate Microsoft User

Backend decodes ID token and extracts:
- email
- oid (entra user id)
- name
- tenantId

### STEP 3 — Check User in MySQL

```sql
SELECT * FROM users WHERE email = ?
```

**IF user exists:**
- ✅ Login user
- ✅ Generate JWT (if needed)
- ✅ Return dashboard role
- ❌ NO signup
- ❌ NO guest creation

### STEP 4 — If User Not Exists

Check Microsoft Graph API:
```
GET https://graph.microsoft.com/v1.0/me
```

**If exists in tenant:**
- Create user in MySQL
- Determine role (see Step 5)

**If NOT in tenant:**
- ❌ Reject login

### STEP 5 — Check Global Admin

Check using Microsoft Graph:
```
GET https://graph.microsoft.com/v1.0/me/memberOf
```

Check if user belongs to:
- Company Administrator
- Global Administrator

**If yes:**
- role = `GlobalAdmin`

**Else:**
- role = `User`

### STEP 6 — Save User

Insert into MySQL:
```sql
INSERT INTO users (name, email, entra_user_id, auth_provider, role, status)
VALUES (?, ?, ?, 'microsoft', ?, 'ACTIVE')
```

### STEP 7 — Return Login Response

```json
{
  "id": 123,
  "name": "John Doe",
  "email": "john@company.com",
  "role": "GlobalAdmin",
  "auth_provider": "microsoft"
}
```

### STEP 8 — Frontend Redirect

Based on role:
- `GlobalAdmin` → `/dashboard` (Global Admin Dashboard)
- `UserAdmin` → `/dashboard` (User Admin Dashboard)
- `User` → `/dashboard` (User Dashboard)
- `PendingApproval` → `/login/pendingapprovaluser`

## Role Permissions

### GLOBAL ADMIN PERMISSIONS
- Create Container Type
- Create Containers
- Create Applications
- Create Users
- Assign Containers
- Manage Roles

### USER ADMIN PERMISSIONS
- Assign containers to users
- Assign containers to apps
- Approve users
- Manage normal users

### NORMAL USER PERMISSIONS
- View assigned containers
- Upload files
- Download files

## Important Rules

### NO Duplicate Users
If Microsoft user already logged in once:
- ❌ Do NOT show signup page again
- ❌ Do NOT create guest user again
- ❌ Do NOT create duplicate user
- ✅ Always login directly

### Login Decision Logic

```
IF user exists in DB
  → login

ELSE IF user exists in Microsoft tenant
  → create user
  → login

ELSE
  → reject login
```

## Database Schema

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  entra_user_id VARCHAR(255),
  auth_provider ENUM('email', 'google', 'microsoft') DEFAULT 'email',
  role ENUM('GlobalAdmin', 'UserAdmin', 'User', 'PendingApproval') DEFAULT 'PendingApproval',
  status ENUM('ACTIVE', 'PENDING_APPROVAL', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Files

### Backend
- `backend/routers/auth.py` - Contains `/microsoft` endpoint

### Frontend
- `src/components/AuthCallback.tsx` - Handles redirect callback
- `src/services/authService.ts` - Contains `microsoftAuth()` function
- `src/components/Login.tsx` - Login page with Microsoft button

## Testing

1. **First-time user (Global Admin):**
   - Click "Continue with Microsoft"
   - Should create user with `GlobalAdmin` role
   - Should redirect to `/dashboard`

2. **First-time user (Normal User):**
   - Click "Continue with Microsoft"
   - Should create user with `User` role
   - Should redirect to `/dashboard`

3. **Existing user:**
   - Click "Continue with Microsoft"
   - Should login directly (no user creation)
   - Should redirect to `/dashboard`

4. **User not in tenant:**
   - Click "Continue with Microsoft"
   - Should show error: "User not found in Microsoft tenant"
   - Should redirect to `/login`

## Security Notes

- ID token is decoded without signature verification (frontend already validated)
- Access token is used to call Microsoft Graph API
- User must exist in Microsoft tenant to be created in database
- Admin status is checked via Microsoft Graph API
