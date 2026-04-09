import os
import json
import secrets
import string
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from graph_client import get_graph_session
from .audit_logs import append_log
from database import get_db_connection

router = APIRouter()

ROLES = ["GlobalAdmin", "UserAdmin", "NormalUser"]
STATUS = ["PENDING_APPROVAL", "ACTIVE", "REJECTED"]

# ─────────────────────────────────────────────
# Local role store — fallback when Graph PATCH is denied
# Stored as { userId: role } in a JSON file
# ─────────────────────────────────────────────
_ROLE_STORE_FILE = os.path.join(os.path.dirname(__file__), "../local_roles.json")
_USERS_STORE_FILE = os.path.join(os.path.dirname(__file__), "../users_store.json")

def _read_role_store() -> dict:
    """Read extended role store: {userId: {role: str, assignedContainers: list[str], assignedApps: list[str]}}"""
    if not os.path.exists(_ROLE_STORE_FILE):
        return {}
    try:
        with open(_ROLE_STORE_FILE) as f:
            data = json.load(f)
            # Backward compatibility: convert simple string roles to extended format
            converted = {}
            for k, v in data.items():
                if isinstance(v, str):
                    converted[k] = {"role": v, "assignedContainers": [], "assignedApps": []}
                else:
                    converted[k] = v
            return converted
    except Exception:
        return {}

def _write_role_store(store: dict):
    with open(_ROLE_STORE_FILE, "w") as f:
        json.dump(store, f, indent=2)

def _save_local_role(user_id: str, role: str, assigned_containers: list[str] = None, assigned_apps: list[str] = None):
    """Save extended role info"""
    store = _read_role_store()
    store[user_id] = {
        "role": role,
        "assignedContainers": assigned_containers or [],
        "assignedApps": assigned_apps or []
    }
    _write_role_store(store)

def _read_users_store() -> dict:
    """Read users store: {email: {id, name, email, entra_user_id, provider, role, status, created_at}}"""
    if not os.path.exists(_USERS_STORE_FILE):
        return {}
    try:
        with open(_USERS_STORE_FILE) as f:
            return json.load(f)
    except Exception:
        return {}

def _write_users_store(store: dict):
    with open(_USERS_STORE_FILE, "w") as f:
        json.dump(store, f, indent=2)

def _random_password(length=16):
    chars = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(chars) for _ in range(length))

def _create_guest_invitation(session, email: str, name: str, redirect_url: str):
    """Create guest user invitation in Microsoft Entra ID"""
    payload = {
        "invitedUserEmailAddress": email,
        "invitedUserDisplayName": name,
        "inviteRedirectUrl": redirect_url,
        "sendInvitationMessage": True,
        "invitedUserMessageInfo": {
            "customizedMessageBody": f"You have been invited to join StaunchTech Document Management System. Your account is pending approval from an administrator."
        }
    }
    
    res = session.post("https://graph.microsoft.com/v1.0/invitations", json=payload)
    if res.status_code not in (200, 201):
        error_data = res.json()
        raise HTTPException(status_code=res.status_code, detail=error_data.get("error", {}).get("message", "Failed to create guest invitation"))
    
    return res.json()


