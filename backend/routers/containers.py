from fastapi import APIRouter, HTTPException, Request
from graph_client import get_graph_session
from routers.audit_logs import append_log
from concurrent.futures import ThreadPoolExecutor, as_completed
import os

router = APIRouter()
CONTAINER_LIMIT = 5


@router.get("/listContainers")
def list_containers(request: Request):
    """List containers. GlobalAdmin sees all; UserAdmin only sees assigned ones."""
    upn = request.headers.get("X-User-UPN", "").lower()
    session = get_graph_session()
    CONTAINER_TYPE_ID = os.environ.get("CONTAINER_TYPE_ID")
    
    from .rbac_utils import get_user_role
    role = get_user_role(request)
    is_global = (role == "GlobalAdmin")

    # 2. Fetch all containers of this type
    url = f"https://graph.microsoft.com/beta/storage/fileStorage/containers?$filter=containerTypeId eq {CONTAINER_TYPE_ID}"
    response = session.get(url)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())
    
    all_containers = response.json().get("value", [])
    
    # 3. If not global, only return containers where user has explicit permission
    if not is_global:
        if not upn: return {"value": []}
        
        assigned = []
        def check_user_perm(c):
            p_res = session.get(f"https://graph.microsoft.com/beta/storage/fileStorage/containers/{c['id']}/permissions")
            if p_res.status_code == 200:
                perms = p_res.json().get("value", [])
                for p in perms:
                    granted_upn = p.get("grantedToV2", {}).get("user", {}).get("userPrincipalName", "").lower()
                    if granted_upn == upn:
                        # Success! Found a direct assignment
                        # Return container enhanced with the specific user's role
                        c["userRole"] = p.get("roles", ["reader"])[0] 
                        return c
            return None

        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = [ex.submit(check_user_perm, c) for c in all_containers]
            for f in as_completed(futures):
                res = f.result()
                if res: assigned.append(res)
        
        return {"value": assigned}

    # GlobalAdmin sees everything
    return {"value": all_containers}


@router.post("/createContainer")
async def create_container(request: Request):
    """Create a container. Restricted to Global Admin."""
    upn = request.headers.get("X-User-UPN", "").lower()
    session = get_graph_session()
    
    from .rbac_utils import get_user_role
    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Global Admin can create containers.")

    data = await request.json()
    display_name = data.get("displayName")
    if not display_name: raise HTTPException(status_code=400, detail="displayName is required")

    CONTAINER_TYPE_ID = os.environ.get("CONTAINER_TYPE_ID")
    payload = {
        "displayName":   display_name,
        "description":   data.get("description", ""),
        "containerTypeId": CONTAINER_TYPE_ID
    }
    response = session.post("https://graph.microsoft.com/beta/storage/fileStorage/containers", json=payload)
    if response.status_code not in (200, 201):
        try:
            detail = response.json()
            if isinstance(detail, dict) and detail.get('error', {}).get('innerError', {}).get('code') == 'speAccessDenied':
                raise HTTPException(
                    status_code=response.status_code,
                    detail={
                        'code': 'SPE_ACCESS_DENIED',
                        'message': 'SharePoint Embedded permissions insufficient for container creation',
                        'detail': str(detail),
                        'contactAdmin': True
                    }
                )
        except:
            pass
        raise HTTPException(status_code=response.status_code, detail=response.json())

    result = response.json()
    append_log("CREATE_CONTAINER", upn, display_name, f"TypeId: {CONTAINER_TYPE_ID}", "success")
    return result


@router.post("/createContainerType")
async def create_container_type(request: Request):
    """Create Container Type ID. GlobalAdmin only per spec."""
    from .rbac_utils import get_user_role, require_role
    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Global Admin can create Container Types.")

    data = await request.json()
    display_name = data.get("displayName")
    description = data.get("description", "")
    
    if not display_name:
        raise HTTPException(status_code=400, detail="displayName is required")
    
    session = get_graph_session()
    payload = {
        "displayName": display_name,
        "description": description
    }
    
    res = session.post("https://graph.microsoft.com/beta/storage/fileStorage/containerTypes", json=payload)
    if res.status_code not in (200, 201):
        raise HTTPException(status_code=res.status_code, detail=res.json())
    
    result = res.json()
    upn = request.headers.get("X-User-UPN", "").lower()
    append_log("CREATE_CONTAINER_TYPE", upn, display_name, f"TypeId: {result.get('containerTypeId')}", "success")
    return result


