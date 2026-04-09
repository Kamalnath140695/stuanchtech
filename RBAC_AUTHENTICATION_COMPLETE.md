# Complete RBAC Authentication Flow with Google + Microsoft

## Overview
This implementation provides enterprise-grade authentication with Role-Based Access Control (RBAC) supporting both Google and Microsoft authentication.

## Authentication Flow

```
User Login
    ↓
Google Authentication
    ↓
Verify Google Token
    ↓
Check/Create User in DB
    ↓
Microsoft Authentication (Required)
    ↓
Verify Microsoft Token
    ↓
Update DB (microsoftAuthenticated = true)
    ↓
Get User Role from DB
    ↓
Redirect to Dashboard Based on Role
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    entraId VARCHAR(255),
    auth_provider ENUM('email', 'google', 'microsoft') DEFAULT 'email',
    role ENUM('GLOBAL_ADMIN', 'USER_ADMIN', 'USER', 'GlobalAdmin', 'UserAdmin', 'NormalUser', 'PendingApproval') DEFAULT 'USER',
    status ENUM('ACTIVE', 'PENDING_APPROVAL', 'INACTIVE') DEFAULT 'ACTIVE',
    googleAuthenticated BOOLEAN DEFAULT FALSE,
    microsoftAuthenticated BOOLEAN DEFAULT FALSE,
    lastLogin DATETIME,
    loginStatus ENUM('ONLINE', 'OFFLINE') DEFAULT 'OFFLINE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Roles

### 1. GLOBAL_ADMIN
- Full system access
- Can create/delete users
- Can manage all containers
- Can assign roles
- Can view audit logs

### 2. USER_ADMIN
- Can create users
- Can manage containers
- Can upload files
- Cannot delete users
- Cannot manage roles

### 3. USER
- Can upload files
- Can view assigned containers
- Cannot create users
- Cannot manage containers

## Backend Implementation

### 1. Google Authentication Endpoint
**POST** `/api/auth/google`

```python
{
    "idToken": "google_id_token",
    "accessToken": "google_access_token"
}
```

**Response:**
```json
{
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER",
    "auth_provider": "google",
    "requiresMicrosoft": true,
    "message": "Please complete Microsoft authentication"
}
```

### 2. Microsoft Authentication Endpoint
**POST** `/api/auth/microsoft`

```python
{
    "idToken": "microsoft_id_token",
    "accessToken": "microsoft_access_token"
}
```

**Response:**
```json
{
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER_ADMIN",
    "auth_provider": "microsoft",
    "dashboard": "/admin"
}
```

### 3. Role-Based Dashboard Mapping

```python
def get_dashboard_by_role(role: str) -> str:
    role_map = {
        "GLOBAL_ADMIN": "/admin",
        "GlobalAdmin": "/admin",
        "USER_ADMIN": "/admin",
        "UserAdmin": "/admin",
        "USER": "/dashboard",
        "NormalUser": "/dashboard",
        "PendingApproval": "/login/pendingapprovaluser"
    }
    return role_map.get(role, "/dashboard")
```

## Frontend Implementation

### 1. Login Flow
```typescript
// User clicks "Continue with Google"
await loginRedirect('google');

// After redirect, AuthCallback processes:
const dbUser = await googleAuth(idToken, accessToken);

if (dbUser.requiresMicrosoft) {
    // Redirect to Microsoft login
    await loginRedirect('microsoft');
}

// After Microsoft auth:
const finalUser = await microsoftAuth(idToken, accessToken);

// Redirect based on role
window.location.href = finalUser.dashboard;
```

### 2. Role-Based Routing
```typescript
const isAdmin = ['GlobalAdmin', 'UserAdmin', 'GLOBAL_ADMIN', 'USER_ADMIN'].includes(currentUser?.role);

{isAdmin && (
    <Route path="/admin" element={<AdminManagement />}>
        <Route path="containers" element={<Containers />} />
        <Route path="users" element={<UserManagement />} />
    </Route>
)}
```

## API Protection

### Using Middleware
```python
from routers.rbac_middleware import require_role, require_global_admin, require_admin

# Global Admin only
@router.delete("/users/{user_id}")
@require_global_admin
async def delete_user(user_id: int):
    # Only GLOBAL_ADMIN can access
    pass

# Admin only (Global + User Admin)
@router.post("/containers")
@require_admin
async def create_container():
    # GLOBAL_ADMIN and USER_ADMIN can access
    pass

