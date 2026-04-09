"""
Role-Based Access Control Middleware
Protects API endpoints based on user roles
"""

from fastapi import HTTPException, Header
from typing import List
import mysql.connector
import os

def get_db():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "staunchtech_dms"),
    )

def require_role(allowed_roles: List[str]):
    """
    Decorator to protect endpoints by role.
    Usage: @require_role(["GLOBAL_ADMIN", "USER_ADMIN"])
    """
    def decorator(func):
        async def wrapper(*args, authorization: str = Header(None), **kwargs):
            if not authorization:
                raise HTTPException(status_code=401, detail="Not authenticated")
            
            try:
                token = authorization.replace("Bearer ", "")
                user_id = int(token)
                
                db = get_db()
                cursor = db.cursor(dictionary=True)
                try:
                    cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
                    user = cursor.fetchone()
                    
                    if not user:
                        raise HTTPException(status_code=401, detail="User not found")
                    
                    # Normalize role names for comparison
                    user_role = user["role"]
                    role_map = {
                        "GlobalAdmin": "GLOBAL_ADMIN",
                        "UserAdmin": "USER_ADMIN",
                        "NormalUser": "USER",
                        "User": "USER"
                    }
                    normalized_role = role_map.get(user_role, user_role)
                    
                    if normalized_role not in allowed_roles:
                        raise HTTPException(
                            status_code=403, 
                            detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
                        )
                    
                    return await func(*args, **kwargs)
                finally:
                    cursor.close()
                    db.close()
            except ValueError:
                raise HTTPException(status_code=401, detail="Invalid token")
        
        return wrapper
    return decorator


def require_global_admin(func):
    """Shortcut decorator for GLOBAL_ADMIN only endpoints."""
    return require_role(["GLOBAL_ADMIN", "GlobalAdmin"])(func)


def require_admin(func):
    """Shortcut decorator for GLOBAL_ADMIN or USER_ADMIN endpoints."""
    return require_role(["GLOBAL_ADMIN", "USER_ADMIN", "GlobalAdmin", "UserAdmin"])(func)