@router.delete("/container/{container_id}")
def delete_container(container_id: str, request: Request):
    """Delete a container. Restricted to Global Admin."""
    upn = request.headers.get("X-User-UPN", "").lower()
    session = get_graph_session()
    
    from .rbac_utils import get_user_role
    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Global Admin can delete containers.")

    session.patch(f"https://graph.microsoft.com/beta/storage/fileStorage/containers/{container_id}", json={"status": "inactive"})
    res = session.delete(f"https://graph.microsoft.com/beta/storage/fileStorage/containers/{container_id}")
    if res.status_code != 204:
        raise HTTPException(status_code=res.status_code, detail=res.text)

    append_log("DELETE_CONTAINER", upn, container_id, "", "success")
    return {"message": "Container deleted"}

@router.get("/container/{container_id}/storage")
def get_container_storage(container_id: str):
    session = get_graph_session()
    try:
        drive_res = session.get(f"https://graph.microsoft.com/v1.0/drives/{container_id}")
        if drive_res.status_code == 200:
            quota = drive_res.json().get("quota", {})
            return {
                "storageUsed":  quota.get("used", 0),
                "storageTotal": quota.get("total", 0),
                "fileCount":    quota.get("fileCount", 0),
            }
    except Exception: pass
    return {"storageUsed": 0, "storageTotal": 0, "fileCount": 0}

@router.get("/containerTypes")
def list_container_types():
    session = get_graph_session()
    res = session.get("https://graph.microsoft.com/beta/storage/fileStorage/containerTypes")
    if res.status_code != 200:
        return {"value": [{"containerTypeId": os.environ.get("CONTAINER_TYPE_ID"), "displayName": "Default Container Type"}]}
    return res.json()

@router.get("/container/{container_id}")
def get_container(container_id: str):
    session = get_graph_session()
    res = session.get(f"https://graph.microsoft.com/beta/storage/fileStorage/containers/{container_id}")
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.json())
    return res.json()

@router.post("/container/{container_id}/app-permissions")
async def assign_app_to_container(container_id: str, request: Request):
    """Assign app directly to specific container (GlobalAdmin only)."""
    from .rbac_utils import get_user_role
    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Only GlobalAdmin can assign app permissions to containers.")

    data = await request.json()
    app_id = data.get("appId")
    roles = data.get("roles", ["owner"])
    
    if not app_id:
        raise HTTPException(status_code=400, detail="appId required")
    if not isinstance(roles, list) or not roles:
        raise HTTPException(status_code=400, detail="roles must be non-empty array")
    
    session = get_graph_session()
    GRAPH_ROOT = "https://graph.microsoft.com/beta"
    url = f"{GRAPH_ROOT}/storage/fileStorage/containers/{container_id}/permissions"
    
    payload = {
        "roles": roles,
        "grantedToV2": {
            "application": {
                "id": app_id
            }
        }
    }
    
    res = session.post(url, json=payload)
    if res.status_code not in (200, 201):
        try:
            detail = res.json()
            # SPE error handling
            if isinstance(detail, dict) and detail.get('error', {}).get('innerError', {}).get('code') == 'speAccessDenied':
                raise HTTPException(
                    status_code=res.status_code,
                    detail={
                        'code': 'SPE_ACCESS_DENIED',
                        'message': f'SharePoint Embedded permissions insufficient for app {app_id} on container {container_id}',
                        'detail': str(detail),
                        'contactAdmin': True
                    }
                )
        except Exception:
            pass
        raise HTTPException(status_code=res.status_code, detail=res.json())
    
    upn = request.headers.get("X-User-UPN", "system").lower()
    append_log("ASSIGN_APP_CONTAINER_DIRECT", upn, container_id, f"appId: {app_id}, roles: {roles}", "success")
    return {
        "message": "App permission assigned successfully",
        "containerId": container_id,
        "appId": app_id,
        "roles": roles,
        "permission": res.json()
    }


@router.get("/metrics")
def get_metrics():
    session = get_graph_session()
    CONTAINER_TYPE_ID = os.environ.get("CONTAINER_TYPE_ID")
    containers_res = session.get(f"https://graph.microsoft.com/beta/storage/fileStorage/containers?$filter=containerTypeId eq {CONTAINER_TYPE_ID}&$select=id")
    users_res = session.get("https://graph.microsoft.com/v1.0/users?$count=true&$top=1", headers={"ConsistencyLevel": "eventual"})
    apps_res = session.get("https://graph.microsoft.com/v1.0/applications?$count=true&$top=1", headers={"ConsistencyLevel": "eventual"})

    containers = containers_res.json().get("value", []) if containers_res.status_code == 200 else []
    return {
        "containerCount":   len(containers),
        "totalStorageUsed": 0,
        "totalFiles":       0,
        "userCount":        users_res.json().get("@odata.count", 0) if users_res.status_code == 200 else 0,
        "appCount":         apps_res.json().get("@odata.count", 0) if apps_res.status_code == 200 else 0,
    }
