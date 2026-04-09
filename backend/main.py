import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import containers, apps, users, permissions, files, audit_logs, assignments, auth

app = FastAPI(title="SharePoint Embedded Enterprise Admin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])  # Auth endpoints
app.include_router(containers.router, prefix="/api", tags=["Containers"])
app.include_router(containers.router, prefix="/api/containers", tags=["Container Permissions"])  # New app permissions endpoint
app.include_router(apps.router, prefix="/api/apps", tags=["Apps"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(permissions.router, prefix="/api/permissions", tags=["Permissions"])
app.include_router(files.router, prefix="/api/files", tags=["Files"])
app.include_router(audit_logs.router, prefix="/api/audit-logs", tags=["Audit Logs"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["Assignments"])

@app.get("/")
def read_root():
    return {"message": "SharePoint Embedded Enterprise Admin API is running"}