# ─────────────────────────────────────────────
# POST /api/auth/signup - Email Signup
# ─────────────────────────────────────────────
@router.post("/auth/signup")
async def email_signup(request: Request):
    """Email/password signup with guest invitation"""
    data = await request.json()
    name = data.get("name", "").strip()
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    if not name or not email or not password:
        raise HTTPException(status_code=400, detail="Name, email, and password are required")

    # Check if user exists in database first
    db_user = _get_user_from_db(email)
    if db_user:
        raise HTTPException(status_code=409, detail="Email already registered. Please log in.")

    # Check JSON store as fallback
    users_store = _read_users_store()
    if email in users_store:
        raise HTTPException(status_code=409, detail="Email already registered. Please log in.")

    # Create guest invitation in Microsoft Entra ID
    session = get_graph_session()
    redirect_url = f"{os.getenv('APP_URL', 'http://localhost:3000')}/login/pendingapprovaluser"
    
    try:
        invitation = _create_guest_invitation(session, email, name, redirect_url)
        entra_user_id = invitation.get("invitedUser", {}).get("id", "")
    except Exception as e:
        print(f"Warning: Could not create guest invitation: {e}")
        entra_user_id = f"pending_{email}"

    # Create user in MySQL database
    db_user = _create_user_in_db(name, email, entra_user_id, "email", "NormalUser", "PENDING_APPROVAL")
    
    if db_user:
        # Database creation successful
        append_log("SIGNUP", email, email, "Email signup - pending approval (DB)", "success")
        return {
            "success": True,
            "message": "Your account is pending approval from administrator. You will receive an email once approved.",
            "user": db_user
        }
    else:
        # Fallback to JSON store
        user_id = len(users_store) + 1
        new_user = {
            "id": user_id,
            "name": name,
            "email": email,
            "entra_user_id": entra_user_id,
            "provider": "email",
            "role": "NormalUser",
            "status": "PENDING_APPROVAL",
            "created_at": datetime.utcnow().isoformat()
        }
        
        users_store[email] = new_user
        _write_users_store(users_store)
        
        append_log("SIGNUP", email, email, "Email signup - pending approval (JSON)", "success")
        
        return {
            "success": True,
            "message": "Your account is pending approval from administrator. You will receive an email once approved.",
            "user": new_user
        }


# ─────────────────────────────────────────────
# POST /api/auth/login - Login with status check
# ─────────────────────────────────────────────
@router.post("/auth/login")
async def email_login(request: Request):
    """Email/password login with status check"""
    data = await request.json()
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    # Try database first
    user = _get_user_from_db(email)
    
    # Fallback to JSON store
    if not user:
        users_store = _read_users_store()
        if email in users_store:
            user = users_store[email]
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check status
    status = user.get("status", "PENDING_APPROVAL")
    
    if (status == "PENDING_APPROVAL"):
        return {
            "success": False,
            "message": "Your account is pending approval from administrator. Please wait for approval.",
            "status": "PENDING_APPROVAL",
            "redirect": "/login/pendingapprovaluser",
            "user": user
        }
    elif status == "REJECTED":
        raise HTTPException(status_code=403, detail="Your account has been rejected. Please contact administrator.")
    elif status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Your account is not active. Please contact administrator.")
    
    # For now, we're not storing passwords in the JSON file
    # In production, you would verify the password hash here
    append_log("LOGIN", email, email, "Email/password login", "success")
    
    return {
        "success": True,
        "message": "Login successful",
        "user": user
    }


# ─────────────────────────────────────────────
# POST /api/auth/register - Email/Password Registration
# ─────────────────────────────────────────────
@router.post("/auth/register")
async def register_user(request: Request):
    """Email/password registration endpoint"""
    data = await request.json()
    email = data.get("email", "").lower()
    name = data.get("name", "")
    password = data.get("password", "")

    if not email or not name or not password:
        raise HTTPException(status_code=400, detail="Email, name, and password are required")

    users_store = _read_users_store()

    # Check if user already exists
    if email in users_store:
        raise HTTPException(status_code=409, detail="Email already registered. Please log in.")

    # First user becomes GlobalAdmin, others get PendingApproval
    role = "GlobalAdmin" if len(users_store) == 0 else "PendingApproval"
    
    new_user = {
        "id": len(users_store) + 1,
        "email": email,
        "name": name,
        "role": role,
        "auth_provider": "email",
        "created_date": datetime.utcnow().isoformat()
    }
    
    users_store[email] = new_user
    _write_users_store(users_store)
    
    append_log("REGISTER", email, email, f"Email registration with role: {role}", "success")
    return new_user


