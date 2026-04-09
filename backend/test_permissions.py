"""
Diagnostic script — run from backend/ directory:
  python test_permissions.py <user-upn>
Example:
  python test_permissions.py john@contoso.onmicrosoft.com
"""
import sys
import os
import json
import msal
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

CLIENT_ID     = os.environ["API_ENTRA_APP_CLIENT_ID"]
CLIENT_SECRET = os.environ["API_ENTRA_APP_CLIENT_SECRET"]
AUTHORITY     = os.environ["API_ENTRA_APP_AUTHORITY"]
CONTAINER_TYPE_ID = os.environ.get("CONTAINER_TYPE_ID", "")

UPN = sys.argv[1] if len(sys.argv) > 1 else "test@example.com"

print(f"\n{'='*60}")
print(f" CLIENT_ID : {CLIENT_ID}")
print(f" AUTHORITY : {AUTHORITY}")
print(f" UPN       : {UPN}")
print(f"{'='*60}\n")

# 1. Get app-only token
app = msal.ConfidentialClientApplication(CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET)
token_result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
if "access_token" not in token_result:
    print(f"[ERROR] Token error: {token_result.get('error_description')}")
    sys.exit(1)

token = token_result["access_token"]
print(f"[OK] Got access token (first 20 chars): {token[:20]}...\n")

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type":  "application/json",
}

# 2. List containers
print("-- Listing containers ------------------------------------------")
list_url = f"https://graph.microsoft.com/beta/storage/fileStorage/containers?$filter=containerTypeId eq {CONTAINER_TYPE_ID}"
r = requests.get(list_url, headers=headers)
print(f"   Status : {r.status_code}")
if r.status_code != 200:
    print(f"   Response: {r.text}")
    sys.exit(1)

containers = r.json().get("value", [])
if not containers:
    print("   [WARN] No containers found - cannot test permission assignment")
    sys.exit(0)

container_id = containers[0]["id"]
container_name = containers[0].get("displayName", "?")
print(f"   Using container: {container_name!r}  id={container_id!r}\n")


# 3. Try POST permission
print("-- POSTing permission ------------------------------------------")
perm_url = f"https://graph.microsoft.com/beta/storage/fileStorage/containers/{container_id}/permissions"
payload = {
    "roles": ["reader"],
    "grantedToV2": {
        "user": {
            "userPrincipalName": UPN
        }
    }
}
print(f"   URL    : {perm_url}")
print(f"   Payload:\n{json.dumps(payload, indent=4)}")
r2 = requests.post(perm_url, headers=headers, json=payload)
print(f"\n   Status  : {r2.status_code}")
try:
    resp_json = r2.json()
    print(f"   Response:\n{json.dumps(resp_json, indent=4)}")
except Exception:
    print(f"   Response: {r2.text}")

# 4. Also try with URL-encoded container ID
from urllib.parse import quote
encoded_id = quote(container_id, safe="")
if encoded_id != container_id:
    print(f"\n-- Retrying with URL-encoded container ID --")
    perm_url2 = f"https://graph.microsoft.com/beta/storage/fileStorage/containers/{encoded_id}/permissions"
    print(f"   URL: {perm_url2}")
    r3 = requests.post(perm_url2, headers=headers, json=payload)
    print(f"   Status  : {r3.status_code}")
    try:
        print(f"   Response:\n{json.dumps(r3.json(), indent=4)}")
    except Exception:
        print(f"   Response: {r3.text}")

print(f"\n{'='*60}\n")
