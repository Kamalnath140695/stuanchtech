from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os

from fastapi import APIRouter, HTTPException, Request

from graph_client import get_graph_session
from routers.audit_logs import append_log

router = APIRouter()

GRAPH_ROOT = "https://graph.microsoft.com/v1.0"

CONTAINER_TYPE_APP_PERMISSION_ORDER = [
    "readContent",
    "writeContent",
    "manageContent",
    "create",
    "delete",
    "read",
    "write",
    "enumeratePermissions",
    "addPermissions",
    "updatePermissions",
    "deletePermissions",
    "deleteOwnPermission",
    "managePermissions",
]

DELEGATED_PERMISSION_BY_ROLE = {
    "reader": ["readContent"],
    "writer": ["readContent", "writeContent"],
    "manager": ["readContent", "writeContent", "managePermissions"],
    "owner": ["full"],
}

APPLICATION_PERMISSION_BY_ROLE = {
    "reader": ["readContent"],
    "writer": ["readContent", "writeContent"],
    "manager": ["readContent", "writeContent", "managePermissions"],
    "owner": ["full"],
}


def _require_container_type_id() -> str:
    container_type_id = os.environ.get("CONTAINER_TYPE_ID", "").strip()
    if not container_type_id:
        raise HTTPException(status_code=500, detail="CONTAINER_TYPE_ID is not configured in the backend environment.")
    return container_type_id


def _resolve_app(session, app_id: str = "", app_object_id: str = "") -> tuple[str, str]:
    resolved_app_id = app_id.strip()
    app_name = ""

    if app_object_id:
        app_res = session.get(
            f"{GRAPH_ROOT}/applications/{app_object_id}?$select=appId,displayName"
        )
        if app_res.status_code == 200:
            app_body = app_res.json()
            resolved_app_id = app_body.get("appId", resolved_app_id)
            app_name = app_body.get("displayName", "")
        elif not resolved_app_id:
            raise HTTPException(status_code=app_res.status_code, detail=app_res.text)

    if not resolved_app_id:
        raise HTTPException(status_code=400, detail="appId or appObjectId is required")

    if not app_name:
        lookup_res = session.get(
            f"{GRAPH_ROOT}/applications"
            f"?$filter=appId eq '{resolved_app_id}'&$select=appId,displayName&$top=1"
        )
        if lookup_res.status_code == 200 and lookup_res.json().get("value"):
            app_name = lookup_res.json()["value"][0].get("displayName", "")

    return resolved_app_id, app_name


def _merge_permissions(existing: list[str], requested: list[str]) -> list[str]:
    values = {value for value in (existing or []) + (requested or []) if value and value != "none"}
    if not values:
        return ["none"]
    if "full" in values:
        return ["full"]
    return [value for value in CONTAINER_TYPE_APP_PERMISSION_ORDER if value in values]


def _role_from_app_permissions(permissions: list[str]) -> str:
    values = set(permissions or [])
    if "full" in values or "managePermissions" in values:
        return "owner"
    if values.intersection({"writeContent", "write", "manageContent", "create", "delete"}):
        return "writer"
    return "reader"


def _upsert_container_type_app_grant(session, app_id: str, role: str, include_application_permissions: bool):
    container_type_id = _require_container_type_id()
    grant_url = (
        f"{GRAPH_ROOT}/storage/fileStorage/containerTypeRegistrations/"
        f"{container_type_id}/applicationPermissionGrants/{app_id}"
    )

    existing_delegated = []
    existing_application = []
    existing_res = session.get(grant_url)
    if existing_res.status_code == 200:
        existing_body = existing_res.json()
        existing_delegated = existing_body.get("delegatedPermissions") or []
        existing_application = existing_body.get("applicationPermissions") or []
    elif existing_res.status_code != 404:
        raise HTTPException(status_code=existing_res.status_code, detail=existing_res.text)

    payload = {
        "delegatedPermissions": _merge_permissions(
            existing_delegated,
            DELEGATED_PERMISSION_BY_ROLE.get(role, []),
        ),
        "applicationPermissions": _merge_permissions(
            existing_application,
            APPLICATION_PERMISSION_BY_ROLE.get(role, []) if include_application_permissions else [],
        ),
    }

    res = session.put(grant_url, json=payload)
    if res.status_code not in (200, 201):
        try:
            detail = res.json()
        except Exception:
            detail = res.text
        raise HTTPException(status_code=res.status_code, detail=detail)

    return res.json()


