"""
Centralized assignment management.
Handles assigning containers/apps to UserAdmins (local store only).
GlobalAdmin only.
"""
from fastapi import APIRouter, HTTPException, Request
from routers.audit_logs import append_log
from routers.rbac_utils import get_user_role

router = APIRouter()


def _get_store():
    from routers.users import _read_role_store, _write_role_store
    return _read_role_store, _write_role_store


# ─────────────────────────────────────────────
# GET /api/assignments/{user_id}
# Returns the full assignment record for a user
# ─────────────────────────────────────────────
@router.get("/{user_id}")
def get_user_assignments(user_id: str, request: Request):
    if get_user_role(request) not in ["GlobalAdmin", "UserAdmin"]:
        raise HTTPException(status_code=403, detail="Permission Denied")
    read, _ = _get_store()
    store = read()
    data = store.get(user_id, {})
    return {
        "userId": user_id,
        "role": data.get("role", "NormalUser"),
        "assignedContainers": data.get("assignedContainers", []),
        "assignedApps": data.get("assignedApps", []),
    }


# ─────────────────────────────────────────────
# POST /api/assignments/{user_id}/containers
# Body: { containerId }
# Assigns a container to a UserAdmin
# ─────────────────────────────────────────────
@router.post("/{user_id}/containers")
async def assign_container(user_id: str, request: Request):
    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Only GlobalAdmin can assign containers to users")

    data = await request.json()
    container_id = data.get("containerId", "").strip()
    if not container_id:
        raise HTTPException(status_code=400, detail="containerId is required")

    read, write = _get_store()
    store = read()
    user_data = store.get(user_id, {"role": "NormalUser", "assignedContainers": [], "assignedApps": []})

    if container_id not in user_data.get("assignedContainers", []):
        user_data.setdefault("assignedContainers", []).append(container_id)
        store[user_id] = user_data
        write(store)

    append_log("ASSIGN_CONTAINER_TO_USER", "system", user_id, f"containerId: {container_id}", "success")
    return {"userId": user_id, "assignedContainers": user_data["assignedContainers"]}


# ─────────────────────────────────────────────
# DELETE /api/assignments/{user_id}/containers/{container_id}
# Removes a container assignment from a user
# ─────────────────────────────────────────────
@router.delete("/{user_id}/containers/{container_id}")
def remove_container_assignment(user_id: str, container_id: str, request: Request):
    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Only GlobalAdmin can remove container assignments")

    read, write = _get_store()
    store = read()
    user_data = store.get(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found in local store")

    containers = user_data.get("assignedContainers", [])
    if container_id not in containers:
        raise HTTPException(status_code=404, detail="Container not assigned to this user")

    user_data["assignedContainers"] = [c for c in containers if c != container_id]
    store[user_id] = user_data
    write(store)

    append_log("REMOVE_CONTAINER_FROM_USER", "system", user_id, f"containerId: {container_id}", "success")
    return {"userId": user_id, "assignedContainers": user_data["assignedContainers"]}


# ─────────────────────────────────────────────
# POST /api/assignments/{user_id}/apps
# Body: { appId }
# Assigns an app to a UserAdmin
# ─────────────────────────────────────────────
@router.post("/{user_id}/apps")
async def assign_app(user_id: str, request: Request):
    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Only GlobalAdmin can assign apps to users")

    data = await request.json()
    app_id = data.get("appId", "").strip()
    if not app_id:
        raise HTTPException(status_code=400, detail="appId is required")

    read, write = _get_store()
    store = read()
    user_data = store.get(user_id, {"role": "NormalUser", "assignedContainers": [], "assignedApps": []})

    if app_id not in user_data.get("assignedApps", []):
        user_data.setdefault("assignedApps", []).append(app_id)
        store[user_id] = user_data
        write(store)

    append_log("ASSIGN_APP_TO_USER", "system", user_id, f"appId: {app_id}", "success")
    return {"userId": user_id, "assignedApps": user_data["assignedApps"]}


# ─────────────────────────────────────────────
# DELETE /api/assignments/{user_id}/apps/{app_id}
# ─────────────────────────────────────────────
@router.delete("/{user_id}/apps/{app_id}")
def remove_app_assignment(user_id: str, app_id: str, request: Request):
    if get_user_role(request) != "GlobalAdmin":
        raise HTTPException(status_code=403, detail="Only GlobalAdmin can remove app assignments")

    read, write = _get_store()
    store = read()
    user_data = store.get(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found in local store")

    apps = user_data.get("assignedApps", [])
    if app_id not in apps:
        raise HTTPException(status_code=404, detail="App not assigned to this user")

    user_data["assignedApps"] = [a for a in apps if a != app_id]
    store[user_id] = user_data
    write(store)

    append_log("REMOVE_APP_FROM_USER", "system", user_id, f"appId: {app_id}", "success")
    return {"userId": user_id, "assignedApps": user_data["assignedApps"]}
