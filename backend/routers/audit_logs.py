from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
import json, os

router = APIRouter()

LOG_FILE = os.path.join(os.path.dirname(__file__), "../audit_logs.json")

def _read_logs():
    if not os.path.exists(LOG_FILE):
        return []
    with open(LOG_FILE, "r") as f:
        try:
            return json.load(f)
        except Exception:
            return []

def _write_logs(logs):
    with open(LOG_FILE, "w") as f:
        json.dump(logs[-500:], f, indent=2)  # keep last 500

def append_log(action: str, actor: str, target: str, details: str = "", status: str = "success"):
    logs = _read_logs()
    logs.append({
        "id": len(logs) + 1,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "actor": actor,
        "target": target,
        "details": details,
        "status": status
    })
    _write_logs(logs)

@router.get("")
@router.get("/")
def list_audit_logs(limit: int = 100):
    logs = _read_logs()
    return list(reversed(logs[-limit:]))

@router.post("")
@router.post("/")
async def add_audit_log(request: Request):
    data = await request.json()
    append_log(
        action=data.get("action", "UNKNOWN"),
        actor=data.get("actor", "system"),
        target=data.get("target", ""),
        details=data.get("details", ""),
        status=data.get("status", "success")
    )
    return {"message": "logged"}

@router.delete("")
@router.delete("/")
def clear_audit_logs():
    _write_logs([])
    return {"message": "cleared"}
