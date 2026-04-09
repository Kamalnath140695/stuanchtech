# Multi-Tier Storage System Documentation

## Overview
The authentication system implements a **3-tier storage fallback mechanism** to ensure user data is always stored, even when the primary database is unavailable.

## Storage Hierarchy

```
┌─────────────────────────────────────────────────────┐
│  Tier 1: Database (Primary)                        │
│  ✅ Production-ready                                │
│  ✅ Persistent                                      │
│  ✅ Scalable                                        │
└─────────────────────────────────────────────────────┘
                    ↓ (if unavailable)
┌─────────────────────────────────────────────────────┐
│  Tier 2: Microsoft Graph API (Fallback)            │
│  ⚠️  Requires extension attributes setup            │
│  ✅ Cloud-based                                     │
│  ✅ Persistent across devices                       │
└─────────────────────────────────────────────────────┘
                    ↓ (if unavailable)
┌─────────────────────────────────────────────────────┐
│  Tier 3: Local Storage (Emergency Fallback)        │
│  ⚠️  Browser-only                                   │
│  ⚠️  Not suitable for production                    │
│  ⚠️  Lost on browser clear                          │
└─────────────────────────────────────────────────────┘
```

## Storage Flow

### User Creation Flow

```
New User Login
      ↓
Try Database
      ↓
   Success? ──Yes──> Store in Database ──> ✅ Done
      ↓ No
      ↓
Try Microsoft Graph API
      ↓
   Success? ──Yes──> Store in Graph API ──> ⚠️ Show Warning
      ↓ No
      ↓
Try Local Storage
      ↓
   Success? ──Yes──> Store in localStorage ──> ⚠️ Show Critical Warning
      ↓ No
      ↓
   ❌ Error: All storage methods failed
```

### User Retrieval Flow

```
Check User Exists
      ↓
Try Database
      ↓
   Found? ──Yes──> Return User (database)
      ↓ No
      ↓
Try Microsoft Graph API
      ↓
   Found? ──Yes──> Return User (graph_api)
      ↓ No
      ↓
Try Local Storage
      ↓
   Found? ──Yes──> Return User (local_storage)
      ↓ No
      ↓
   Return null (User not found)
```

## Configuration

### Enable/Disable Database

In `authService.ts`:

```typescript
// Configuration
const USE_DATABASE = false; // Set to true when database is available
const DATABASE_API_URL = '/api/users'; // Your backend API URL
```

**Development:** Set `USE_DATABASE = false`
**Production:** Set `USE_DATABASE = true`

## Microsoft Graph API Storage

### Extension Attributes

User data is stored in Microsoft Graph extension attributes:

```typescript
{
  extension_dms_role: "User",
  extension_dms_created_date: "2024-01-01T00:00:00Z",
  extension_dms_tenant_id: "tenant-123"
}
```

### Setup Extension Attributes

1. **Register Extension in Azure AD:**

```bash
POST https://graph.microsoft.com/v1.0/applications/{app-id}/extensionProperties
{
  "name": "dms_role",
  "dataType": "String",
  "targetObjects": ["User"]
}
```

2. **Repeat for other attributes:**
   - `dms_created_date`
   - `dms_tenant_id`

3. **Grant Permissions:**
   - `User.ReadWrite` - To write extension attributes
   - `User.Read` - To read user profile

### Store User in Graph API

```typescript
await storeUserInGraphAPI(accessToken, {
  entra_id: "abc123",
  email: "user@example.com",
  name: "John Doe",
  role: "User",
  created_date: "2024-01-01T00:00:00Z"
});
```

### Retrieve User from Graph API

```typescript
const user = await getUserFromGraphAPI(accessToken);
// Returns: DMSUser | null
```

## Warning System

### Warning Types

#### 1. Database Not Available Warning

**Trigger:** Database fails, Graph API succeeds

**Display:**
```
⚠️ Database Not Available
User data is being stored in Microsoft Graph API as a fallback. 
Please configure database connection for production use.
Details: Database is not configured
```

**Color:** Yellow/Amber
**Severity:** Medium

#### 2. Critical Local Storage Warning

**Trigger:** Database and Graph API both fail

**Display:**
```
⚠️ Critical: Using Local Storage
Database and Microsoft Graph API are not available. 
User data is stored in browser local storage only. 
This is NOT suitable for production!
Details: Database is not configured, Microsoft Graph API storage failed
```

**Color:** Red
**Severity:** Critical

### Warning Banner Component

The `StorageWarningBanner` component displays warnings at the top of the page:

```tsx
<StorageWarningBanner />
```

**Features:**
- Fixed position at top
- Auto-dismissible
- Color-coded by severity
- Shows detailed error information
- Persists across page refreshes (until dismissed)

### Console Warnings

All storage operations log to console:

```
✅ User created in database
⚠️ Database not available, checking alternative storage...
✅ User created in Microsoft Graph API
📍 Storage location: graph_api
```

## API Functions

### Core Functions

#### `getAccessToken()`
```typescript
const token = await getAccessToken();
// Returns: string (access token)
```

#### `getUserProfile(accessToken)`
```typescript
const profile = await getUserProfile(token);
// Returns: UserProfile
```

#### `checkUserExists(email)`
```typescript
const user = await checkUserExists("user@example.com");
// Returns: DMSUser | null
// Tries: Database → Graph API → Local Storage
```

