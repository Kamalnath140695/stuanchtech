# Quick Testing Guide - Authentication & Authorization

## Prerequisites
- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:3000`
- MySQL database configured and running
- Azure AD app registration configured (for Microsoft SSO)

---

## Test 1: First User Registration (GlobalAdmin)

### Steps:
1. Clear database: `DELETE FROM users;`
2. Navigate to `http://localhost:3000/signup`
3. Fill form:
   - Name: `Admin User`
   - Email: `admin@example.com`
   - Password: `Admin@123`
4. Click "Sign Up"

### Expected Result:
✅ User created with role: **GlobalAdmin**
✅ Redirected to `/dashboard`
✅ Can see "Admin" menu in sidebar
✅ Can access all admin routes

### Verify:
```sql
SELECT * FROM users WHERE email = 'admin@example.com';
-- role should be 'GlobalAdmin'
-- status should be 'ACTIVE'
```

---

## Test 2: Second User Registration (PendingApproval)

### Steps:
1. Logout from admin account
2. Navigate to `http://localhost:3000/signup`
3. Fill form:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `Test@123`
4. Click "Sign Up"

### Expected Result:
✅ User created with role: **NormalUser**
✅ Status: **PENDING_APPROVAL**
✅ Redirected to `/login/pendingapprovaluser`
✅ Shows "Pending Approval" message

### Verify:
```sql
SELECT * FROM users WHERE email = 'test@example.com';
-- role should be 'NormalUser'
-- status should be 'PENDING_APPROVAL'
```

---

## Test 3: Admin Approves User

### Steps:
1. Login as admin (`admin@example.com`)
2. Navigate to `/admin/users`
3. Find pending user (`test@example.com`)
4. Click "Approve"

### Expected Result:
✅ User status changed to **ACTIVE**
✅ User can now login
✅ Audit log created

### Verify:
```sql
SELECT * FROM users WHERE email = 'test@example.com';
-- status should be 'ACTIVE'
-- approved_at should be set
-- approved_by should be 'admin@example.com'
```

---

## Test 4: Approved User Login

### Steps:
1. Logout from admin account
2. Navigate to `http://localhost:3000/login`
3. Login with:
   - Email: `test@example.com`
   - Password: `Test@123`

### Expected Result:
✅ Login successful
✅ Redirected to `/dashboard`
✅ **Cannot** see "Admin" menu in sidebar
✅ **Cannot** access `/admin/*` routes
✅ Shows "Access Denied" if trying to access admin routes

---

## Test 5: Microsoft SSO - Global Administrator

### Steps:
1. Logout from all accounts
2. Navigate to `http://localhost:3000/login`
3. Click "Continue with Microsoft"
4. Login with Microsoft account that has **Global Administrator** role in Azure AD

### Expected Result:
✅ Redirected to Microsoft login
✅ After authentication, redirected to `/auth-callback`
✅ User created/updated in database with role: **GlobalAdmin**
✅ Redirected to `/dashboard`
✅ Can see "Admin" menu
✅ Has full admin access

### Verify:
```sql
SELECT * FROM users WHERE auth_provider = 'microsoft' ORDER BY created_at DESC LIMIT 1;
-- role should be 'GlobalAdmin'
-- status should be 'ACTIVE'
-- entra_user_id should be populated
```

### Backend Logs:
```
[Graph] Checking admin status...
[Graph] Found role: Global Administrator
Role assigned: GlobalAdmin
```

---

## Test 6: Microsoft SSO - User Administrator

### Steps:
1. Logout
2. Navigate to `http://localhost:3000/login`
3. Click "Continue with Microsoft"
4. Login with Microsoft account that has **User Administrator** role in Azure AD

### Expected Result:
✅ User created with role: **UserAdmin**
✅ Redirected to `/dashboard`
✅ Can see "Admin" menu
✅ Can manage NormalUsers
✅ **Cannot** create GlobalAdmin or UserAdmin users
✅ **Cannot** delete admin users

### Verify:
```sql
SELECT * FROM users WHERE auth_provider = 'microsoft' ORDER BY created_at DESC LIMIT 1;
-- role should be 'UserAdmin'
```

---

## Test 7: Microsoft SSO - Regular User

### Steps:
1. Logout
2. Navigate to `http://localhost:3000/login`
3. Click "Continue with Microsoft"
4. Login with regular Microsoft account (no admin roles)

### Expected Result:
✅ User created with role: **NormalUser**
✅ Redirected to `/dashboard`
✅ **Cannot** see "Admin" menu
✅ Limited to user-level access

### Verify:
```sql
SELECT * FROM users WHERE auth_provider = 'microsoft' ORDER BY created_at DESC LIMIT 1;
-- role should be 'NormalUser'
```

---

## Test 8: Google SSO - New User

### Steps:
1. Logout
2. Navigate to `http://localhost:3000/login`
3. Click "Continue with Google"
4. Login with Google account

### Expected Result:
✅ User created with role: **NormalUser**
✅ Status: **PENDING_APPROVAL**
✅ Redirected to `/login/pendingapprovaluser`
✅ Shows "Pending Approval" message

### Verify:
```sql
SELECT * FROM users WHERE auth_provider = 'google' ORDER BY created_at DESC LIMIT 1;
-- role should be 'NormalUser'
-- status should be 'PENDING_APPROVAL'
```

---

## Test 9: Role-Based Permissions

