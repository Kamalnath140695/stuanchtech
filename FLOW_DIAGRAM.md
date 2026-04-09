# Authentication Flow - Visual Diagram

## Complete Authentication & Authorization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER AUTHENTICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │  User Visits │
                              │  /login or   │
                              │   /signup    │
                              └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────▼────────┐  ┌───▼────────┐  ┌───▼────────┐
            │ Email/Password │  │  Microsoft │  │   Google   │
            │     Login      │  │    SSO     │  │    SSO     │
            └───────┬────────┘  └───┬────────┘  └───┬────────┘
                    │               │               │
                    │               │               │
┌───────────────────▼───────────────▼───────────────▼───────────────────┐
│                         BACKEND AUTHENTICATION                         │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ EMAIL/PASSWORD FLOW                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. POST /api/auth/register or /api/auth/login                              │
│     ↓                                                                        │
│  2. Validate credentials against MySQL                                       │
│     ↓                                                                        │
│  3. Check if first user:                                                     │
│     ├─ YES → Role: GlobalAdmin, Status: ACTIVE                              │
│     └─ NO  → Role: NormalUser, Status: PENDING_APPROVAL                     │
│     ↓                                                                        │
│  4. Return user object with role                                             │
│     ↓                                                                        │
│  5. Frontend stores in localStorage                                          │
│     ↓                                                                        │
│  6. Redirect:                                                                │
│     ├─ ACTIVE → /dashboard                                                  │
│     └─ PENDING_APPROVAL → /login/pendingapprovaluser                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ MICROSOFT SSO FLOW                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User clicks "Continue with Microsoft"                                    │
│     ↓                                                                        │
│  2. MSAL redirects to Microsoft login                                        │
│     ↓                                                                        │
│  3. User authenticates with Microsoft                                        │
│     ↓                                                                        │
│  4. Microsoft redirects to /auth-callback with tokens                        │
│     ↓                                                                        │
│  5. Frontend extracts idToken and accessToken                                │
│     ↓                                                                        │
│  6. POST /api/auth/microsoft with tokens                                     │
│     ↓                                                                        │
│  7. Backend decodes ID token (email, name, oid)                              │
│     ↓                                                                        │
│  8. Check if user exists in MySQL:                                           │
│     ├─ YES → Return existing user (LOGIN)                                   │
│     └─ NO  → Continue to step 9                                             │
│     ↓                                                                        │
│  9. Verify user in Microsoft tenant via Graph API                            │
│     ↓                                                                        │
│ 10. Check Microsoft Graph roles:                                             │
│     ├─ "Global Administrator" → Role: GlobalAdmin                           │
│     ├─ "User Administrator" → Role: UserAdmin                               │
│     └─ Regular user → Role: NormalUser                                      │
│     ↓                                                                        │
│ 11. Create user in MySQL with determined role, Status: ACTIVE               │
│     ↓                                                                        │
│ 12. Return user object                                                       │
│     ↓                                                                        │
│ 13. Frontend stores in localStorage                                          │
│     ↓                                                                        │
│ 14. Redirect to /dashboard                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ GOOGLE SSO FLOW                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User clicks "Continue with Google"                                       │
│     ↓                                                                        │
│  2. MSAL redirects to Google login                                           │
│     ↓                                                                        │
│  3. User authenticates with Google                                           │
│     ↓                                                                        │
│  4. Redirects to /auth-callback                                              │
│     ↓                                                                        │
│  5. POST /api/auth/sso with name, email, provider                            │
│     ↓                                                                        │
│  6. Check if user exists in MySQL:                                           │
│     ├─ YES → Return existing user                                           │
│     └─ NO  → Continue to step 7                                             │
│     ↓                                                                        │
│  7. Create guest invitation in Microsoft Entra ID                            │
│     ↓                                                                        │
│  8. Create user in MySQL:                                                    │
│     ├─ Role: NormalUser                                                     │
│     └─ Status: PENDING_APPROVAL                                             │
│     ↓                                                                        │
│  9. Return user object                                                       │
│     ↓                                                                        │
│ 10. Frontend stores in localStorage                                          │
│     ↓                                                                        │
│ 11. Redirect to /login/pendingapprovaluser                                   │
│     ↓                                                                        │
│ 12. Admin approves user → Status: ACTIVE                                     │
│     ↓                                                                        │
│ 13. User can now access /dashboard                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHORIZATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │  User Authenticated  │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  RBACContext Loads   │
                    │  Role from           │
                    │  localStorage        │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
        ┌───────▼────────┐ ┌──▼──────────┐ ┌▼────────────┐
        │  GlobalAdmin   │ │  UserAdmin  │ │ NormalUser  │
        └───────┬────────┘ └──┬──────────┘ └┬────────────┘
                │              │              │
                │              │              │
