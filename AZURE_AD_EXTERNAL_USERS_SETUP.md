# Azure AD External Users Configuration Guide

## Error: AADSTS50020

**Error Message:**
```
User account 'email@gmail.com' from identity provider 'live.com' does not exist in tenant 'MSFT' 
and cannot access the application. The account needs to be added as an external user in the tenant first.
```

## Solution: Enable External Identities in Azure AD

### Step 1: Enable External Collaboration Settings

1. **Go to Azure Portal**
   - Navigate to https://portal.azure.com
   - Sign in with your Global Administrator account

2. **Open Azure Active Directory**
   - Click "Azure Active Directory" in the left menu
   - Or search for "Azure Active Directory" in the top search bar

3. **Configure External Identities**
   - In the left menu, click **"External Identities"**
   - Click **"External collaboration settings"**

4. **Guest User Access**
   - Set guest user access to: **"Guest users have limited access to properties and memberships of directory objects"**
   - Or: **"Guest users have the same access as members"** (more permissive)

5. **Guest Invite Settings**
   - Under "Guest invite settings", select:
     - ✅ **"Member users and users assigned to specific admin roles can invite guest users including guests with member permissions"**
     - OR
     - ✅ **"Anyone in the organization can invite guest users including guests and non-admins"**

6. **Collaboration Restrictions**
   - Under "Collaboration restrictions", select:
     - ✅ **"Allow invitations to be sent to any domain (most inclusive)"**
   - Or configure specific domains if needed

7. **Click "Save"**

### Step 2: Configure App Registration for Guest Users

1. **Go to App Registrations**
   - In Azure AD, click **"App registrations"**
   - Find your app: `MyEmbeddedApp` (or your app name)

2. **Update Authentication Settings**
   - Click on your app
   - Go to **"Authentication"**
   - Under "Supported account types", ensure it's set to:
     - ✅ **"Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"**

3. **API Permissions**
   - Go to **"API permissions"**
   - Ensure you have these permissions:
     - ✅ `User.Read` (Delegated)
     - ✅ `User.ReadWrite` (Delegated) - Optional
     - ✅ `User.Invite.All` (Application) - For guest invitations
     - ✅ `Directory.ReadWrite.All` (Application) - For creating users

4. **Grant Admin Consent**
   - Click **"Grant admin consent for [Your Organization]"**
   - Click **"Yes"** to confirm

### Step 3: Enable B2B Direct Connect (Optional)

1. **In External Identities**
   - Click **"Cross-tenant access settings"**
   - Click **"Default settings"**

2. **Inbound Settings**
   - Click **"Edit inbound defaults"**
   - Under "B2B collaboration", enable:
     - ✅ Allow users from other organizations
     - ✅ Allow guest users

3. **Outbound Settings**
   - Click **"Edit outbound defaults"**
   - Enable external collaboration

### Step 4: Test Configuration

1. **Create a Test Invitation**
   - Go to Azure AD → Users
   - Click **"New guest user"**
   - Click **"Invite user"**
   - Enter an external email (e.g., test@gmail.com)
   - Click **"Invite"**

2. **Check Email**
   - The external user should receive an invitation email
   - They can click the link to accept

3. **Verify in Azure AD**
   - Go to Azure AD → Users
   - You should see the guest user with `#EXT#` in their name

## Alternative: Use Personal Microsoft Accounts

If you don't want to enable external identities, you can:

1. **Restrict to Microsoft Accounts Only**
   - Only allow users with @outlook.com, @hotmail.com, @live.com
   - These are already part of Microsoft ecosystem

2. **Update App Registration**
   - Set supported account types to:
     - "Accounts in any organizational directory and personal Microsoft accounts"

## Configuration in Your App

### Update Constants

In `src/common/constants.ts`:

```typescript
// For multi-tenant + personal accounts
export const CLIENT_ENTRA_APP_AUTHORITY = 
  'https://login.microsoftonline.com/common';

// OR for single tenant only
export const CLIENT_ENTRA_APP_AUTHORITY = 
  'https://login.microsoftonline.com/YOUR-TENANT-ID';
```

### Update MSAL Configuration

In `src/App.tsx` and `authService.ts`:

```typescript
Providers.globalProvider = new Msal2Provider({
  clientId: Constants.CLIENT_ENTRA_APP_CLIENT_ID,
  authority: 'https://login.microsoftonline.com/common', // Multi-tenant
  redirectUri: window.location.origin,
  scopes: [
    'User.Read',
    'User.ReadWrite',
    'User.Invite.All', // For guest invitations
  ],
});
```

## Troubleshooting

### Error: "AADSTS50020"
**Solution:** Enable external identities as described above

### Error: "AADSTS65001 - User or administrator has not consented"
**Solution:** Grant admin consent in App Registration → API Permissions

### Error: "AADSTS700016 - Application not found"
**Solution:** Check your Client ID and ensure app is registered

### Error: "AADSTS90072 - User account does not exist"
**Solution:** 
- Enable guest user invitations
- Or restrict to Microsoft accounts only

## Production Checklist

- [ ] External collaboration settings enabled
- [ ] App registration supports multi-tenant
- [ ] API permissions granted and consented
- [ ] Guest invite settings configured
- [ ] Collaboration restrictions set
- [ ] Test guest invitation working
- [ ] Email notifications configured
- [ ] Guest user access level set

## Security Best Practices

1. **Limit Guest Access**
   - Set appropriate guest user permissions
   - Review guest users regularly

2. **Domain Restrictions**
   - Consider allowing only specific domains
   - Block suspicious domains

3. **Conditional Access**
   - Apply MFA for guest users
   - Restrict access by location

4. **Regular Audits**
   - Review guest user list monthly
   - Remove inactive guests

## Support

For more information:
- [Azure AD B2B Documentation](https://docs.microsoft.com/en-us/azure/active-directory/external-identities/)
- [Guest User Access](https://docs.microsoft.com/en-us/azure/active-directory/external-identities/what-is-b2b)
- [MSAL Configuration](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
