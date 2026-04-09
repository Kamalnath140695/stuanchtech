from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from graph_client import get_graph_session
from .rbac_utils import check_container_permission

router = APIRouter()

@router.get("/my-recent")
def my_recent_files(request: Request):
    # GlobalAdmin bypasses container permission check
    from .rbac_utils import get_user_role
    if get_user_role(request) == "GlobalAdmin":
        return {"files": []}
    
    upn = request.headers.get("X-User-UPN", "").strip().lower()
    if not upn:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"files": []}

@router.get("/list")
def list_files(containerId: str, request: Request, itemId: str = "root"):
    from .rbac_utils import get_user_role
    role = get_user_role(request)
    if role == "GlobalAdmin":
        session = get_graph_session()
        url = f"https://graph.microsoft.com/v1.0/drives/{containerId}/items/{itemId}/children"
        res = session.get(url)
        if res.status_code != 200:
            # Handle SPE errors
            try:
                detail = res.json()
                if isinstance(detail, dict) and detail.get('error', {}).get('innerError', {}).get('code') == 'speAccessDenied':
                    raise HTTPException(
                        status_code=403,
                        detail={
                            'code': 'SPE_ACCESS_DENIED',
                            'message': 'GlobalAdmin SPE access issue - check Sites.FullControl.All',
                            'detail': str(detail),
                            'contactAdmin': True
                        }
                    )
            except:
                pass
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return res.json().get("value", [])
    
    # Regular users need explicit permission
    check_container_permission(containerId, request, ["reader", "read", "writer", "write", "owner", "manager"])
    
    session = get_graph_session()
    url = f"https://graph.microsoft.com/v1.0/drives/{containerId}/items/{itemId}/children"
    res = session.get(url)
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.json())
    return res.json().get("value", [])

@router.post("/upload")
async def upload_file(request: Request, containerId: str = Form(...), parentId: str = Form("root"), file: UploadFile = File(...)):
    # Requires 'writer' or higher
    check_container_permission(containerId, request, ["writer", "write", "owner", "manager"])
    
    session = get_graph_session()
    file_content = await file.read()
    url = f"https://graph.microsoft.com/v1.0/drives/{containerId}/items/{parentId}:/{file.filename}:/content"
    headers = {**dict(session.headers), "Content-Type": "application/octet-stream"}
    res = session.put(url, headers=headers, data=file_content)
    if res.status_code not in (200, 201):
        raise HTTPException(status_code=res.status_code, detail=res.json())
    return res.json()

@router.post("/folder")
async def create_folder(request: Request):
    data = await request.json()
    container_id = data.get("containerId")
    parent_id = data.get("parentId", "root")
    name = data.get("name")
    if not container_id or not name:
        raise HTTPException(status_code=400, detail="containerId and name are required")
        
    # Requires 'writer' or higher
    check_container_permission(container_id, request, ["writer", "write", "owner", "manager"])
    
    session = get_graph_session()
    url = f"https://graph.microsoft.com/v1.0/drives/{container_id}/items/{parent_id}/children"
    payload = {"name": name, "folder": {}, "@microsoft.graph.conflictBehavior": "rename"}
    res = session.post(url, json=payload)
    if res.status_code not in (200, 201):
        raise HTTPException(status_code=res.status_code, detail=res.json())
    return res.json()

@router.delete("/delete")
def delete_file(containerId: str, itemId: str, request: Request):
    if not containerId or not itemId:
        raise HTTPException(status_code=400, detail="containerId and itemId are required")
        
    # Requires 'owner' or higher
    check_container_permission(containerId, request, ["owner", "manager"])
    
    session = get_graph_session()
    url = f"https://graph.microsoft.com/v1.0/drives/{containerId}/items/{itemId}"
    res = session.delete(url)
    if res.status_code != 204:
        raise HTTPException(status_code=res.status_code, detail=res.json())
    return {"message": "Deleted"}
