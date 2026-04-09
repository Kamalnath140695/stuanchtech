"""
Database Migration for RBAC
Adds googleAuthenticated, microsoftAuthenticated, entraId, lastLogin, loginStatus
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

def migrate():
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Add googleAuthenticated column
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS googleAuthenticated BOOLEAN DEFAULT FALSE
        """)
        print("✓ Added googleAuthenticated column")
        
        # Add microsoftAuthenticated column
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS microsoftAuthenticated BOOLEAN DEFAULT FALSE
        """)
        print("✓ Added microsoftAuthenticated column")
        
        # Add entraId column (rename from entra_user_id)
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS entraId VARCHAR(255)
        """)
        print("✓ Added entraId column")
        
        # Add lastLogin column
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS lastLogin DATETIME
        """)
        print("✓ Added lastLogin column")
        
        # Add loginStatus column
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS loginStatus ENUM('ONLINE', 'OFFLINE') DEFAULT 'OFFLINE'
        """)
        print("✓ Added loginStatus column")
        
        # Update role enum to include new roles
        cursor.execute("""
            ALTER TABLE users 
            MODIFY COLUMN role ENUM('GLOBAL_ADMIN', 'USER_ADMIN', 'USER', 'GlobalAdmin', 'UserAdmin', 'NormalUser', 'PendingApproval') DEFAULT 'USER'
        """)
        print("✓ Updated role enum")
        
        db.commit()
        print("\n✅ RBAC migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    print("Starting RBAC database migration...")
    migrate()
