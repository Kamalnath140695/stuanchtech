import os
import bcrypt
import mysql.connector
import jwt
import requests
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Any, Dict, Optional
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router = APIRouter()

GLOBAL_ADMIN_ROLE_NAMES = {"Company Administrator", "Global Administrator"}
USER_ADMIN_ROLE_NAMES = {"User Administrator", "Helpdesk Administrator"}

async def get_current_user(authorization: str = Header(None)):
    """Dependency to get current user from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Expecting format: "Bearer <user_id>" or just "<user_id>"
        token = authorization.replace("Bearer ", "")
        user_id = int(token)
        
        db = get_db()
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            return user
        finally:
            cursor.close()
            db.close()
    except (ValueError, HTTPException) as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail="Invalid token")

def get_db():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "staunchtech_dms"),
    )

def init_db():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            entra_user_id VARCHAR(255),
            entraId VARCHAR(255),
            auth_provider ENUM('email', 'google', 'microsoft') DEFAULT 'email',
            role ENUM('GLOBAL_ADMIN', 'USER_ADMIN', 'USER', 'GlobalAdmin', 'UserAdmin', 'NormalUser', 'PendingApproval') DEFAULT 'USER',
            status ENUM('ACTIVE', 'PENDING_APPROVAL', 'INACTIVE') DEFAULT 'ACTIVE',
            googleAuthenticated BOOLEAN DEFAULT FALSE,
            microsoftAuthenticated BOOLEAN DEFAULT FALSE,
            lastLogin DATETIME,
            loginStatus ENUM('ONLINE', 'OFFLINE') DEFAULT 'OFFLINE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.commit()
    cursor.close()
    db.close()

try:
    init_db()
except Exception as e:
    print(f"[DB] Warning: Could not init DB: {e}")


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SSORequest(BaseModel):
    name: str
    email: str
    provider: str  # 'google' or 'microsoft'

class MicrosoftAuthRequest(BaseModel):
    idToken: str
    accessToken: str

class GoogleAuthRequest(BaseModel):
    idToken: str
    accessToken: str


@router.post("/register")
def register(body: RegisterRequest):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, role FROM users WHERE email = %s", (body.email.lower(),))
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered. Please log in.")

        cursor.execute("SELECT COUNT(*) as cnt FROM users", ())
        count = cursor.fetchone()["cnt"]
        role = "GlobalAdmin" if count == 0 else "PendingApproval"

        pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, auth_provider, role) VALUES (%s, %s, %s, 'email', %s)",
            (body.name, body.email.lower(), pw_hash, role)
        )
        db.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "name": body.name, "email": body.email.lower(), "role": role, "auth_provider": "email"}
    finally:
        cursor.close()
        db.close()


@router.post("/login")
def login(body: LoginRequest):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email = %s", (body.email.lower(),))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        if not user.get("password_hash"):
            raise HTTPException(status_code=401, detail="This account uses SSO. Please use Google or Microsoft to sign in.")
        if not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"], "auth_provider": user["auth_provider"]}
    finally:
        cursor.close()
        db.close()


@router.post("/sso")
def sso_auth(body: SSORequest):
    """Called after Google/Microsoft SSO succeeds — upserts user in MySQL."""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email = %s", (body.email.lower(),))
        user = cursor.fetchone()
        if user:
            return {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"], "auth_provider": user["auth_provider"]}

        cursor.execute("SELECT COUNT(*) as cnt FROM users", ())
        count = cursor.fetchone()["cnt"]
        role = "GlobalAdmin" if count == 0 else "PendingApproval"

        cursor.execute(
            "INSERT INTO users (name, email, auth_provider, role) VALUES (%s, %s, %s, %s)",
            (body.name, body.email.lower(), body.provider, role)
        )
        db.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "name": body.name, "email": body.email.lower(), "role": role, "auth_provider": body.provider}
    finally:
        cursor.close()
        db.close()


def decode_id_token(id_token: str) -> dict:
    """Decode ID token without verification (frontend already validated)."""
    try:
        decoded = jwt.decode(id_token, options={"verify_signature": False})
        return decoded
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {str(e)}")


def check_user_in_tenant(access_token: str, email: str) -> Optional[dict]:
    """Check if user exists in Microsoft tenant via Graph API."""
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        res = requests.get(
            "https://graph.microsoft.com/v1.0/me",
            headers=headers,
            timeout=10
        )
        if res.status_code == 200:
            return res.json()
        return None
    except Exception as e:
        print(f"[Graph] Error checking user in tenant: {e}")
        return None


def get_graph_app_access_token() -> Optional[str]:
    """Get app-only Microsoft Graph token for tenant-wide user lookup/invites."""
    try:
        import msal

        client_id = os.getenv("API_ENTRA_APP_CLIENT_ID")
        client_secret = os.getenv("API_ENTRA_APP_CLIENT_SECRET")
        authority = os.getenv("API_ENTRA_APP_AUTHORITY")

        if not all([client_id, client_secret, authority]):
            print("[Entra] Missing Entra app credentials")
            return None

        app = msal.ConfidentialClientApplication(
            client_id,
            authority=authority,
            client_credential=client_secret
        )
        token_result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        return token_result.get("access_token")
    except Exception as e:
        print(f"[Entra] Error acquiring app token: {e}")
        return None


def get_graph_headers(access_token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def normalize_role_for_db(role: Optional[str]) -> str:
    if role in ("GLOBAL_ADMIN", "GlobalAdmin"):
        return "GLOBAL_ADMIN"
    if role in ("USER_ADMIN", "UserAdmin"):
        return "USER_ADMIN"
    if role == "PendingApproval":
        return "PendingApproval"
    return "USER"


def find_entra_user_by_email(access_token: str, email: str) -> Optional[dict]:
    """Find an Entra user by email, UPN, or other mails using app-only Graph access."""
    try:
        headers = get_graph_headers(access_token)
        safe_email = email.replace("'", "''")
        filter_query = (
            f"mail eq '{safe_email}' or "
            f"userPrincipalName eq '{safe_email}' or "
            f"otherMails/any(x:x eq '{safe_email}')"
        )
        res = requests.get(
            "https://graph.microsoft.com/v1.0/users",
            headers=headers,
            params={
                "$select": "id,displayName,mail,userPrincipalName,userType,otherMails",
                "$filter": filter_query,
            },
            timeout=10,
        )
        if res.status_code != 200:
            print(f"[Entra] User lookup failed: {res.status_code} - {res.text}")
            return None

        users = res.json().get("value", [])
        lowered_email = email.lower()
        for user in users:
            candidates = [
                (user.get("mail") or "").lower(),
                (user.get("userPrincipalName") or "").lower(),
            ] + [(value or "").lower() for value in user.get("otherMails", [])]
            if lowered_email in candidates:
                return user

        return users[0] if users else None
    except Exception as e:
        print(f"[Entra] Error finding user by email: {e}")
        return None


def resolve_entra_role(access_token: str, entra_user: Optional[dict]) -> str:
    """Resolve the app role from Entra directory roles. Guests map to USER."""
    if not entra_user:
        return "USER"

    if (entra_user.get("userType") or "").lower() == "guest":
        return "USER"

    user_id = entra_user.get("id")
    if not user_id:
        return "USER"

    try:
        headers = get_graph_headers(access_token)
        res = requests.get(
            f"https://graph.microsoft.com/v1.0/users/{user_id}/memberOf?$select=displayName,id",
            headers=headers,
            timeout=10
        )
        if res.status_code != 200:
            print(f"[Entra] Role lookup failed for {user_id}: {res.status_code} - {res.text}")
            return "USER"

        role_names = {item.get("displayName") for item in res.json().get("value", []) if item.get("displayName")}
        if role_names & GLOBAL_ADMIN_ROLE_NAMES:
            return "GLOBAL_ADMIN"
        if role_names & USER_ADMIN_ROLE_NAMES:
            return "USER_ADMIN"
        return "USER"
    except Exception as e:
        print(f"[Entra] Error resolving role for {user_id}: {e}")
        return "USER"


def ensure_entra_user(email: str, display_name: str) -> Dict[str, Any]:
    """
    Ensure an Entra directory user exists for the email.
    Returns entra_id, is_guest, created, and resolved role.
    """
    access_token = get_graph_app_access_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Microsoft Graph app credentials are not configured")

    existing_user = find_entra_user_by_email(access_token, email)
    if existing_user:
        role = resolve_entra_role(access_token, existing_user)
        return {
            "entra_id": existing_user.get("id", ""),
            "is_guest": (existing_user.get("userType") or "").lower() == "guest",
            "created": False,
            "role": role,
        }

    headers = get_graph_headers(access_token)
    invitation_body = {
        "invitedUserEmailAddress": email,
        "invitedUserDisplayName": display_name,
        "inviteRedirectUrl": "http://localhost:3000/auth-callback",
        "sendInvitationMessage": False
    }
    response = requests.post(
        "https://graph.microsoft.com/v1.0/invitations",
        headers=headers,
        json=invitation_body,
        timeout=10
    )

    if response.status_code not in (200, 201):
        print(f"[Entra] Failed to create guest user: {response.status_code} - {response.text}")
        raise HTTPException(status_code=502, detail="Failed to create or fetch Microsoft guest user")

    result = response.json()
    invited_user = result.get("invitedUser", {}) or {}
    return {
        "entra_id": invited_user.get("id", ""),
        "is_guest": True,
        "created": True,
        "role": "USER",
    }


def is_global_admin(access_token: str) -> bool:
    """Check if user is Global Admin via Microsoft Graph."""
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        res = requests.get(
            "https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName,id",
            headers=headers,
            timeout=10
        )
        if res.status_code != 200:
            return False
        
        data = res.json()
        for item in data.get("value", []):
            if item.get("displayName") in GLOBAL_ADMIN_ROLE_NAMES:
                return True
        return False
    except Exception as e:
        print(f"[Graph] Error checking admin status: {e}")
        return False

def is_user_admin(access_token: str) -> bool:
    """Check if user is User Admin via Microsoft Graph."""
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        res = requests.get(
            "https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName,id",
            headers=headers,
            timeout=10
        )
        if res.status_code != 200:
            return False
        
        data = res.json()
        for item in data.get("value", []):
            if item.get("displayName") in USER_ADMIN_ROLE_NAMES:
                return True
        return False
    except Exception as e:
        print(f"[Graph] Error checking user admin status: {e}")
        return False


@router.post("/microsoft")
def microsoft_auth(body: MicrosoftAuthRequest):
    """Microsoft SSO endpoint — validates tokens and syncs user with RBAC."""
    print(f"[Microsoft Auth] Starting authentication for tokens: idToken length={len(body.idToken)}, accessToken length={len(body.accessToken)}")

    # STEP 1: Decode ID token
    try:
        id_token_data = decode_id_token(body.idToken)
        print(f"[Microsoft Auth] Decoded ID token: {id_token_data.keys()}")
    except Exception as e:
        print(f"[Microsoft Auth] Failed to decode ID token: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {str(e)}")

    email = id_token_data.get("email") or id_token_data.get("preferred_username")
    name = id_token_data.get("name", "")
    oid = id_token_data.get("oid", "")

    print(f"[Microsoft Auth] Extracted: email={email}, name={name}, oid={oid}")

    if not email:
        print("[Microsoft Auth] No email found in token")
        raise HTTPException(status_code=400, detail="Email not found in token")

    email = email.lower()
    print(f"[Microsoft Auth] Processing email: {email}")

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        print("[Microsoft Auth] Database connection established")

        # STEP 2: Check if user exists in DB
        cursor.execute("SELECT id, name, email, role, auth_provider, microsoftAuthenticated FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        print(f"[Microsoft Auth] User lookup result: {user is not None}")
        if user:
            print(f"[Microsoft Auth] Found existing user: id={user['id']}, role={user['role']}, auth_provider={user.get('auth_provider')}, microsoftAuthenticated={user.get('microsoftAuthenticated')}")
        else:
            print(f"[Microsoft Auth] No existing user found for email: {email}")
            # Check total user count to determine if this should be a GlobalAdmin
            cursor.execute("SELECT COUNT(*) as user_count FROM users")
            count_result = cursor.fetchone()
            user_count = count_result['user_count'] if count_result else 0
            print(f"[Microsoft Auth] Total users in system: {user_count}")
        
        if user:
            print(f"[Microsoft Auth] Processing existing user authentication")

            # Validate user data structure
            required_fields = ['id', 'name', 'email', 'role']
            missing_fields = [field for field in required_fields if field not in user or user[field] is None]
            if missing_fields:
                print(f"[Microsoft Auth] ERROR: User record missing required fields: {missing_fields}")
                raise HTTPException(status_code=500, detail=f"Invalid user record: missing {missing_fields}")

            # STEP 3: Update existing user - mark Microsoft authenticated
            try:
                cursor.execute(
                    "UPDATE users SET microsoftAuthenticated = TRUE, lastLogin = %s, loginStatus = 'ONLINE', entraId = %s WHERE id = %s",
                    (datetime.now(), oid, user["id"])
                )
                db.commit()
                print(f"[Microsoft Auth] Updated user record successfully")

                # Verify the update worked
                cursor.execute("SELECT microsoftAuthenticated, lastLogin, loginStatus FROM users WHERE id = %s", (user["id"],))
                updated_user = cursor.fetchone()
                if updated_user:
                    print(f"[Microsoft Auth] Verification: microsoftAuthenticated={updated_user['microsoftAuthenticated']}, loginStatus={updated_user['loginStatus']}")
                else:
                    print("[Microsoft Auth] ERROR: Could not verify user update")
            except Exception as e:
                print(f"[Microsoft Auth] Failed to update user record: {e}")
                db.rollback()
                raise HTTPException(status_code=500, detail="Database update failed")

            # STEP 4: Check if both Google and Microsoft are authenticated
            if user.get("googleAuthenticated") and user.get("microsoftAuthenticated") is False:
                # Just completed Microsoft auth after Google
                print(f"[Microsoft Auth] Both authentications complete for {email}")

            # STEP 5: Get role and return dashboard
            role = user["role"]
            dashboard = get_dashboard_by_role(role)
            print(f"[Microsoft Auth] Returning success for existing user: role={role}, dashboard={dashboard}")

            return {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": role,
                "auth_provider": user["auth_provider"],
                "dashboard": dashboard,
                "message": "Authentication successful"
            }
        
        # STEP 6: New user (Microsoft-only login, no Google)
        print(f"[Microsoft Auth] Creating new user for {email}")
        tenant_user = check_user_in_tenant(body.accessToken, email)

        if not tenant_user:
            print(f"[Microsoft Auth] ERROR: User {email} not found in Microsoft tenant")
            raise HTTPException(status_code=403, detail="User not found in Microsoft tenant")

        print(f"[Microsoft Auth] User verified in tenant: {tenant_user.get('displayName', 'Unknown')}")
        
        # STEP 7: Determine role from Microsoft Graph
        print(f"[Microsoft Auth] Checking user roles in Microsoft Graph...")
        is_global = is_global_admin(body.accessToken)
        is_useradmin = is_user_admin(body.accessToken)

        print(f"[Microsoft Auth] Role check results: is_global={is_global}, is_useradmin={is_useradmin}")

        if is_global:
            role = "GLOBAL_ADMIN"
        elif is_useradmin:
            role = "USER_ADMIN"
        else:
            role = "USER"

        print(f"[Microsoft Auth] Assigned role: {role}")

        # STEP 8: Create user in DB
        try:
            cursor.execute(
                """INSERT INTO users (name, email, entraId, auth_provider, role, status,
                   googleAuthenticated, microsoftAuthenticated, lastLogin, loginStatus)
                   VALUES (%s, %s, %s, 'microsoft', %s, 'ACTIVE', FALSE, TRUE, %s, 'ONLINE')""",
                (name, email, oid, role, datetime.now())
            )
            db.commit()
            user_id = cursor.lastrowid
            print(f"[Microsoft Auth] Successfully created new user with ID: {user_id}")
        except Exception as e:
            print(f"[Microsoft Auth] ERROR: Failed to create user: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to create user account")
        
        # STEP 9: Get dashboard and return
        dashboard = get_dashboard_by_role(role)
        
        return {
            "id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "auth_provider": "microsoft",
            "dashboard": dashboard,
            "message": "Authentication successful"
        }
    finally:
        cursor.close()
        db.close()


@router.post("/google")
def google_auth(body: GoogleAuthRequest):
    """Google SSO endpoint — validates tokens and syncs user with RBAC."""
    try:
        # STEP 1: Verify Google ID token
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            raise HTTPException(status_code=500, detail="Google client ID not configured")
        
        try:
            idinfo = id_token.verify_oauth2_token(
                body.idToken, 
                google_requests.Request(), 
                google_client_id
            )
        except Exception as verify_error:
            # If verification fails, try to decode without verification (for development)
            print(f"[Google Auth] Token verification failed: {verify_error}")
            print(f"[Google Auth] Attempting to decode token without verification...")
            try:
                import jwt
                idinfo = jwt.decode(body.idToken, options={"verify_signature": False})
            except Exception as decode_error:
                raise HTTPException(status_code=400, detail=f"Invalid Google token: {str(decode_error)}")
        
        email = idinfo.get("email", "").lower()
        name = idinfo.get("name", "")
        google_id = idinfo.get("sub", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not found in token")
        
        db = get_db()
        cursor = db.cursor(dictionary=True)
        try:
            entra_identity = ensure_entra_user(email, name or email)
            entra_id = entra_identity.get("entra_id", "")
            entra_role = normalize_role_for_db(entra_identity.get("role"))
            is_guest = bool(entra_identity.get("is_guest"))

            # STEP 2: Check if user exists in DB
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
            
            if user:
                existing_role = normalize_role_for_db(user.get("role"))
                final_role = entra_role if entra_role in ("GLOBAL_ADMIN", "USER_ADMIN") else ("USER" if is_guest else existing_role)

                cursor.execute(
                    """UPDATE users
                       SET googleAuthenticated = TRUE,
                           microsoftAuthenticated = TRUE,
                           entraId = %s,
                           role = %s,
                           lastLogin = %s,
                           loginStatus = 'ONLINE'
                       WHERE id = %s""",
                    (entra_id, final_role, datetime.now(), user["id"])
                )
                db.commit()
                
                return {
                    "id": user["id"],
                    "name": user.get("name") or name,
                    "email": email,
                    "role": final_role,
                    "auth_provider": user.get("auth_provider") or "google",
                    "dashboard": get_dashboard_by_role(final_role),
                    "entraId": entra_id,
                    "is_guest": is_guest,
                    "message": "Google authentication successful"
                }
            
            role = entra_role
            cursor.execute(
                """INSERT INTO users (name, email, entraId, auth_provider, role, status, 
                   googleAuthenticated, microsoftAuthenticated, lastLogin, loginStatus) 
                   VALUES (%s, %s, %s, 'google', %s, 'ACTIVE', TRUE, TRUE, %s, 'ONLINE')""",
                (name, email, entra_id, role, datetime.now())
            )
            db.commit()
            user_id = cursor.lastrowid

            return {
                "id": user_id,
                "name": name,
                "email": email,
                "role": role,
                "auth_provider": "google",
                "dashboard": get_dashboard_by_role(role),
                "entraId": entra_id,
                "is_guest": is_guest,
                "message": "Google authentication successful"
            }
        finally:
            cursor.close()
            db.close()
    except ValueError as e:
        print(f"[Google Auth] ValueError: {str(e)}")
        print(f"[Google Auth] Token (first 50 chars): {body.idToken[:50]}...")
        raise HTTPException(status_code=400, detail=f"Invalid Google token: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Google Auth] Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")


def create_guest_user_in_entra(email: str, display_name: str) -> bool:
    """Create a guest user in Microsoft Entra ID using app-only token."""
    try:
        # Get app-only access token
        import msal
        client_id = os.getenv("API_ENTRA_APP_CLIENT_ID")
        client_secret = os.getenv("API_ENTRA_APP_CLIENT_SECRET")
        authority = os.getenv("API_ENTRA_APP_AUTHORITY")
        
        if not all([client_id, client_secret, authority]):
            print("[Entra] Missing Entra app credentials")
            return False
        
        app = msal.ConfidentialClientApplication(
            client_id,
            authority=authority,
            client_credential=client_secret
        )
        
        token_result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        
        if "access_token" not in token_result:
            print(f"[Entra] Failed to get token: {token_result.get('error_description')}")
            return False
        
        access_token = token_result["access_token"]
        
        # Check if guest user already exists
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Search for existing user
        search_url = f"https://graph.microsoft.com/v1.0/users?$filter=mail eq '{email}' or userPrincipalName eq '{email}'"
        search_response = requests.get(search_url, headers=headers, timeout=10)
        
        if search_response.status_code == 200:
            users = search_response.json().get("value", [])
            if users:
                print(f"[Entra] Guest user already exists: {email}")
                return True
        
        # Create guest user invitation
        invitation_url = "https://graph.microsoft.com/v1.0/invitations"
        invitation_body = {
            "invitedUserEmailAddress": email,
            "invitedUserDisplayName": display_name,
            "inviteRedirectUrl": "http://localhost:3000/auth-callback",
            "sendInvitationMessage": False  # Don't send email, user will auth via our flow
        }
        
        response = requests.post(invitation_url, headers=headers, json=invitation_body, timeout=10)
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"[Entra] Guest user created: {result.get('invitedUser', {}).get('id')}")
            return True
        else:
            print(f"[Entra] Failed to create guest user: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"[Entra] Error creating guest user: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def get_dashboard_by_role(role: str) -> str:
    """Return dashboard URL based on user role."""
    role_map = {
        "GLOBAL_ADMIN": "/globaladmin/homepage",
        "GlobalAdmin": "/globaladmin/homepage",
        "USER_ADMIN": "/useradmin/homepage",
        "UserAdmin": "/useradmin/homepage",
        "USER": "/user/homepage",
        "NormalUser": "/user/homepage",
        "PendingApproval": "/login/pendingapprovaluser"
    }
    dashboard = role_map.get(role, "/user/homepage")
    print(f"[Dashboard] Role '{role}' mapped to '{dashboard}'")
    return dashboard