┌───────────────▼──────────────▼──────────────▼───────────────┐
│                    PERMISSION MATRIX                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  GlobalAdmin:                                                │
│    ✅ Full system access                                    │
│    ✅ Manage all users                                      │
│    ✅ Create/delete containers, apps                        │
│    ✅ Assign any role                                       │
│    ✅ View audit logs                                       │
│    ✅ Override permissions                                  │
│                                                              │
│  UserAdmin:                                                  │
│    ✅ Manage NormalUsers only                               │
│    ✅ Approve/reject pending users                          │
│    ✅ Assign NormalUser role only                           │
│    ✅ Manage assigned containers                            │
│    ✅ View audit logs                                       │
│    ❌ Cannot manage admins                                  │
│    ❌ Cannot create apps                                    │
│                                                              │
│  NormalUser:                                                 │
│    ✅ Access assigned containers                            │
│    ✅ Upload/download files                                 │
│    ❌ No admin access                                       │
│    ❌ Cannot manage users                                   │
│    ❌ Cannot view audit logs                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROUTE PROTECTION                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │  User Navigates to   │
                    │      Route           │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Check isAuthenticated│
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  NO → /login         │
                    │  YES → Continue      │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Check Status        │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
    ┌───────────▼──────┐  ┌───▼────────┐  ┌─▼──────────┐
    │ PENDING_APPROVAL │  │   ACTIVE   │  │  REJECTED  │
    └───────────┬──────┘  └───┬────────┘  └─┬──────────┘
                │             │              │
                │             │              │
    ┌───────────▼──────┐  ┌───▼────────┐  ┌─▼──────────┐
    │ /login/pending   │  │ Check Role │  │ Show Error │
    │ approvaluser     │  └───┬────────┘  └────────────┘
    └──────────────────┘      │
                              │
                ┌─────────────┼─────────────┐
                │             │             │
    ┌───────────▼──────┐  ┌───▼────────┐  ┌▼────────────┐
    │  Admin Routes    │  │ /dashboard │  │ User Routes │
    │  (GlobalAdmin,   │  │            │  │             │
    │   UserAdmin)     │  │            │  │             │
    └──────────────────┘  └────────────┘  └─────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    PENDING APPROVAL WORKFLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │  New User Signs  │
    │       Up         │
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │  Status:         │
    │ PENDING_APPROVAL │
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │  Redirect to     │
    │  Pending Page    │
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │  Admin Reviews   │
    │  in User Mgmt    │
    └────────┬─────────┘
             │
    ┌────────┴─────────┐
    │                  │
┌───▼────────┐  ┌──────▼──────┐
│  Approve   │  │   Reject    │
└───┬────────┘  └──────┬──────┘
    │                  │
┌───▼────────┐  ┌──────▼──────┐
│  Status:   │  │  Status:    │
│  ACTIVE    │  │  REJECTED   │
└───┬────────┘  └──────┬──────┘
    │                  │
┌───▼────────┐  ┌──────▼──────┐
│ User can   │  │ User cannot │
│ access     │  │ login       │
│ dashboard  │  │             │
└────────────┘  └─────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │◄────►│   Backend    │◄────►│    MySQL     │
│              │      │              │      │   Database   │
│ localStorage │      │  FastAPI     │      │              │
│ sessionStorage│      │  Endpoints   │      │ users table  │
└──────────────┘      └──────────────┘      └──────────────┘
       │                     │                      │
       │                     │                      │
       ▼                     ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ current_user │      │ Role         │      │ id, name,    │
│ adminRole    │      │ Verification │      │ email, role, │
│ pending_     │      │ Permission   │      │ status,      │
│ approval     │      │ Checks       │      │ provider     │
└──────────────┘      └──────────────┘      └──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROLE DETECTION PRIORITY                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    1. localStorage (Frontend)
       ↓
    2. MySQL Database (Backend)
       ↓
    3. Microsoft Graph API (For Microsoft users)
       ↓
    4. Default: NormalUser

┌─────────────────────────────────────────────────────────────────────────────┐
│                         KEY COMPONENTS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend:
  ├─ RBACContext.tsx       → Role management and permission checks
  ├─ RBACGuard.tsx         → Route protection component
  ├─ authService.ts        → Authentication functions
  ├─ App.tsx               → Route configuration
  ├─ Login.tsx             → Login page
  ├─ Signup.tsx            → Registration page
  └─ AuthCallback.tsx      → SSO callback handler

Backend:
  ├─ routers/auth.py       → Authentication endpoints
  ├─ routers/users.py      → User management endpoints
  ├─ routers/rbac_utils.py → Role verification utilities
  └─ database.py           → Database connection and schema

Database:
  └─ users table           → User data storage
     ├─ id (PRIMARY KEY)
     ├─ name
     ├─ email (UNIQUE)
     ├─ entra_user_id
     ├─ provider (email/google/microsoft)
     ├─ role (GlobalAdmin/UserAdmin/NormalUser)
     ├─ status (PENDING_APPROVAL/ACTIVE/REJECTED)
     └─ timestamps (created_at, approved_at, rejected_at)

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                      │
└─────────────────────────────────────────────────────────────────────────────┘

    Layer 1: Frontend (UI Protection)
       ↓
    Layer 2: Route Guards (Navigation Protection)
       ↓
    Layer 3: Backend Role Verification (API Protection)
       ↓
    Layer 4: Database Constraints (Data Protection)

    ⚠️ Frontend checks are for UX only
    ✅ Backend always enforces permissions
```

## Quick Reference

### Role Assignment Rules:
- **First User** → GlobalAdmin (automatic)
- **Microsoft Global Admin** → GlobalAdmin (via Graph API)
- **Microsoft User Admin** → UserAdmin (via Graph API)
- **Microsoft Regular User** → NormalUser (via Graph API)
- **Google User** → NormalUser + PENDING_APPROVAL
- **Email User** → NormalUser + PENDING_APPROVAL

### Status Flow:
```
PENDING_APPROVAL → (Admin Approves) → ACTIVE
PENDING_APPROVAL → (Admin Rejects) → REJECTED
```

### Permission Hierarchy:
```
GlobalAdmin > UserAdmin > NormalUser > PendingApproval
```

### Authentication Methods:
1. **Email/Password** - Local MySQL authentication
2. **Microsoft SSO** - Azure AD with role detection
3. **Google SSO** - Google OAuth with pending approval