# ─────────────────────────────────────────────
# POST /api/auth/sso - SSO Signup (Google/Microsoft)
# ─────────────────────────────────────────────
@router.post("/auth/sso")
async def sso_signup(request: Request):
    """SSO signup for Microsoft/Google with guest invitation"""
    data = await request.json()
    name = data.get("name", "").strip()
    email = data.get("email", "").lower().strip()
    provider = data.get("provider", "microsoft")

    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")

    users_store = _read_users_store()

    # Check if user exists
    if email in users_store:
        user = users_store[email]
        
        # Check status
        if (user.get("status") == "PENDING_APPROVAL"):
            return {
                "success": False,
                "message": "Your account is pending approval from administrator.",
                "status": "PENDING_APPROVAL",
                "redirect": "/login/pendingapprovaluser",
                "user": user
            }
        elif user.get("status") == "REJECTED":
            raise HTTPException(status_code=403, detail="Your account has been rejected. Please contact administrator.")
        
        append_log("SSO_LOGIN", email, email, f"SSO login via {provider}", "success")
        return {
            "success": True,
            "message": "Login successful",
            "user": user
        }

    # Create guest invitation for Google users
    session = get_graph_session()
    redirect_url = f"{os.getenv('APP_URL', 'http://localhost:3000')}/pending-approval"
    entra_user_id = ""
    
    if provider == "google":
        try:
            invitation = _create_guest_invitation(session, email, name, redirect_url)
            entra_user_id = invitation.get("invitedUser", {}).get("id", "")
        except Exception as e:
            print(f"Warning: Could not create guest invitation: {e}")
            entra_user_id = f"pending_{email}"
    else:
        # For Microsoft users, they might already be in the tenant
        entra_user_id = f"microsoft_{email}"

    # Create user in store
    user_id = len(users_store) + 1
    new_user = {
        "id": user_id,
        "name": name,
        "email": email,
        "entra_user_id": entra_user_id,
        "provider": provider,
        "role": "NormalUser",
        "status": "PENDING_APPROVAL",
        "created_at": datetime.utcnow().isoformat()
    }
    
    users_store[email] = new_user
    _write_users_store(users_store)
    
    append_log("SSO_SIGNUP", email, email, f"SSO signup via {provider} - pending approval", "success")
    
    return {
        "success": True,
        "message": "Your account is pending approval from administrator. You will be notified once approved.",
        "user": new_user
    }


# ─────────────────────────────────────────────
# GET /api/users/me/role
# ─────────────────────────────────────────────
from .rbac_utils import _get_upn_from_token

@router.get("/me/role")
def get_my_role(request: Request):
    """Detect the role of the user (passed in X-User-UPN header or Bearer Token)."""
    raw_upn = request.headers.get("X-User-UPN", "").strip()
    upn = raw_upn.lower()
    print(f"[RBAC] DEBUG: Header X-User-UPN: '{raw_upn}'")
    
    if not upn:
        upn = _get_upn_from_token(request)
        print(f"[RBAC] DEBUG: Found UPN from token: '{upn}'")
    
    # HARD OVERRIDE FOR kamalnath@0hnz6.onmicrosoft.com
    HARD_ID = "eff24ba0-7097-4fd0-b1d8-13546bf8e5db"
    if upn == "kamalnath@0hnz6.onmicrosoft.com" or upn == "kamalnath.m@0hnz6.onmicrosoft.com" or upn == "kamalnath@0hnz6.onmicrosoft.com":
        print(f"[RBAC] FORCED GLOBAL ADMIN for {upn}")
        return {"role": "GlobalAdmin", "source": "force"}
    
    if not upn:
        print("[RBAC] DEBUG: No UPN found, defaulting to NormalUser")
        return {"role": "NormalUser", "source": "none"}
    
    print(f"[RBAC] Fetching role for UPN: {upn}")
    session = get_graph_session()
    store = _read_role_store()
    
    user_res = session.get(f"https://graph.microsoft.com/v1.0/users/{upn}?$select=id,jobTitle,userPrincipalName,mail")
    if user_res.status_code == 200:
        u = user_res.json()
        uid = u.get("id")
        
        if uid == HARD_ID:
             print(f"[RBAC] FORCED GLOBAL ADMIN by ID: {uid}")
             return {"role": "GlobalAdmin", "source": "force"}
        
        email = (u.get("mail") or u.get("userPrincipalName", "")).lower()
        print(f"[RBAC] DEBUG: Graph user: id={uid}, email={email}, jobTitle={u.get('jobTitle')}")
        
        user_data = store.get(uid) or store.get(email)
        if user_data:
            local_role = user_data.get("role")
            print(f"[RBAC] DEBUG: Found local role: {local_role}")
            if local_role == "Admin": local_role = "UserAdmin"
            if local_role == "User": local_role = "NormalUser"
            if local_role in ROLES:
                return {"role": local_role, "source": "local"}
        
        roleName = u.get("jobTitle")
        print(f"[RBAC] DEBUG: Found jobTitle: {roleName}")
        if roleName == "Admin": roleName = "UserAdmin"
        if roleName == "User": roleName = "NormalUser"
        if roleName in ROLES:
            return {"role": roleName, "source": "graph"}

    print(f"[RBAC] Fallback to NormalUser for {upn} (status: {user_res.status_code})")
    return {"role": "NormalUser", "source": "default"}