### Test as GlobalAdmin:
```
✅ Can access /admin/users
✅ Can access /admin/containers
✅ Can access /admin/apps
✅ Can access /admin/permissions
✅ Can access /admin/audit
✅ Can create users with any role
✅ Can delete any user
✅ Can approve/reject pending users
```

### Test as UserAdmin:
```
✅ Can access /admin/users
✅ Can access /admin/containers (limited)
✅ Can access /admin/audit
❌ Cannot access /admin/apps
❌ Cannot create GlobalAdmin or UserAdmin users
❌ Cannot delete admin users
✅ Can approve/reject pending users
✅ Can manage NormalUsers only
```

### Test as NormalUser:
```
✅ Can access /dashboard
❌ Cannot access /admin/* routes
❌ Cannot see "Admin" menu
❌ Shows "Access Denied" on admin routes
✅ Can view assigned containers
✅ Can upload/download files in permitted containers
```

---

## Test 10: Cross-Tab Synchronization

### Steps:
1. Login in Tab 1
2. Open Tab 2 (same browser)
3. Logout in Tab 1

### Expected Result:
✅ Tab 2 automatically detects logout
✅ Tab 2 redirects to login page
✅ localStorage cleared in both tabs

---

## Test 11: Role Normalization

### Steps:
1. Manually set incorrect role in database:
```sql
UPDATE users SET role = 'User' WHERE email = 'test@example.com';
```
2. Login with `test@example.com`

### Expected Result:
✅ Role automatically normalized to **NormalUser**
✅ Stored correctly in localStorage
✅ Permissions applied correctly

---

## Test 12: Pending Approval Workflow

### Steps:
1. Register new user (gets PendingApproval)
2. Try to login → Redirected to pending page
3. Admin approves user
4. User logs out and logs back in
5. Now has access to dashboard

### Expected Result:
✅ Pending user cannot access dashboard
✅ After approval, user can access system
✅ Role and permissions applied correctly

---

## Common Issues & Solutions

### Issue: "User not found in Microsoft tenant"
**Solution**: 
- User must exist in Azure AD tenant
- Check Azure AD app registration permissions
- Verify user has valid license

### Issue: Role not updating after assignment
**Solution**:
- User must logout and login again
- Clear localStorage: `localStorage.clear()`
- Check database role is correct

### Issue: "Access Denied" for admin user
**Solution**:
- Verify role in database: `SELECT role FROM users WHERE email = '...'`
- Check localStorage: `localStorage.getItem('current_user')`
- Ensure RBACContext is initialized

### Issue: Microsoft login redirects to error page
**Solution**:
- Check Azure AD redirect URIs include `http://localhost:3000/auth-callback`
- Verify client ID and tenant ID in `.env`
- Check browser console for MSAL errors

---

## Quick Verification Commands

### Check User Roles:
```sql
SELECT email, role, status, auth_provider FROM users;
```

### Check Pending Users:
```sql
SELECT email, name, created_at FROM users WHERE status = 'PENDING_APPROVAL';
```

### Check Admin Users:
```sql
SELECT email, role FROM users WHERE role IN ('GlobalAdmin', 'UserAdmin');
```

### Reset User Status:
```sql
UPDATE users SET status = 'ACTIVE' WHERE email = 'test@example.com';
```

### Make User Admin:
```sql
UPDATE users SET role = 'GlobalAdmin' WHERE email = 'test@example.com';
```

---

## Browser Console Checks

### Check Current User:
```javascript
JSON.parse(localStorage.getItem('current_user'))
```

### Check Role:
```javascript
localStorage.getItem('adminRole')
```

### Check Pending Approval:
```javascript
sessionStorage.getItem('pending_approval')
```

### Clear All Auth Data:
```javascript
localStorage.clear();
sessionStorage.clear();
window.location.reload();
```

---

## Success Criteria

✅ All three authentication methods work (Email, Google, Microsoft)
✅ Roles correctly assigned based on provider and Azure AD roles
✅ Pending approval workflow functions correctly
✅ Role-based permissions enforced on frontend and backend
✅ Admin routes only accessible to GlobalAdmin and UserAdmin
✅ NormalUser has limited access
✅ Cross-tab synchronization works
✅ Role normalization handles legacy data
✅ Logout clears all authentication data

---

## Performance Checks

- Login should complete in < 2 seconds
- Role detection should be instant (from localStorage)
- Dashboard should load in < 3 seconds
- Permission checks should not cause UI lag
- Microsoft Graph API calls should timeout after 10 seconds

---

## Security Checks

✅ Passwords are hashed (bcrypt)
✅ Tokens not stored in localStorage
✅ Backend always verifies role
✅ Frontend checks are for UI only
✅ Cannot bypass backend permissions
✅ SQL injection prevented (parameterized queries)
✅ XSS prevented (React escaping)
✅ CORS configured correctly

---

## Final Checklist

- [ ] First user becomes GlobalAdmin
- [ ] Subsequent users get PendingApproval
- [ ] Admin can approve/reject users
- [ ] Microsoft Global Admin → GlobalAdmin role
- [ ] Microsoft User Admin → UserAdmin role
- [ ] Microsoft regular user → NormalUser role
- [ ] Google users get PendingApproval
- [ ] Email users get PendingApproval
- [ ] Role-based dashboard rendering works
- [ ] Admin routes protected correctly
- [ ] Permission checks enforced
- [ ] Logout clears all data
- [ ] Cross-tab sync works
- [ ] Role normalization works

---

**All tests passing = Authentication & Authorization system working correctly! ✅**