#### `createDMSUser(entraId, email, name, role)`
```typescript
const user = await createDMSUser(
  "abc123",
  "user@example.com",
  "John Doe",
  "User"
);
// Returns: DMSUser with storage_location
// Tries: Database → Graph API → Local Storage
```

#### `completeAuthFlow()`
```typescript
const user = await completeAuthFlow();
// Returns: DMSUser
// Complete flow: token → profile → check → create → store
```

### Storage-Specific Functions

#### `storeUserInGraphAPI(accessToken, userData)`
```typescript
await storeUserInGraphAPI(token, userData);
// Stores user in Microsoft Graph extension attributes
```

#### `getUserFromGraphAPI(accessToken)`
```typescript
const user = await getUserFromGraphAPI(token);
// Retrieves user from Microsoft Graph extension attributes
```

### Warning Functions

#### `getStorageWarning()`
```typescript
const warning = getStorageWarning();
// Returns: { title, message, details } | null
```

#### `clearStorageWarning()`
```typescript
clearStorageWarning();
// Clears warning from session storage
```

## Data Structure

### DMSUser Interface

```typescript
interface DMSUser {
  entra_id: string;              // Microsoft Entra ID
  email: string;                 // User email
  name: string;                  // Display name
  role: 'GlobalAdmin' | 'UserAdmin' | 'User';
  tenant_id?: string;            // Optional tenant ID
  created_date: string;          // ISO timestamp
  storage_location?: 'database' | 'graph_api' | 'local_storage';
}
```

### Storage Location Field

The `storage_location` field indicates where the user data is stored:

- `'database'` - Primary database (production)
- `'graph_api'` - Microsoft Graph API (fallback)
- `'local_storage'` - Browser localStorage (emergency)

## Production Setup

### Step 1: Configure Database

1. Set up your database (PostgreSQL, MySQL, MongoDB, etc.)
2. Create users table with schema
3. Implement backend API endpoints:
   - `GET /api/users/check?email={email}`
   - `POST /api/users`

### Step 2: Update Configuration

```typescript
const USE_DATABASE = true;
const DATABASE_API_URL = 'https://api.yourdomain.com/users';
```

### Step 3: Setup Microsoft Graph Extensions

1. Register extension attributes in Azure AD
2. Grant `User.ReadWrite` permission
3. Test extension attribute storage

### Step 4: Test Fallback Mechanism

1. Test with database enabled
2. Test with database disabled (Graph API fallback)
3. Test with both disabled (localStorage fallback)

## Error Handling

### Database Connection Error

```typescript
try {
  const response = await fetch(DATABASE_API_URL);
} catch (error) {
  console.warn('⚠️ Database not available:', error);
  // Falls back to Graph API
}
```

### Graph API Error

```typescript
try {
  await storeUserInGraphAPI(token, userData);
} catch (error) {
  console.warn('⚠️ Microsoft Graph API storage failed:', error);
  // Falls back to localStorage
}
```

### All Storage Failed

```typescript
if (allStorageFailed) {
  throw new Error('Failed to create user: All storage methods unavailable');
}
```

## Security Considerations

### Database Storage
- ✅ Server-side validation
- ✅ Encrypted connections
- ✅ Access control
- ✅ Audit logging

### Microsoft Graph API Storage
- ✅ OAuth 2.0 authentication
- ✅ Encrypted in transit
- ⚠️ Limited to extension attributes
- ⚠️ Requires proper permissions

### Local Storage
- ⚠️ Client-side only
- ⚠️ No encryption
- ⚠️ Vulnerable to XSS
- ❌ NOT for production

## Monitoring

### Console Logs

All operations are logged with emojis for easy identification:

- ✅ Success operations
- ⚠️ Warnings and fallbacks
- ❌ Errors and failures
- 🆕 New user creation
- 📍 Storage location info

### Warning Tracking

Warnings are stored in `sessionStorage` and displayed via banner:

```typescript
sessionStorage.getItem('storage_warning');
```

## Migration Path

### From localStorage to Graph API

1. Enable Graph API storage
2. Migrate existing users:
   ```typescript
   const users = JSON.parse(localStorage.getItem('dms_users'));
   for (const user of users) {
     await storeUserInGraphAPI(token, user);
   }
   ```

### From Graph API to Database

1. Set up database
2. Enable database in config
3. Migrate users from Graph API to database
4. Verify all users migrated
5. Disable Graph API fallback (optional)

## Troubleshooting

### Issue: Users not persisting

**Check:**
1. Console logs for storage location
2. Browser localStorage
3. Microsoft Graph API permissions
4. Database connection

### Issue: Warning banner not showing

**Check:**
1. `sessionStorage.getItem('storage_warning')`
2. Component mounted in App.tsx
3. Console for warning logs

### Issue: Graph API storage failing

**Check:**
1. Extension attributes registered
2. `User.ReadWrite` permission granted
3. Access token has correct scopes
4. Extension attribute names match

## Best Practices

1. **Always use database in production**
2. **Set up Graph API as backup**
3. **Monitor storage warnings**
4. **Test all fallback scenarios**
5. **Implement proper error handling**
6. **Log all storage operations**
7. **Regularly backup user data**
8. **Validate user data on retrieval**

## Support

For issues with:
- **Database:** Check backend API logs
- **Graph API:** Check Azure AD permissions
- **localStorage:** Check browser console

## Next Steps

1. ✅ Implement database backend
2. ✅ Register Graph API extensions
3. ✅ Test fallback mechanisms
4. ✅ Monitor warnings in production
5. ✅ Set up data migration scripts
6. ✅ Implement backup strategies
