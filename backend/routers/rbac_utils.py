from fastapi import HTTPException, Request, Depends
from graph_client import get_graph_session
import os
import json

import base64
import json

ROLES = ["GlobalAdmin", "UserAdmin", "NormalUser"]

def _get_upn_from_token(request: Request) -> str:
    """Safe extraction of UPN/email from Bearer token claims."""
    try:
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "): return ""
        token = auth.split(" ")[1]
        parts = token.split(".")
        if len(parts) < 2: return ""
        
        # Base64 padding fix
        payload_b64 = parts[1]
        rem = len(payload_b64) % 4
        if rem > 0: payload_b64 += "=" * (4 - rem)
        
        decoded = json.loads(base64.b64decode(payload_b64 + "==").decode('utf-8', errors='ignore'))
        # Entra tokens use 'upn', 'preferred_username', or 'email'
        upn = (decoded.get("upn") or decoded.get("preferred_username") or decoded.get("email") or "").lower()
        print(f"[RBAC-UTILS] Found UPN in token: {upn}")
        return upn
    except Exception as e:
        print(f"[RBAC-UTILS] Error decoding token: {e}")
        return ""

def get_user_role(request: Request) -> str:
    """Gets the authoritative role for the caller (X-User-UPN or token)."""
    upn = request.headers.get("X-User-UPN", "").strip().lower()
    if not upn:
        upn = _get_upn_from_token(request)
    
    if not upn: 
        print("[RBAC-UTILS] No UPN found in headers or token.")
        return "NormalUser"
    
    # HARD OVERRIDE FOR kamalnath@0hnz6.onmicrosoft.com
    HARD_ID = "eff24ba0-7097-4fd0-b1d8-13546bf8e5db"
    # Added extra variants just in case
    if upn in ["kamalnath@0hnz6.onmicrosoft.com", "kamalnath.m@0hnz6.onmicrosoft.com", "kamalnath.m@0hnz6.onmicrosoft.com".lower()]:
        print(f"[RBAC-UTILS] FORCED GLOBAL ADMIN for {upn}")
        return "GlobalAdmin"
    
    try:
        session = get_graph_session()
        # 1. Fetch user ID to check local store
        res = session.get(f"https://graph.microsoft.com/v1.0/users/{upn}?$select=jobTitle,id")
        if res.status_code == 200:
            user_info = res.json()
            user_id = user_info.get("id")
            
            # Second hard-check by ID
            if user_id == HARD_ID:
                print(f"[RBAC-UTILS] FORCED GLOBAL ADMIN by ID: {user_id}")
                return "GlobalAdmin"
            
            # 2. Check local roles first (authoritative override)
            from routers.users import _read_role_store
            store = _read_role_store()
            user_data = store.get(user_id) or store.get(upn)
            if user_data:
                local_role = user_data.get("role")
                if local_role == "Admin": local_role = "UserAdmin"
                if local_role == "User": local_role = "NormalUser"
                if local_role in ROLES: 
                    print(f"[RBAC-UTILS] Found local role for {upn}: {local_role}")
                    return local_role
            
            # 3. Fallback to jobTitle
            role = user_info.get("jobTitle")
            if role == "Admin": role = "UserAdmin"
            if role == "User": role = "NormalUser"
            if role in ROLES: 
                print(f"[RBAC-UTILS] Found Graph role for {upn}: {role}")
                return role
        else:
            print(f"[RBAC-UTILS] Graph check failed for {upn}: {res.status_code}")
    except Exception as e:
        print(f"[RBAC-UTILS] Exception in role check: {e}")
        
    print(f"[RBAC-UTILS] Defaulting {upn} to NormalUser")
    return "NormalUser"

def get_user_assignments(user_id: str) -> dict:
    """Get extended user assignments from local store: {role, assignedContainers, assignedApps}"""
    from routers.users import _read_role_store
    store = _read_role_store()
    return store.get(user_id, {"role": "NormalUser", "assignedContainers": [], "assignedApps": []})

def get_assigned_containers_for_user(upn_or_id: str) -> list[str]:
    """Get containers explicitly assigned to a specific user (by ID or UPN)."""
    from routers.users import _read_role_store
    store = _read_role_store()
    user_data = store.get(upn_or_id, {})
    return user_data.get("assignedContainers", [])

def require_role(allowed_roles: list):
    """FastAPI dependency to enforce roles."""
    def role_checker(request: Request):
        role = get_user_role(request)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Permission Denied: Current role '{role}' is not in allowed roles {allowed_roles}"
            )
        return role
    return Depends(role_checker)

def check_container_permission(container_id: str, request: Request, required_roles: list = None):
    """
    Checks if the caller has sufficient SharePoint Embedded permissions on a container.
    GlobalAdmin has 'owner' access to everything.
    """
    upn = request.headers.get("X-User-UPN", "").strip().lower()
    if not upn:
        upn = _get_upn_from_token(request)
    if not upn: raise HTTPException(status_code=401, detail="Authentication required")
    
    # 1. GlobalAdmin overrides all
    u_role = get_user_role(request)
    if u_role == "GlobalAdmin": return "owner"
    
    # 2. Check direct permissions via Graph
    session = get_graph_session()
    p_res = session.get(f"https://graph.microsoft.com/beta/storage/fileStorage/containers/{container_id}/permissions")
    if p_res.status_code != 200:
        raise HTTPException(status_code=p_res.status_code, detail="Failed to verify container permissions")
    
    perms = p_res.json().get("value", [])
    user_p = None
    for p in perms:
        if p.get("grantedToV2", {}).get("user", {}).get("userPrincipalName", "").lower() == upn:
            user_p = p.get("roles", ["reader"])[0]
            break
            
    if not user_p:
        raise HTTPException(status_code=403, detail="Permission Denied: User not assigned to this container.")
    
    if required_roles:
        # Hierarchy: owner > manager > writer > reader
        hierarchy = {"owner": 4, "manager": 3, "writer": 2, "write": 2, "reader": 1, "read": 1}
        max_req = max([hierarchy.get(r, 0) for r in required_roles])
        has_val = hierarchy.get(user_p, 0)
        
        if has_val < max_req:
            raise HTTPException(status_code=403, detail=f"Permission Denied: Required {required_roles}, but user has {user_p}")
            
    return user_p

def can_manage_container(container_id: str, request: Request):
    """Returns true if the caller can manage permissions/delete this container."""
    role = get_user_role(request)
    if role == "GlobalAdmin": return True
    
    # UserAdmin must be local 'owner' or 'manager' on the container
    try:
        container_p = check_container_permission(container_id, request, ["owner", "manager"])
        return True
    except HTTPException:
        return False

def has_permission(user: dict, resource_type: str, action: str) -> bool:
    """Check if user has permission to perform action on resource type."""
    role = user.get("role", "PendingApproval")
    
    # GlobalAdmin has all permissions
    if role == "GlobalAdmin":
        return True
    
    # UserAdmin can manage users
    if role == "UserAdmin" and resource_type == "user":
        return True
    
    # Regular users can read their own data
    if role == "User" and action == "read":
        return True
    
    # PendingApproval has no permissions
    return False
