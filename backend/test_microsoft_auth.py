"""
Test file for Microsoft Login Flow Implementation
Tests all scenarios: existing user, new user, admin detection, etc.
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/auth"

# Test data
TEST_ID_TOKEN = """eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiI0NGU1YTVlOC04NDdmLTQ2NWQtYTY4YS0zYTUxNmFlZmJlOTciLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vY29tbW9uL3YyLjAvIiwiaWF0IjoxNjk5NTAwMDAwLCJuYmYiOjE2OTk1MDAwMDAsImV4cCI6MTY5OTUwMzYwMCwiYWlvIjoiQVRRQXkvOFRBQUFBQWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhQSIsImFtciI6WyJwd2QiLCJtZmEiXSwiYXBwX2Rpc3BsYXluYW1lIjoiU3RhdW5jaFRlY2giLCJhcHBpZCI6IjQ0ZTVhNWU4LTg0N2YtNDY1ZC1hNjhhLTNhNTE2YWVmYmU5NyIsImFwcGlkYWNyIjoiMCIsImZhbWlseV9uYW1lIjoiRG9lIiwiZ2l2ZW5fbmFtZSI6IkpvaG4iLCJpcGFkZHIiOiIxOTIuMTY4LjEuMSIsIm5hbWUiOiJKb2huIERvZSIsIm9pZCI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTEyMzQ1Njc4OTAxMiIsInBsYXRmIjoiMyIsInB1aWQiOiIxMDAwMzlGRkE5MjY2RjQ1IiwicmgiOiIwLkFWMEFfdjBaVjBGRjBFMzBSMEFBQUFBQUFBQUF3QUFBQUFBQUFBQU1BQS4iLCJzY3AiOiJEaXJlY3RvcnkuUmVhZC5BbGwgVXNlci5SZWFkIiwic2lnbmluX3N0YXRlIjoibWZhX2NvbXBsZXRlZCIsInN1YiI6IjNzMjFVdzBYUTBzUzd1N1ZzMjFVdzBYUTBzUzd1N1ZzMjFVdzBYUTBzUzd1N1YiLCJ0aWQiOiI3MmY5ODhiZi04NmYxLTQxYWYtOTFlMC1mMmU5YzVmZjU0MzAiLCJ1bmlxdWVfbmFtZSI6ImpvaG5AZXhhbXBsZS5jb20iLCJ1cG4iOiJqb2huQGV4YW1wbGUuY29tIiwidXRpIjoiMTIzNDU2Nzg5MDEyMzQ1NiIsInZlciI6IjEuMCIsIndpZHMiOlsiNjJlOTAzOTQtNjlmNS00MjM3LTkxOTAtMDEyMTc3MTQ1ZTEwIl0sImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSJ9.signature"""

TEST_ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy5taWNyb3NvZnQuY29tLzcyZjk4OGJmLTg2ZjEtNDFhZi05MWUwLWYyZTljNWZmNTQzMC92Mi4wLyIsImlhdCI6MTY5OTUwMDAwMCwibmJmIjoxNjk5NTAwMDAwLCJleHAiOjE2OTk1MDM2MDAsImFjY2Vzc1BhdHRlcm4iOiJEaXJlY3RvcnkuUmVhZC5BbGwiLCJhY3JzIjoiYXJuOjEiLCJhbXIiOlsicHdkIiwibWZhIl0sImFwcF9kaXNwbGF5bmFtZSI6IlN0YXVuY2hUZWNoIiwiYXBwaWQiOiI0NGU1YTVlOC04NDdmLTQ2NWQtYTY4YS0zYTUxNmFlZmJlOTciLCJhcHBpZGFjciI6IjAiLCJmYW1pbHlfbmFtZSI6IkRvZSIsImdpdmVuX25hbWUiOiJKb2huIiwiaXBhZGRyIjoiMTkyLjE2OC4xLjEiLCJuYW1lIjoiSm9obiBEb2UiLCJvaWQiOiIxMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODkwMTIiLCJwbGF0ZiI6IjMiLCJwdWlkIjoiMTAwMDAzOUZGQTkyNjZGNDUiLCJyaCI6IjAuQVYwQV92MFpWMEZGMEUzMFIwQUFBQUFBQUFBd0FBQUFBQUFBQUFNQUFBQUFBQUFBQU1BQS4iLCJzY3AiOiJEaXJlY3RvcnkuUmVhZC5BbGwgVXNlci5SZWFkIiwic2lnbmluZ19zdGF0ZSI6Im1mYV9jb21wbGV0ZWQiLCJzdWIiOiIzczIxVXcwWFEwc1M3dTdWczIxVXcwWFEwc1M3dTdWczIxVXcwWFEwc1M3dTdWIiwidGlkIjoiNzJmOTg4YmYtODZmMS00MWFmLTkxZTAtZjJlOWM1ZmY1NDMwIiwidW5pcXVlX25hbWUiOiJqb2huQGV4YW1wbGUuY29tIiwidXBuIjoiam9obkBleGFtcGxlLmNvbSIsInV0aSI6IjEyMzQ1Njc4OTAxMjM0NTYiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbIjYyZTkwMzk0LTY5ZjUtNDIzNy05MTkwLTAxMjE3NzE0NWUxMCJdLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20ifQ.signature"

def test_microsoft_auth_new_user():
    """Test: New user login (non-admin)"""
    print("\n" + "="*60)
    print("TEST 1: New User Login (Non-Admin)")
    print("="*60)
    
    payload = {
        "idToken": TEST_ID_TOKEN,
        "accessToken": TEST_ACCESS_TOKEN
    }
    
    try:
        response = requests.post(f"{BASE_URL}/microsoft", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            assert data["email"] == "john@example.com"
            assert data["role"] in ["GlobalAdmin", "PendingApproval"]
            assert data["auth_provider"] == "microsoft"
            print("✅ TEST PASSED")
        else:
            print("❌ TEST FAILED")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

def test_microsoft_auth_existing_user():
    """Test: Existing user login"""
    print("\n" + "="*60)
    print("TEST 2: Existing User Login")
    print("="*60)
    
    payload = {
        "idToken": TEST_ID_TOKEN,
        "accessToken": TEST_ACCESS_TOKEN
    }
    
    try:
        # First call creates user
        response1 = requests.post(f"{BASE_URL}/microsoft", json=payload)
        print(f"First Call Status: {response1.status_code}")
        
        # Second call should return existing user
        response2 = requests.post(f"{BASE_URL}/microsoft", json=payload)
        print(f"Second Call Status: {response2.status_code}")
        print(f"Response: {json.dumps(response2.json(), indent=2)}")
        
        if response2.status_code == 200:
            data = response2.json()
            assert data["email"] == "john@example.com"
            print("✅ TEST PASSED - User returned from database")
        else:
            print("❌ TEST FAILED")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

def test_email_login():
    """Test: Email/Password login"""
    print("\n" + "="*60)
    print("TEST 3: Email/Password Login")
    print("="*60)
    
    payload = {
        "email": "test@example.com",
        "password": "TestPassword123!"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code in [200, 401]:
            print("✅ TEST PASSED - Endpoint working")
        else:
            print("❌ TEST FAILED")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

def test_email_register():
    """Test: Email/Password registration"""
    print("\n" + "="*60)
    print("TEST 4: Email/Password Registration")
    print("="*60)
    
    payload = {
        "name": "Test User",
        "email": f"testuser_{datetime.now().timestamp()}@example.com",
        "password": "TestPassword123!"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/register", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert data["email"] == payload["email"]
            print("✅ TEST PASSED")
        else:
            print("❌ TEST FAILED")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

def test_invalid_token():
    """Test: Invalid token handling"""
    print("\n" + "="*60)
    print("TEST 5: Invalid Token Handling")
    print("="*60)
    
    payload = {
        "idToken": "invalid_token",
        "accessToken": "invalid_token"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/microsoft", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 400:
            print("✅ TEST PASSED - Invalid token rejected")
        else:
            print("❌ TEST FAILED")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("MICROSOFT LOGIN FLOW - TEST SUITE")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    test_microsoft_auth_new_user()
    test_microsoft_auth_existing_user()
    test_email_login()
    test_email_register()
    test_invalid_token()
    
    print("\n" + "="*60)
    print("TEST SUITE COMPLETED")
    print("="*60)

if __name__ == "__main__":
    run_all_tests()
