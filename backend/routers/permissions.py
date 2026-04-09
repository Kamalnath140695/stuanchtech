import os
import mysql.connector
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from .auth import get_current_user
from .rbac_utils import has_permission

router = APIRouter()

class PermissionCreate(BaseModel):
    permission_type: str = Field(..., example="container")
    permission_action: str = Field(..., example="create")
    resource_id: Optional[str] = Field(None, example="container123")

class PermissionResponse(BaseModel):
    id: int
    user_id: int
    permission_type: str
    permission_action: str
    resource_id: Optional[str]
    created_at: datetime

@router.post("/permissions", response_model=PermissionResponse)
async def create_permission(permission: PermissionCreate, user=Depends(get_current_user)):
    """Create a new permission for a user"""
    if not has_permission(user, "user", "create"):
        raise HTTPException(status_code=403, detail="Not authorized to create permissions")

    db = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "staunchtech_dms"),
    )
    cursor = db.cursor()
    try:
        cursor.execute("""
            INSERT INTO permissions (user_id, permission_type, permission_action, resource_id)
            VALUES (%s, %s, %s, %s)
        """, (user["id"], permission.permission_type, permission.permission_action, permission.resource_id))
        db.commit()
        permission_id = cursor.lastrowid

        cursor.execute("SELECT * FROM permissions WHERE id = %s", (permission_id,))
        result = cursor.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Permission not found")

        return {
            "id": result[0],
            "user_id": result[1],
            "permission_type": result[2],
            "permission_action": result[3],
            "resource_id": result[4],
            "created_at": result[5]
        }
    finally:
        cursor.close()
        db.close()

@router.get("/permissions", response_model=List[PermissionResponse])
async def get_permissions(user=Depends(get_current_user)):
    """Get all permissions for the current user"""
    if not has_permission(user, "user", "read"):
        raise HTTPException(status_code=403, detail="Not authorized to view permissions")

    db = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "staunchtech_dms"),
    )
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM permissions WHERE user_id = %s", (user["id"],))
        results = cursor.fetchall()

        return [{
            "id": row["id"],
            "user_id": row["user_id"],
            "permission_type": row["permission_type"],
            "permission_action": row["permission_action"],
            "resource_id": row["resource_id"],
            "created_at": row["created_at"]
        } for row in results]
    finally:
        cursor.close()
        db.close()

@router.delete("/permissions/{permission_id}")
async def delete_permission(permission_id: int, user=Depends(get_current_user)):
    """Delete a permission"""
    if not has_permission(user, "user", "delete"):
        raise HTTPException(status_code=403, detail="Not authorized to delete permissions")

    db = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "staunchtech_dms"),
    )
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM permissions WHERE id = %s AND user_id = %s", (permission_id, user["id"]))
        db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Permission not found")
        return {"message": "Permission deleted successfully"}
    finally:
        cursor.close()
        db.close()