@router.get("")
@router.get("/")
def list_apps(request: Request):
    from .rbac_utils import get_user_role

    role = get_user_role(request)
    session = get_graph_session()
    response = session.get(
        f"{GRAPH_ROOT}/applications"
        "?$select=id,appId,displayName,createdDateTime,signInAudience&$top=100"
    )
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

    all_apps = response.json().get("value", [])
    if role == "GlobalAdmin":
        return all_apps
    return all_apps


@router.post("")
@router.post("/")
async def create_app(request: Request):
    from .rbac_utils import get_user_role

    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Global Admin can create applications.")

    data = await request.json()
    display_name = data.get("displayName")
    if not display_name:
        raise HTTPException(status_code=400, detail="displayName is required")

    session = get_graph_session()
    app_res = session.post(
        f"{GRAPH_ROOT}/applications",
        json={"displayName": display_name, "signInAudience": "AzureADMyOrg"},
    )
    if app_res.status_code not in (200, 201):
        raise HTTPException(status_code=app_res.status_code, detail=app_res.json())
    app = app_res.json()

    sp_res = session.post(
        f"{GRAPH_ROOT}/servicePrincipals",
        json={"appId": app["appId"]},
    )
    sp = sp_res.json() if sp_res.status_code in (200, 201) else None
    append_log("CREATE_APP", "system", display_name, f"appId: {app['appId']}", "success")
    return {"app": app, "servicePrincipal": sp}


@router.delete("")
@router.delete("/")
def delete_app(appObjectId: str, request: Request):
    from .rbac_utils import get_user_role

    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Global Admin can delete applications.")

    if not appObjectId:
        raise HTTPException(status_code=400, detail="appObjectId is required")
    session = get_graph_session()
    res = session.delete(f"{GRAPH_ROOT}/applications/{appObjectId}")
    if res.status_code != 204:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    append_log("DELETE_APP", "system", appObjectId, "", "success")
    return {"message": "Deleted"}


@router.post("/container-permission")
async def assign_container_permission(request: Request):
    from .rbac_utils import get_user_role

    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Global Admin can assign apps to containers.")

    data = await request.json()
    container_id = data.get("containerId")
    app_id = data.get("appId", "").strip()
    app_object_id = data.get("appObjectId", "").strip()
    role = data.get("role", "").strip().lower()
    user_upn = data.get("userPrincipalName", "").strip().lower()

    if not container_id:
        raise HTTPException(status_code=400, detail="containerId is required")
    if not app_id and not app_object_id:
        raise HTTPException(status_code=400, detail="appId or appObjectId is required")
    if role not in {"owner", "manager", "writer", "reader"}:
        raise HTTPException(status_code=400, detail="role must be owner, manager, writer, or reader")

    session = get_graph_session()
    resolved_app_id, resolved_app_name = _resolve_app(session, app_id, app_object_id)

    # App access in SharePoint Embedded is granted on the container type registration.
    app_grant = _upsert_container_type_app_grant(
        session,
        resolved_app_id,
        role,
        include_application_permissions=not bool(user_upn),
    )

    user_permission = None
    if user_upn:
        permission_url = f"{GRAPH_ROOT}/storage/fileStorage/containers/{container_id}/permissions"
        permission_payload = {
            "roles": [role],
            "grantedToV2": {
                "user": {
                    "userPrincipalName": user_upn
                }
            }
        }

        print(f"[assign] POST {permission_url}")
        print(f"[assign] payload: {json.dumps(permission_payload, indent=2)}")

        permission_res = session.post(permission_url, json=permission_payload)
        print(f"[assign] Graph status: {permission_res.status_code}")
        print(f"[assign] Graph response: {permission_res.text[:500]}")

        if permission_res.status_code not in (200, 201):
            try:
                err_body = permission_res.json()
                graph_msg = err_body.get("error", {}).get("message", str(err_body))
            except Exception:
                graph_msg = permission_res.text
            raise HTTPException(status_code=permission_res.status_code, detail=graph_msg)

        user_permission = permission_res.json()

    append_log(
        "ASSIGN_APP_CONTAINER",
        "system",
        container_id,
        f"AppId: {resolved_app_id}, UPN: {user_upn or 'none'}, role: {role}",
        "success",
    )
    return {
        "containerId": container_id,
        "appId": resolved_app_id,
        "appDisplayName": resolved_app_name,
        "role": role,
        "appGrant": app_grant,
        "userPermission": user_permission,
    }