# ─────────────────────────────────────────────
# GET /api/users
# ─────────────────────────────────────────────
@router.get("")
@router.get("/")
def list_users(search: str = ""):
    session = get_graph_session()
    if search:
        url = (
            f"https://graph.microsoft.com/v1.0/users"
            f"?$filter=startswith(displayName,'{search}') or startswith(userPrincipalName,'{search}')"
            f"&$select=id,displayName,userPrincipalName,mail,jobTitle,department,accountEnabled,createdDateTime"
        )
    else:
        url = (
            "https://graph.microsoft.com/v1.0/users"
            "?$select=id,displayName,userPrincipalName,mail,jobTitle,department,accountEnabled,createdDateTime"
            "&$top=100"
        )
    res = session.get(url)
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.json())

    users = res.json().get("value", [])

        # Merge locally stored roles (extended schema)
    role_store = _read_role_store()
    for u in users:
        user_data = role_store.get(u["id"])
        if user_data:
            u["jobTitle"] = user_data.get("role")
            u["roleSource"] = "local"
            u["assignedContainers"] = user_data.get("assignedContainers", [])
            u["assignedApps"] = user_data.get("assignedApps", [])
        else:
            u["roleSource"] = "graph"

    return users



# ─────────────────────────────────────────────
# POST /api/users
# ─────────────────────────────────────────────
@router.post("")
@router.post("/")
async def create_user(request: Request):
    from .rbac_utils import get_user_role
    role = get_user_role(request)
    
    if role not in ["GlobalAdmin", "UserAdmin"]:
        raise HTTPException(status_code=403, detail="Normal Users cannot create users.")

    data = await request.json()
    display_name = data.get("displayName")
    upn = data.get("userPrincipalName")
    assigned_role = data.get("role", "NormalUser")

    # UserAdmin can only create NormalUsers
    if role == "UserAdmin" and assigned_role != "NormalUser":
        raise HTTPException(status_code=403, detail="User Admin can only create Normal Users.")

    if not display_name or not upn:
        raise HTTPException(status_code=400, detail="displayName and userPrincipalName are required")
    if assigned_role not in ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {ROLES}")

    session = get_graph_session()
    password = _random_password()
    payload = {
        "accountEnabled": True,
        "displayName": display_name,
        "mailNickname": upn.split("@")[0],
        "userPrincipalName": upn,
        "passwordProfile": {
            "forceChangePasswordNextSignIn": True,
            "password": password
        },
        "jobTitle": assigned_role,
        "department": data.get("department", "")
    }
    res = session.post("https://graph.microsoft.com/v1.0/users", json=payload)
    if res.status_code not in (200, 201):
        raise HTTPException(status_code=res.status_code, detail=res.json())

    user = res.json()
    _save_local_role(user["id"], assigned_role)
    append_log("CREATE_USER", "system", upn, f"Role: {assigned_role}", "success")
    return {**user, "tempPassword": password, "assignedRole": assigned_role}


