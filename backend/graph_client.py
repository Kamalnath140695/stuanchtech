import os
import msal
import requests
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

CLIENT_ID = os.environ.get("API_ENTRA_APP_CLIENT_ID")
CLIENT_SECRET = os.environ.get("API_ENTRA_APP_CLIENT_SECRET")
AUTHORITY = os.environ.get("API_ENTRA_APP_AUTHORITY")

def get_obo_token(user_token: str) -> str:
    app = msal.ConfidentialClientApplication(
        CLIENT_ID,
        authority=AUTHORITY,
        client_credential=CLIENT_SECRET
    )
    result = app.acquire_token_on_behalf_of(
        user_assertion=user_token,
        scopes=["https://graph.microsoft.com/.default"]
    )
    if "access_token" in result:
        return result["access_token"]
    raise HTTPException(status_code=400, detail=f"Failed to acquire OBO token: {result.get('error_description', result)}")

def get_app_only_token() -> str:
    app = msal.ConfidentialClientApplication(
        CLIENT_ID,
        authority=AUTHORITY,
        client_credential=CLIENT_SECRET
    )
    result = app.acquire_token_silent(["https://graph.microsoft.com/.default"], account=None)
    if not result:
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        
    if "access_token" in result:
        return result["access_token"]
    raise Exception(f"Failed to acquire token: {result.get('error_description')}")

def get_graph_session(user_token: str = None):
    token = get_obo_token(user_token) if user_token else get_app_only_token()
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })
    return session