@router.get("/assignments-summary")
def get_assignments_summary():
    session = get_graph_session()
    container_type_id = os.environ.get("CONTAINER_TYPE_ID", "").strip()
    if not container_type_id:
        return {"assignedAppIds": [], "assignedUPNs": []}

    assigned_app_ids = set()
    app_grants_res = session.get(
        f"{GRAPH_ROOT}/storage/fileStorage/containerTypeRegistrations/"
        f"{container_type_id}/applicationPermissionGrants?$select=appId"
    )
    if app_grants_res.status_code == 200:
        for grant in app_grants_res.json().get("value", []):
            granted_app_id = grant.get("appId")
            if granted_app_id:
                assigned_app_ids.add(granted_app_id)

    containers_res = session.get(
        f"{GRAPH_ROOT}/storage/fileStorage/containers"
        f"?$filter=containerTypeId eq {container_type_id}&$select=id"
    )
    if containers_res.status_code != 200:
        return {"assignedAppIds": list(assigned_app_ids), "assignedUPNs": []}

    containers = containers_res.json().get("value", [])
    if not containers:
        return {"assignedAppIds": list(assigned_app_ids), "assignedUPNs": []}

    upns = set()

    def fetch_perms(cid):
        res = session.get(f"{GRAPH_ROOT}/storage/fileStorage/containers/{cid}/permissions")
        if res.status_code == 200:
            return res.json().get("value", [])
        return []

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(fetch_perms, container["id"]) for container in containers]
        for future in as_completed(futures):
            for permission in future.result():
                upn = permission.get("grantedToV2", {}).get("user", {}).get("userPrincipalName")
                if upn:
                    upns.add(upn.lower())

    return {
        "assignedAppIds": list(assigned_app_ids),
        "assignedUPNs": list(upns),
    }


@router.get("/{app_id}/containers")
def get_app_containers(app_id: str, upn: str = None):
    session = get_graph_session()
    container_type_id = _require_container_type_id()

    app_grant_res = session.get(
        f"{GRAPH_ROOT}/storage/fileStorage/containerTypeRegistrations/"
        f"{container_type_id}/applicationPermissionGrants/{app_id}"
    )
    if app_grant_res.status_code != 200:
        return []

    app_grant = app_grant_res.json()
    app_permissions = (app_grant.get("applicationPermissions") or []) + (app_grant.get("delegatedPermissions") or [])
    application_role = _role_from_app_permissions(app_permissions)

    containers_res = session.get(
        f"{GRAPH_ROOT}/storage/fileStorage/containers"
        f"?$filter=containerTypeId eq {container_type_id}&$select=id,displayName,createdDateTime"
    )
    if containers_res.status_code != 200:
        raise HTTPException(status_code=containers_res.status_code, detail=containers_res.json())

    containers_list = containers_res.json().get("value", [])
    if not containers_list:
        return []

    if upn:
        linked = []

        def check_container(container):
            perm_res = session.get(
                f"{GRAPH_ROOT}/storage/fileStorage/containers/{container['id']}/permissions"
            )
            if perm_res.status_code == 200:
                for permission in perm_res.json().get("value", []):
                    granted_upn = permission.get("grantedToV2", {}).get("user", {}).get("userPrincipalName", "").lower()
                    if granted_upn == upn.lower():
                        return {
                            **container,
                            "role": permission.get("roles", ["reader"])[0],
                            "permissionId": permission["id"],
                            "grantedVia": "user",
                        }
            return None

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(check_container, container) for container in containers_list]
            for future in as_completed(futures):
                result = future.result()
                if result:
                    linked.append(result)

        if linked:
            return linked

    return [
        {
            **container,
            "role": application_role,
            "permissionId": app_id,
            "grantedVia": "application",
        }
        for container in containers_list
    ]