# ─────────────────────────────────────────────
# PATCH /api/users/{user_id}/role
# ─────────────────────────────────────────────
@router.patch("/{user_id}/role")
async def assign_role(user_id: str, request: Request):
    from .rbac_utils import get_user_role
    u_role = get_user_role(request)
    
    if u_role not in ["GlobalAdmin", "UserAdmin"]:
        raise HTTPException(status_code=403, detail="Normal Users cannot assign roles.")

    data = await request.json()
    new_role = data.get("role")
    if new_role not in ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {ROLES}")

    session = get_graph_session()
    
    # 1. Fetch target user role to ensure they are not an admin if caller is a UserAdmin
    target_res = session.get(f"https://graph.microsoft.com/v1.0/users/{user_id}?$select=jobTitle")
    if target_res.status_code == 200:
        target_info = target_res.json()
        target_role = target_info.get("jobTitle", "NormalUser")
        
        if u_role == "UserAdmin":
            if target_role in ["GlobalAdmin", "UserAdmin"]:
                raise HTTPException(status_code=403, detail="User Admin cannot change roles of other Admins.")
            if new_role != "NormalUser":
                # UserAdmin can only 'change' a NormalUser to NormalUser (effectively only for local store refresh)
                # or maybe they just can't change app roles.
                # In this app, we'll allow them to SET it to NormalUser but nothing else.
                raise HTTPException(status_code=403, detail="User Admin can only manage Normal User roles.")

    graph_updated = False
    res = session.patch(
        f"https://graph.microsoft.com/v1.0/users/{user_id}",
        json={"jobTitle": new_role}
    )

    if res.status_code in (200, 204):
        graph_updated = True

    store = _read_role_store()
    _save_local_role(user_id, new_role, store.get(user_id, {}).get("assignedContainers", []), store.get(user_id, {}).get("assignedApps", []))
    append_log("ASSIGN_ROLE", "system", user_id, f"Role: {new_role}", "success")

    return {
        "message": f"Role '{new_role}' assigned",
        "userId": user_id,
        "graphUpdated": graph_updated
    }

@router.delete("/{user_id}")
def delete_user(user_id: str, request: Request):
    from .rbac_utils import get_user_role
    u_role = get_user_role(request)
    
    if u_role == "NormalUser":
        raise HTTPException(status_code=403, detail="Normal Users cannot delete users.")

    session = get_graph_session()
    
    # UserAdmin cannot delete Admins
    if u_role == "UserAdmin":
        target_res = session.get(f"https://graph.microsoft.com/v1.0/users/{user_id}?$select=jobTitle")
        if target_res.status_code == 200:
            target_role = target_res.json().get("jobTitle")
            if target_role in ["GlobalAdmin", "UserAdmin"]:
                raise HTTPException(status_code=403, detail="User Admin cannot delete Admins.")

    res = session.delete(f"https://graph.microsoft.com/v1.0/users/{user_id}")
    if res.status_code != 204:
        raise HTTPException(status_code=res.status_code, detail=res.json())
    return {"message": "User deleted"}


# ─────────────────────────────────────────────
# Admin APIs - User Approval Management
# ─────────────────────────────────────────────

@router.get("/admin/pending-users")
def get_pending_users(request: Request):
    """Get all users pending approval (UserAdmin and GlobalAdmin only)"""
    from .rbac_utils import get_user_role
    role = get_user_role(request)
    
    if role not in ["GlobalAdmin", "UserAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can view pending users")
    
    users_store = _read_users_store()
    pending_users = [
        user for user in users_store.values()
        if user.get("status") == "PENDING_APPROVAL"
    ]
    
    return {
        "success": True,
        "count": len(pending_users),
        "users": pending_users
    }


@router.post("/admin/approve-user/{user_id}")
async def approve_user(user_id: int, request: Request):
    """Approve a pending user (UserAdmin and GlobalAdmin only)"""
    from .rbac_utils import get_user_role
    role = get_user_role(request)
    
    if role not in ["GlobalAdmin", "UserAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can approve users")
    
    users_store = _read_users_store()
    
    # Find user by ID
    user_email = None
    for email, user in users_store.items():
        if user.get("id") == user_id:
            user_email = email
            break
    
    if not user_email:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = users_store[user_email]
    
    if user.get("status") != "PENDING_APPROVAL":
        raise HTTPException(status_code=400, detail="User is not pending approval")
    
    # Update status to ACTIVE
    user["status"] = "ACTIVE"
    user["approved_at"] = datetime.utcnow().isoformat()
    user["approved_by"] = request.headers.get("X-User-UPN", "admin")
    
    users_store[user_email] = user
    _write_users_store(users_store)
    
    append_log("APPROVE_USER", user_email, user_email, f"User approved by {role}", "success")
    
    return {
        "success": True,
        "message": f"User {user['name']} has been approved",
        "user": user
    }


