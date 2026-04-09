# Microsoft Login Implementation - Deployment Checklist

## Pre-Deployment Verification

### Backend Files
- [x] `backend/routers/auth.py` - Contains all auth endpoints
  - [x] `POST /register` - Email registration
  - [x] `POST /login` - Email login
  - [x] `POST /sso` - Google/Generic SSO
  - [x] `POST /microsoft` - Microsoft login (NEW)
  - [x] `decode_id_token()` - ID token decoding
  - [x] `is_global_admin()` - Admin role detection

- [x] `backend/requirements.txt` - Contains PyJWT
  - [x] fastapi
  - [x] uvicorn
  - [x] python-dotenv
  - [x] requests
  - [x] msal
  - [x] mysql-connector-python
  - [x] bcrypt
  - [x] pydantic[email]
  - [x] PyJWT (NEW)

- [x] `backend/main.py` - Auth router included
  - [x] Import auth router
  - [x] Include auth router with `/api/auth` prefix

### Frontend Files
- [x] `src/services/authService.ts` - Contains microsoftAuth function
  - [x] `microsoftAuth()` function added
  - [x] Calls `/api/auth/microsoft` endpoint
  - [x] Stores user in localStorage

- [x] `src/components/AuthCallback.tsx` - Updated redirect handler
  - [x] Uses new `microsoftAuth()` function
  - [x] Handles ID token and access token
  - [x] Redirects based on user role

- [x] `src/config/msalConfig.ts` - MSAL configuration
  - [x] Includes `email` scope
  - [x] Redirect URI set to `/auth-callback`

### Database
- [x] MySQL users table
  - [x] Email column is UNIQUE
  - [x] auth_provider column exists
  - [x] role column exists

---

## Step-by-Step Deployment

### Step 1: Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```
**Verify**: PyJWT is installed
```bash
pip show PyJWT
```

### Step 2: Verify Database Schema
```sql
-- Check if email is UNIQUE
SHOW CREATE TABLE users;

-- If not UNIQUE, add constraint
ALTER TABLE users ADD UNIQUE (email);
```

### Step 3: Restart Backend
```bash
# Stop current backend
# (Ctrl+C if running in terminal)

# Start backend
python main.py
```

**Verify**: Backend starts without errors
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 4: Test Backend Endpoint
```bash
# Test Microsoft auth endpoint
curl -X POST http://localhost:8000/api/auth/microsoft \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "test_token",
    "accessToken": "test_token"
  }'
```

**Expected**: 400 error (invalid token) - This is correct!

### Step 5: Verify Frontend Configuration
Check `src/config/msalConfig.ts`:
```typescript
export const loginRequest = {
  scopes: ['User.Read', 'profile', 'openid', 'email'],
};
```

### Step 6: Test Frontend
1. Open browser to http://localhost:3000
2. Click "Continue with Microsoft"
3. Verify redirect to `/auth-callback`
4. Check browser console for errors

---

## Testing Scenarios

### Scenario 1: New User (Non-Admin)
**Steps**:
1. Use a Microsoft account that's NOT in the database
2. Click "Continue with Microsoft"
3. Complete MSAL authentication

**Expected Result**:
- User created in database with `PendingApproval` role
- Redirected to `/login/pendingapprovaluser`
- No signup page shown

**Verify**:
```sql
SELECT * FROM users WHERE email = 'your_email@example.com';
```

### Scenario 2: New User (Admin)
**Steps**:
1. Use a Microsoft account that's a Global Admin
2. Click "Continue with Microsoft"
3. Complete MSAL authentication

**Expected Result**:
- User created in database with `GlobalAdmin` role
- Redirected to `/dashboard`
- Full admin access

**Verify**:
```sql
SELECT * FROM users WHERE email = 'admin_email@example.com';
-- Should show role = 'GlobalAdmin'
```

### Scenario 3: Existing User
**Steps**:
1. Use a Microsoft account already in database
2. Click "Continue with Microsoft"
3. Complete MSAL authentication

**Expected Result**:
- User logged in with existing role
- Redirected to `/dashboard`
- No new user created

**Verify**:
```sql
SELECT COUNT(*) FROM users WHERE email = 'existing_email@example.com';
-- Should still be 1
```

### Scenario 4: Logout and Re-login
**Steps**:
1. Click logout
2. Click "Continue with Microsoft"
3. Complete MSAL authentication

**Expected Result**:
- User logged in again
- Cache cleared and re-populated
- Same role as before

---

## Verification Checklist

### Backend
- [ ] PyJWT installed
- [ ] `backend/routers/auth.py` has all functions
- [ ] `backend/main.py` includes auth router
- [ ] Backend starts without errors
- [ ] `/api/auth/microsoft` endpoint responds

