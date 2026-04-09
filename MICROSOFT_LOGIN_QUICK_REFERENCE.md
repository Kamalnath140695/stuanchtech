# Microsoft Login - Quick Reference

## 🎯 Core Principle
**Existing users login directly. New users are created only if they exist in Microsoft tenant.**

## 🔄 Flow Diagram

```
User clicks "Continue with Microsoft"
           ↓
    MSAL Authentication
           ↓
    Get ID Token + Access Token
           ↓
    POST /auth/microsoft
           ↓
    Check user in database
           ↓
    ┌──────────────────┐
    │  User exists?    │
    └──────────────────┘
         ↓         ↓
       YES        NO
         ↓         ↓
      LOGIN    Check Microsoft Tenant
         ↓         ↓
         │    ┌──────────────────┐
         │    │  In tenant?      │
         │    └──────────────────┘
         │         ↓         ↓
         │       YES        NO
         │         ↓         ↓
         │    Check Admin  REJECT
         │         ↓
         │    Create User
         │         ↓
         └─────→ LOGIN
                  ↓
            Redirect to Dashboard
```

## 📊 Decision Matrix

| Scenario | User in DB? | In Tenant? | Action | Role |
|----------|-------------|------------|--------|------|
| Existing user | ✅ Yes | N/A | Login | Existing role |
| New Global Admin | ❌ No | ✅ Yes | Create + Login | GlobalAdmin |
| New Normal User | ❌ No | ✅ Yes | Create + Login | User |
| External User | ❌ No | ❌ No | Reject | N/A |

## 🔐 Role Assignment Logic

```python
if user_exists_in_db:
    role = user.role  # Use existing role
elif is_global_admin(access_token):
    role = "GlobalAdmin"
else:
    role = "User"
```

## 🚫 What NOT to Do

- ❌ Don't show signup page for existing users
- ❌ Don't create guest users
- ❌ Don't create duplicate users
- ❌ Don't allow users not in tenant

## ✅ What TO Do

- ✅ Login existing users directly
- ✅ Verify user exists in tenant before creating
- ✅ Check admin status via Graph API
- ✅ Store entra_user_id for tracking

## 🔑 Key Endpoints

### Frontend → Backend
```typescript
POST /auth/microsoft
Body: {
  idToken: string,
  accessToken: string
}
```

### Backend → Microsoft Graph
```
GET https://graph.microsoft.com/v1.0/me
GET https://graph.microsoft.com/v1.0/me/memberOf
```

## 📦 Response Format

```json
{
  "id": 123,
  "name": "John Doe",
  "email": "john@company.com",
  "role": "GlobalAdmin",
  "auth_provider": "microsoft"
}
```

## 🎨 Frontend Redirects

```typescript
switch (role) {
  case 'GlobalAdmin':
  case 'UserAdmin':
  case 'User':
    navigate('/dashboard');
    break;
  case 'PendingApproval':
    navigate('/login/pendingapprovaluser');
    break;
}
```

## 🗄️ Database Fields

```sql
users table:
- id (INT, PRIMARY KEY)
- name (VARCHAR 255)
- email (VARCHAR 255, UNIQUE)
- entra_user_id (VARCHAR 255)
- auth_provider (ENUM: email, google, microsoft)
- role (ENUM: GlobalAdmin, UserAdmin, User, PendingApproval)
- status (ENUM: ACTIVE, PENDING_APPROVAL, INACTIVE)
- created_at (DATETIME)
```

## 🧪 Quick Test Commands

### Test existing user:
```bash
# Should login directly, no user creation
```

### Test new user:
```bash
# Should check tenant, create user, then login
```

### Test external user:
```bash
# Should reject with 403 error
```

## 🐛 Common Issues

### Issue: User created multiple times
**Solution**: Check email uniqueness constraint in database

### Issue: Wrong role assigned
**Solution**: Verify Graph API permissions for memberOf

### Issue: User not found in tenant
**Solution**: Ensure user has Microsoft 365 license

### Issue: Access token expired
**Solution**: MSAL handles token refresh automatically

## 📞 Quick Troubleshooting

1. **Check backend logs**: Look for Graph API errors
2. **Verify database**: Check users table for duplicates
3. **Test Graph API**: Use access token in Postman
4. **Check MSAL config**: Verify scopes and permissions

## 🔗 Related Files

- Backend: `backend/routers/auth.py`
- Frontend: `src/components/AuthCallback.tsx`
- Service: `src/services/authService.ts`
- Migration: `backend/migrate_db.py`
- Docs: `MICROSOFT_LOGIN_COMPLETE_FLOW.md`
