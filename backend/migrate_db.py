"""
Database Migration Script
Adds entra_user_id and status columns to users table
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
        # Add entra_user_id column if it doesn't exist
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS entra_user_id VARCHAR(255)
        """)
        print("✓ Added entra_user_id column")
        
        # Add status column if it doesn't exist
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS status ENUM('ACTIVE', 'PENDING_APPROVAL', 'INACTIVE') DEFAULT 'ACTIVE'
        """)
        print("✓ Added status column")
        
        # Update existing users to have ACTIVE status
        cursor.execute("""
            UPDATE users 
            SET status = 'ACTIVE' 
            WHERE status IS NULL
        """)
        print("✓ Updated existing users to ACTIVE status")
        
        db.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    print("Starting database migration...")
    migrate()
