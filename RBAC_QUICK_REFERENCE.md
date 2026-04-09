# RBAC Quick Reference Guide

## 🚀 Quick Start

### 1. Run Setup
```bash
setup_rbac.bat
```

### 2. Configure Google OAuth
Update `.env`:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 3. Start Services
```bash
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
npm start
```

## 🔐 Authentication Flow

```
Login → Google Auth → Microsoft Auth → Role Check → Dashboard Redirect
```

## 👥 User Roles

| Role | Code | Dashboard | Permissions |
|------|------|-----------|-------------|
| Global Admin | `GLOBAL_ADMIN` | `/admin` | Full access |
| User Admin | `USER_ADMIN` | `/admin` | Create users, containers |
| User | `USER` | `/dashboard` | Upload files only |

## 🛡️ Protecting API Endpoints

### Method 1: Decorator
```python
from routers.rbac_middleware import require_role, require_global_admin

@router.delete("/users/{id}")
@require_global_admin
async def delete_user(id: int):
    # Only GLOBAL_ADMIN can access
    pass
```

### Method 2: Manual Check
```python
from routers.auth import get_current_user

@router.get("/data")
async def get_data(authorization: str = Header(None)):
    user = await get_current_user(authorization)
    if user["role"] not in ["GLOBAL_ADMIN", "USER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied")
    # Your code here
```

## 🎯 Frontend Role Checks

### Check User Role
```typescript
import { getCurrentUser } from './services/authService';

const user = getCurrentUser();
const isAdmin = ['GLOBAL_ADMIN', 'USER_ADMIN', 'GlobalAdmin', 'UserAdmin'].includes(user?.role);

if (isAdmin) {
    // Show admin features
}
```

### Conditional Routing
```tsx
{isAdmin && (
    <Route path="/admin" element={<AdminManagement />} />
)}
```

## 📊 Dashboard Mapping

```typescript
GLOBAL_ADMIN → /admin
USER_ADMIN   → /admin
USER         → /dashboard
PendingApproval → /login/pendingapprovaluser
```

## 🔧 Common Tasks

### Add New Role
1. Update database enum:
```sql
ALTER TABLE users MODIFY COLUMN role ENUM('GLOBAL_ADMIN', 'USER_ADMIN', 'USER', 'NEW_ROLE');
```

2. Update `get_dashboard_by_role()` in `auth.py`
3. Update role checks in frontend

### Protect New Endpoint
```python
@router.post("/new-feature")
@require_role(["GLOBAL_ADMIN", "USER_ADMIN"])
async def new_feature():
    pass
```

### Check User Status
```sql
SELECT email, role, googleAuthenticated, microsoftAuthenticated, lastLogin 
FROM users 
WHERE email = 'user@example.com';
```

## 🐛 Debugging

### Check Authentication Status
```typescript
console.log('User:', getCurrentUser());
console.log('Account:', getCurrentAccount());
```

### Verify Token
```python
# In backend
print(f"User ID: {user_id}, Role: {user['role']}")
```

### Clear Auth State
```typescript
localStorage.clear();
sessionStorage.clear();
// Reload page
```

## 📝 Testing Checklist

- [ ] Google login works
- [ ] Microsoft login required after Google
- [ ] Role assigned correctly
- [ ] Dashboard redirect works
- [ ] Admin can access /admin
- [ ] User cannot access /admin
- [ ] API protection works
- [ ] Logout clears session

## 🔗 Important Files

| File | Purpose |
|------|---------|
| `backend/routers/auth.py` | Authentication logic |
| `backend/routers/rbac_middleware.py` | API protection |
| `src/services/authService.ts` | Frontend auth |
| `src/components/AuthCallback.tsx` | OAuth callback |
| `src/App.tsx` | Role-based routing |

## 📞 Support

See `RBAC_AUTHENTICATION_COMPLETE.md` for detailed documentation.
