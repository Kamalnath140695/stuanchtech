# Microsoft Login Flow - Complete Decision Tree

## User Login Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User Clicks "Continue with Microsoft"                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ MSAL Authenticates User                                         │
│ Returns: idToken, accessToken, email, oid, tenantId            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Redirects to /auth-callback                            │
│ Calls: POST /api/auth/microsoft                                 │
│ Sends: { idToken, accessToken }                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: Decode ID Token                                        │
│ Extract: email, name, oid, tenantId                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴────────┐
                    │                │
                    ↓                ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ User Exists      │  │ User NOT Exists  │
        │ in MySQL?        │  │ in MySQL?        │
        │ YES              │  │ NO               │
        └──────────────────┘  └──────────────────┘
                    │                │
                    ↓                ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ Return User Data │  │ Check Microsoft  │
        │ with Role        │  │ Graph for Admin  │
        │ Status: ACTIVE   │  │ Role             │
        └──────────────────┘  └──────────────────┘
                    │                │
                    │        ┌───────┴────────┐
                    │        │                │
                    │        ↓                ↓
                    │   ┌─────────────┐  ┌──────────────┐
                    │   │ Is Global   │  │ Is NOT       │
                    │   │ Admin?      │  │ Global Admin?│
                    │   │ YES         │  │ NO           │
                    │   └─────────────┘  └──────────────┘
                    │        │                │
                    │        ↓                ↓
                    │   ┌─────────────┐  ┌──────────────┐
                    │   │ Create User │  │ Create User  │
                    │   │ Role:       │  │ Role:        │
                    │   │ GlobalAdmin │  │ PendingAppr. │
                    │   └─────────────┘  └──────────────┘
                    │        │                │
                    └────────┴────────────────┘
                            ↓
        ┌──────────────────────────────────────┐
        │ Return User Data to Frontend         │
        │ {                                    │
        │   id, name, email, role,             │
        │   auth_provider, status              │
        │ }                                    │
        └──────────────────────────────────────┘
                            ↓
                    ┌───────┴────────┐
                    │                │
                    ↓                ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ Role ==          │  │ Role ==          │
        │ PendingApproval? │  │ GlobalAdmin or   │
        │ YES              │  │ UserAdmin?       │
        │                  │  │ YES              │
        └──────────────────┘  └──────────────────┘
                    │                │
                    ↓                ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ Redirect to:     │  │ Redirect to:     │
        │ /login/pending   │  │ /dashboard       │
        │ approvaluser     │  │                  │
        └──────────────────┘  └──────────────────┘
```

## Detailed Step-by-Step

### STEP 1: Microsoft Login (Frontend)
```
User Action: Click "Continue with Microsoft"
↓
MSAL Configuration:
  - clientId: 44e5a5e8-847f-465d-a68a-3a516aefbe97
  - authority: https://login.microsoftonline.com/common
  - redirectUri: /auth-callback
  - scopes: ['User.Read', 'profile', 'openid', 'email']
↓
MSAL Returns:
  - idToken: JWT containing email, name, oid, tenantId
  - accessToken: For Microsoft Graph API calls
  - account: User account info
```

### STEP 2: Backend Validates Microsoft User
```
Endpoint: POST /api/auth/microsoft
Request Body:
{
  "idToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Backend Actions:
1. Decode ID Token (no signature verification needed)
2. Extract:
   - email: from "email" or "preferred_username" claim
   - name: from "name" claim
   - oid: from "oid" claim (Entra user ID)
   - tenantId: from "tid" claim
```

### STEP 3: Check User in MySQL
```
Query: SELECT * FROM users WHERE email = ?

IF user exists:
  ✓ Login user
  ✓ Return user data with role
  ✓ NO signup page
  ✓ NO guest creation
  ✓ NO duplicate user

ELSE:
  → Continue to STEP 4
```

### STEP 4: If User Not Exists
```
Check Microsoft Graph API:
GET https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName,id

Headers:
  Authorization: Bearer {accessToken}

Response:
{
  "value": [
    {
      "id": "...",
      "displayName": "Company Administrator"
    },
    ...
  ]
}

If user exists in tenant:
  → Continue to STEP 5
Else:
  → Reject login (user not in tenant)
```

### STEP 5: Check Global Admin Status
```
Check Microsoft Graph:
GET https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName,id

Admin Roles to Check:
  - "Company Administrator"
  - "Global Administrator"

IF user belongs to admin role:
  role = "GlobalAdmin"
ELSE:
  role = "PendingApproval"
```

### STEP 6: Save User to MySQL
```
INSERT INTO users (name, email, auth_provider, role)
VALUES (?, ?, 'microsoft', ?)

Fields:
  - name: from ID token
  - email: from ID token (lowercase)
  - auth_provider: 'microsoft'
  - role: 'GlobalAdmin' or 'PendingApproval'
  - created_at: CURRENT_TIMESTAMP (auto)
```

### STEP 7: Return Login Response
```
Response:
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "GlobalAdmin",
  "auth_provider": "microsoft",
  "status": "ACTIVE"
}
```

### STEP 8: Frontend Redirect
```
IF role == "GlobalAdmin":
  → Redirect to /dashboard (with admin permissions)