# Custom roles
@router.get("/reports")
@require_role(["GLOBAL_ADMIN", "USER_ADMIN"])
async def get_reports():
    # Specific roles can access
    pass
```

## Dashboard Access Matrix

| Feature | Global Admin | User Admin | User |
|---------|-------------|------------|------|
| Create Users | ✅ | ✅ | ❌ |
| Delete Users | ✅ | ❌ | ❌ |
| Create Container | ✅ | ✅ | ❌ |
| Upload Files | ✅ | ✅ | ✅ |
| Manage Roles | ✅ | ❌ | ❌ |
| View All Containers | ✅ | ✅ | ❌ |
| View Audit Logs | ✅ | ❌ | ❌ |

## Setup Instructions

### 1. Database Migration
```bash
cd backend
python migrate_rbac.py
```

### 2. Install Dependencies
```bash
# Backend
pip install -r requirements.txt

# Frontend
npm install
```

### 3. Configure Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth-callback`
   - `http://localhost:3000`
6. Copy Client ID and update `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

### 4. Configure Microsoft OAuth
Already configured in your `.env`:
```
API_ENTRA_APP_CLIENT_ID=44e5a5e8-847f-465d-a68a-3a516aefbe97
API_ENTRA_APP_AUTHORITY=https://login.microsoftonline.com/cd42dbac-81bd-4fbd-b910-49ca5f79737f
```

### 5. Start Services
```bash
# Backend
cd backend
uvicorn main:app --reload --port 8000

# Frontend
npm start
```

## Testing the Flow

### Test Case 1: New User with Google + Microsoft
1. Click "Continue with Google"
2. Select Google account
3. System creates user with `googleAuthenticated = true`
4. Redirects to Microsoft login
5. Select Microsoft account
6. System updates `microsoftAuthenticated = true`
7. Checks Microsoft Graph for role
8. Redirects to appropriate dashboard

### Test Case 2: Existing User Login
1. Click "Continue with Google" or "Continue with Microsoft"
2. System finds existing user
3. Updates `lastLogin` and `loginStatus`
4. Redirects to dashboard based on stored role

### Test Case 3: Role-Based Access
1. Login as USER
2. Try to access `/admin` → Redirected to `/dashboard`
3. Login as USER_ADMIN
4. Access `/admin` → Success
5. Try to delete user → 403 Forbidden

## Security Considerations

1. **Token Validation**: Both Google and Microsoft tokens are validated server-side
2. **Role Verification**: Every protected API checks user role from database
3. **Session Management**: Uses MSAL for secure session handling
4. **HTTPS Required**: Production must use HTTPS
5. **CORS Configuration**: Restrict to known origins
6. **SQL Injection Prevention**: Uses parameterized queries

## Troubleshooting

### Issue: "User not found in Microsoft tenant"
**Solution**: User must exist in your Microsoft Entra ID tenant

### Issue: "Invalid Google token"
**Solution**: Check GOOGLE_CLIENT_ID in .env matches Google Console

### Issue: "Access denied" on API calls
**Solution**: Verify user role in database matches required role

### Issue: Redirect loop
**Solution**: Clear browser cache and localStorage, check role mapping

## API Endpoints Summary

| Endpoint | Method | Auth Required | Roles |
|----------|--------|---------------|-------|
| `/api/auth/register` | POST | No | - |
| `/api/auth/login` | POST | No | - |
| `/api/auth/google` | POST | No | - |
| `/api/auth/microsoft` | POST | No | - |
| `/api/users` | GET | Yes | GLOBAL_ADMIN, USER_ADMIN |
| `/api/users/{id}` | DELETE | Yes | GLOBAL_ADMIN |
| `/api/containers` | POST | Yes | GLOBAL_ADMIN, USER_ADMIN |
| `/api/files/upload` | POST | Yes | All authenticated |

## Next Steps

1. ✅ Database migration completed
2. ✅ Backend authentication flow implemented
3. ✅ Frontend integration completed
4. ✅ Role-based routing added
5. ✅ API protection middleware created
6. 🔲 Configure Google OAuth credentials
7. 🔲 Test complete flow
8. 🔲 Deploy to production

## Support

For issues or questions, refer to:
- Microsoft Graph API: https://docs.microsoft.com/graph
- Google OAuth: https://developers.google.com/identity
- FastAPI: https://fastapi.tiangolo.com