@router.post("/admin/reject-user/{user_id}")
async def reject_user(user_id: int, request: Request):
    """Reject a pending user (UserAdmin and GlobalAdmin only)"""
    from .rbac_utils import get_user_role
    role = get_user_role(request)
    
    if role not in ["GlobalAdmin", "UserAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can reject users")
    
    data = await request.json()
    reason = data.get("reason", "No reason provided")
    
    users_store = _read_users_store()
    
    # Find user by ID
    user_email = None
    for email, user in users_store.items():
        if user.get("id") == user_id:
            user_email = email
            break
    
    if not user_email:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = users_store[user_email]
    
    if user.get("status") != "PENDING_APPROVAL":
        raise HTTPException(status_code=400, detail="User is not pending approval")
    
    # Update status to REJECTED
    user["status"] = "REJECTED"
    user["rejected_at"] = datetime.utcnow().isoformat()
    user["rejected_by"] = request.headers.get("X-User-UPN", "admin")
    user["rejection_reason"] = reason
    
    users_store[user_email] = user
    _write_users_store(users_store)
    
    append_log("REJECT_USER", user_email, user_email, f"User rejected by {role}: {reason}", "success")
    
    return {
        "success": True,
        "message": f"User {user['name']} has been rejected",
        "user": user
    }


@router.get("/admin/users")
def get_all_users(request: Request, status: str = None):
    """Get all users with optional status filter (UserAdmin and GlobalAdmin only)"""
    from .rbac_utils import get_user_role
    role = get_user_role(request)
    
    if role not in ["GlobalAdmin", "UserAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    users_store = _read_users_store()
    users_list = list(users_store.values())
    
    if status:
        users_list = [u for u in users_list if u.get("status") == status]
    
    return {
        "success": True,
        "count": len(users_list),
        "users": users_list
    }


def _create_user_in_db(name: str, email: str, entra_user_id: str, provider: str, role: str = "NormalUser", status: str = "PENDING_APPROVAL"):
    """Create user in MySQL database"""
    connection = get_db_connection()
    if not connection:
        print("⚠️ Database not available, using JSON fallback")
        return None
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Check if user already exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        existing = cursor.fetchone()
        
        if existing:
            return existing
        
        # Insert new user
        query = """
            INSERT INTO users (name, email, entra_user_id, provider, role, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """
        cursor.execute(query, (name, email, entra_user_id, provider, role, status))
        connection.commit()
        
        # Get the created user
        user_id = cursor.lastrowid
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        print(f"✅ User created in database: {email}")
        return user
        
    except Exception as e:
        print(f"❌ Error creating user in database: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def _get_user_from_db(email: str):
    """Get user from MySQL database"""
    connection = get_db_connection()
    if not connection:
        return None
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        return user
    except Exception as e:
        print(f"❌ Error getting user from database: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def _update_user_status_in_db(user_id: int, status: str, updated_by: str = None, reason: str = None):
    """Update user status in MySQL database"""
    connection = get_db_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor()
        
        if status == "ACTIVE":
            query = "UPDATE users SET status = %s, approved_at = NOW(), approved_by = %s WHERE id = %s"
            cursor.execute(query, (status, updated_by, user_id))
        elif status == "REJECTED":
            query = "UPDATE users SET status = %s, rejected_at = NOW(), rejected_by = %s, rejection_reason = %s WHERE id = %s"
            cursor.execute(query, (status, updated_by, reason, user_id))
        else:
            query = "UPDATE users SET status = %s WHERE id = %s"
            cursor.execute(query, (status, user_id))
        
        connection.commit()
        print(f"✅ User status updated in database: {user_id} -> {status}")
        return True
        
    except Exception as e:
        print(f"❌ Error updating user status: {e}")
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def _get_users_by_status_from_db(status: str = None):
    """Get users by status from MySQL database"""
    connection = get_db_connection()
    if not connection:
        return []
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        if status:
            cursor.execute("SELECT * FROM users WHERE status = %s ORDER BY created_at DESC", (status,))
        else:
            cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        
        users = cursor.fetchall()
        return users
        
    except Exception as e:
        print(f"❌ Error getting users from database: {e}")
        return []
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()