IF role == "UserAdmin":
  → Redirect to /dashboard (with user admin permissions)

IF role == "PendingApproval":
  → Redirect to /login/pendingapprovaluser

IF role == "User":
  → Redirect to /dashboard (with user permissions)
```

## Permission Matrix

### GLOBAL ADMIN
- ✓ Create Container Type
- ✓ Create Containers
- ✓ Create Applications
- ✓ Create Users
- ✓ Assign Containers
- ✓ Manage Roles
- ✓ Assign containers to users
- ✓ Assign containers to apps
- ✓ Approve users
- ✓ Manage normal users
- ✓ View assigned containers
- ✓ Upload files
- ✓ Download files

### USER ADMIN
- ✓ Assign containers to users
- ✓ Assign containers to apps
- ✓ Approve users
- ✓ Manage normal users
- ✓ View assigned containers
- ✓ Upload files
- ✓ Download files

### NORMAL USER
- ✓ View assigned containers
- ✓ Upload files
- ✓ Download files

### PENDING APPROVAL
- ✗ No access to dashboard
- ✗ Show pending approval page
- ✗ Wait for admin approval

## Important Rules

### Rule 1: No Signup Page for Microsoft Users
```
IF provider == 'microsoft':
  → Skip signup page entirely
  → Create user automatically
  → Show pending approval or dashboard
```

### Rule 2: No Duplicate Users
```
Email Column: UNIQUE NOT NULL
Matching: Case-insensitive (convert to lowercase)

IF email already exists:
  → Login existing user
  → Do NOT create new user
```

### Rule 3: No Guest Creation
```
IF user not in Microsoft tenant:
  → Reject login
  → Show error message
  → Do NOT create guest account
```

### Rule 4: Admin Detection
```
Check Microsoft Graph API:
  - Query: /me/memberOf
  - Look for: "Company Administrator" or "Global Administrator"
  - If found: role = "GlobalAdmin"
  - Else: role = "PendingApproval"
```

### Rule 5: Cache Management
```
ON LOGIN:
  → Store user in localStorage
  → Store role in localStorage
  → Do NOT clear cache

ON LOGOUT:
  → Clear localStorage
  → Clear sessionStorage
  → Clear MSAL cache
  → Redirect to /login
```

## Error Handling

### Error: Invalid ID Token
```
Status: 400
Message: "Invalid ID token: {error}"
Action: Redirect to login, show error
```

### Error: Email Not Found
```
Status: 400
Message: "Email not found in token"
Action: Redirect to login, show error
```

### Error: Graph API Failure
```
Status: 500
Message: "Failed to check admin status"
Action: Default to PendingApproval role
```

### Error: Database Error
```
Status: 500
Message: "Database error"
Action: Redirect to login, show error
```

## Testing Scenarios

### Scenario 1: First-Time User (Non-Admin)
```
1. User clicks "Continue with Microsoft"
2. MSAL authenticates
3. Backend creates user with PendingApproval role
4. Frontend shows pending approval page
5. Admin approves user
6. User can access dashboard
```

### Scenario 2: First-Time User (Admin)
```
1. User clicks "Continue with Microsoft"
2. MSAL authenticates
3. Backend detects Global Admin role
4. Backend creates user with GlobalAdmin role
5. Frontend redirects to dashboard
6. User has full admin access
```

### Scenario 3: Returning User
```
1. User clicks "Continue with Microsoft"
2. MSAL authenticates
3. Backend finds user in database
4. Backend returns user data
5. Frontend redirects to dashboard
6. User logged in with existing role
```

### Scenario 4: User Logout and Re-login
```
1. User clicks logout
2. Cache cleared
3. User clicks "Continue with Microsoft"
4. MSAL authenticates again
5. Backend finds user in database
6. User logged in again
```

## Database Queries

### Check if user exists
```sql
SELECT * FROM users WHERE email = ?
```

### Create new user
```sql
INSERT INTO users (name, email, auth_provider, role)
VALUES (?, ?, 'microsoft', ?)
```

### Update user role
```sql
UPDATE users SET role = ? WHERE email = ?
```

### Get user by email
```sql
SELECT id, name, email, role, auth_provider FROM users WHERE email = ?
```

### Get all users by provider
```sql
SELECT * FROM users WHERE auth_provider = 'microsoft'
```

## API Response Examples

### Success - Existing User
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

### Success - New User (Non-Admin)
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

### Error - Invalid Token
```json
{
  "detail": "Invalid ID token: Invalid token format"
}
```

### Error - Email Not Found
```json
{
  "detail": "Email not found in token"
}
```