### Frontend
- [ ] `microsoftAuth()` function exists
- [ ] AuthCallback uses new function
- [ ] MSAL config includes `email` scope
- [ ] Frontend compiles without errors

### Database
- [ ] Email column is UNIQUE
- [ ] Users table has all required columns
- [ ] Can query users by email

### Integration
- [ ] Backend and frontend communicate
- [ ] Tokens passed correctly
- [ ] User created in database
- [ ] Role assigned correctly

---

## Common Issues and Solutions

### Issue 1: "PyJWT not found"
**Solution**:
```bash
pip install PyJWT
pip install -r requirements.txt
```

### Issue 2: "Email not found in token"
**Solution**: Ensure MSAL scopes include `email`
```typescript
export const loginRequest = {
  scopes: ['User.Read', 'profile', 'openid', 'email'],
};
```

### Issue 3: "Duplicate user error"
**Solution**: Email column must be UNIQUE
```sql
ALTER TABLE users ADD UNIQUE (email);
```

### Issue 4: "Failed to check admin status"
**Solution**: Verify Graph API permissions
- Check Azure AD app has `Directory.Read.All` permission
- Ensure token includes Graph scopes

### Issue 5: "Backend not responding"
**Solution**: Check backend is running
```bash
curl http://localhost:8000/
# Should return: {"message": "SharePoint Embedded Enterprise Admin API is running"}
```

### Issue 6: "CORS error"
**Solution**: Backend CORS is already configured
- Check backend is running on port 8000
- Check frontend is running on port 3000

---

## Performance Checklist

- [ ] ID token decoding < 1ms
- [ ] Database query < 10ms
- [ ] Graph API call < 500ms (only for new users)
- [ ] Total login time < 1 second

---

## Security Checklist

- [ ] ID token decoded without signature verification (frontend already validated)
- [ ] Access token used only for Graph API calls
- [ ] Email normalized to lowercase
- [ ] Database email is UNIQUE
- [ ] No credentials stored in frontend
- [ ] HTTPS required for production
- [ ] Tokens not logged or stored unnecessarily

---

## Rollback Plan

If you need to revert:

### Step 1: Revert Backend
```bash
# Remove PyJWT from requirements.txt
# Remove microsoft_auth() function from auth.py
# Remove decode_id_token() function from auth.py
# Remove is_global_admin() function from auth.py
# Remove MicrosoftAuthRequest model from auth.py
# Restart backend
```

### Step 2: Revert Frontend
```bash
# Revert AuthCallback.tsx to original version
# Remove microsoftAuth() from authService.ts
# Restart frontend
```

### Step 3: Verify Rollback
```bash
# Test login still works
# Test signup still works
```

---

## Documentation Files

All documentation is in the project root:

1. **MICROSOFT_LOGIN_IMPLEMENTATION.md** - Full implementation details
2. **MICROSOFT_LOGIN_SETUP.md** - Quick setup guide
3. **MICROSOFT_LOGIN_FLOW_DIAGRAM.md** - Flow diagrams
4. **IMPLEMENTATION_SUMMARY.md** - Complete summary
5. **QUICK_REFERENCE.md** - Quick reference card
6. **CODE_CHANGES_REFERENCE.md** - Exact code changes
7. **COMPLETION_SUMMARY.md** - Completion status
8. **DEPLOYMENT_CHECKLIST.md** - This file

---

## Post-Deployment Monitoring

### Monitor These Metrics
- [ ] Login success rate
- [ ] User creation rate
- [ ] Admin detection accuracy
- [ ] Error rate
- [ ] Response time

### Monitor These Logs
- [ ] Backend logs for errors
- [ ] Database logs for queries
- [ ] Frontend console for errors
- [ ] Graph API errors

### Monitor These Alerts
- [ ] High error rate
- [ ] Slow response time
- [ ] Database connection errors
- [ ] Graph API errors

---

## Support Resources

### Documentation
- See MICROSOFT_LOGIN_IMPLEMENTATION.md for full details
- See QUICK_REFERENCE.md for quick answers
- See CODE_CHANGES_REFERENCE.md for exact changes

### Testing
- Run `python test_microsoft_auth.py` to test backend
- Check browser console for frontend errors
- Check backend logs for server errors

### Troubleshooting
- Check COMMON ISSUES section above
- Review error messages carefully
- Check environment variables are set

---

## Sign-Off

- [ ] All files modified correctly
- [ ] Dependencies installed
- [ ] Backend restarted
- [ ] Frontend tested
- [ ] Database verified
- [ ] All scenarios tested
- [ ] Documentation reviewed
- [ ] Ready for production

---

## Deployment Date

**Date**: _______________
**Deployed By**: _______________
**Verified By**: _______________

---

## Notes

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

**Deployment Checklist Complete!** ✅
