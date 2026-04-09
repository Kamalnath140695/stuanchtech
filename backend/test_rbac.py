"""
RBAC Implementation Test Script
Tests database schema and basic functionality
"""

import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

def get_db():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "staunchtech_dms"),
    )

def test_database_schema():
    """Test if all required columns exist"""
    print("Testing database schema...")
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    try:
        cursor.execute("DESCRIBE users")
        columns = {row['Field']: row['Type'] for row in cursor.fetchall()}
        
        required_columns = {
            'id': 'int',
            'email': 'varchar(255)',
            'role': 'enum',
            'googleAuthenticated': 'tinyint(1)',
            'microsoftAuthenticated': 'tinyint(1)',
            'entraId': 'varchar(255)',
            'lastLogin': 'datetime',
            'loginStatus': 'enum'
        }
        
        print("\n✓ Checking required columns:")
        all_present = True
        for col, expected_type in required_columns.items():
            if col in columns:
                print(f"  ✓ {col}: {columns[col]}")
            else:
                print(f"  ✗ {col}: MISSING")
                all_present = False
        
        if all_present:
            print("\n✅ All required columns present!")
        else:
            print("\n❌ Some columns are missing. Run migrate_rbac.py")
        
        return all_present
    finally:
        cursor.close()
        db.close()

def test_role_enum():
    """Test if role enum has correct values"""
    print("\n\nTesting role enum values...")
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    try:
        cursor.execute("SHOW COLUMNS FROM users WHERE Field = 'role'")
        result = cursor.fetchone()
        
        if result:
            enum_values = result['Type']
            print(f"✓ Role enum: {enum_values}")
            
            required_roles = ['GLOBAL_ADMIN', 'USER_ADMIN', 'USER']
            has_all = all(role in enum_values for role in required_roles)
            
            if has_all:
                print("✅ All required roles present!")
            else:
                print("❌ Some roles missing. Run migrate_rbac.py")
            
            return has_all
        else:
            print("❌ Role column not found")
            return False
    finally:
        cursor.close()
        db.close()

def test_user_count():
    """Test user count and show sample users"""
    print("\n\nTesting user data...")
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT COUNT(*) as count FROM users")
        count = cursor.fetchone()['count']
        print(f"✓ Total users: {count}")
        
        if count > 0:
            cursor.execute("""
                SELECT email, role, googleAuthenticated, microsoftAuthenticated, loginStatus 
                FROM users 
                LIMIT 5
            """)
            users = cursor.fetchall()
            
            print("\n✓ Sample users:")
            for user in users:
                print(f"  - {user['email']}")
                print(f"    Role: {user['role']}")
                print(f"    Google: {'✓' if user['googleAuthenticated'] else '✗'}")
                print(f"    Microsoft: {'✓' if user['microsoftAuthenticated'] else '✗'}")
                print(f"    Status: {user['loginStatus']}")
        else:
            print("  No users found (this is normal for new installation)")
        
        return True
    finally:
        cursor.close()
        db.close()

def test_google_config():
    """Test if Google OAuth is configured"""
    print("\n\nTesting Google OAuth configuration...")
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    
    if google_client_id and google_client_id != "your-google-client-id.apps.googleusercontent.com":
        print(f"✓ Google Client ID: {google_client_id[:20]}...")
        print("✅ Google OAuth configured!")
        return True
    else:
        print("❌ Google Client ID not configured")
        print("   Update GOOGLE_CLIENT_ID in .env file")
        return False

def test_microsoft_config():
    """Test if Microsoft OAuth is configured"""
    print("\n\nTesting Microsoft OAuth configuration...")
    client_id = os.getenv("API_ENTRA_APP_CLIENT_ID")
    authority = os.getenv("API_ENTRA_APP_AUTHORITY")
    
    if client_id and authority:
        print(f"✓ Microsoft Client ID: {client_id[:20]}...")
        print(f"✓ Authority: {authority[:50]}...")
        print("✅ Microsoft OAuth configured!")
        return True
    else:
        print("❌ Microsoft OAuth not configured")
        return False

def main():
    print("=" * 60)
    print("RBAC Implementation Test Suite")
    print("=" * 60)
    
    results = {
        "Database Schema": test_database_schema(),
        "Role Enum": test_role_enum(),
        "User Data": test_user_count(),
        "Google OAuth": test_google_config(),
        "Microsoft OAuth": test_microsoft_config()
    }
    
    print("\n\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name:.<40} {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
        print("\nYou can now start the application:")
        print("  Backend:  cd backend && uvicorn main:app --reload")
        print("  Frontend: npm start")
    else:
        print("❌ SOME TESTS FAILED")
        print("\nPlease fix the issues above before starting the application.")
        print("Run: python migrate_rbac.py")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error running tests: {e}")
        print("\nMake sure:")
        print("  1. MySQL is running")
        print("  2. Database credentials in .env are correct")
        print("  3. Database exists")
