import os
import mysql.connector
from mysql.connector import Error

def get_db_connection():
    """Create and return MySQL database connection"""
    try:
        connection = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST", "localhost"),
            port=int(os.getenv("MYSQL_PORT", 3306)),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", ""),
            database=os.getenv("MYSQL_DATABASE", "staunchtech_dms"),
            autocommit=True
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def init_database():
    """Initialize database and create tables if they don't exist"""
    connection = None
    cursor = None
    try:
        # First connect without database to create it if needed
        connection = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST", "localhost"),
            port=int(os.getenv("MYSQL_PORT", 3306)),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", "")
        )
        
        cursor = connection.cursor()
        
        # Create database if not exists
        db_name = os.getenv("MYSQL_DATABASE", "staunchtech_dms")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        cursor.execute(f"USE {db_name}")
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                entra_user_id VARCHAR(255),
                provider ENUM('email', 'google', 'microsoft') DEFAULT 'email',
                role ENUM('GlobalAdmin', 'UserAdmin', 'NormalUser') DEFAULT 'NormalUser',
                status ENUM('PENDING_APPROVAL', 'ACTIVE', 'REJECTED') DEFAULT 'PENDING_APPROVAL',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP NULL,
                approved_by VARCHAR(255) NULL,
                rejected_at TIMESTAMP NULL,
                rejected_by VARCHAR(255) NULL,
                rejection_reason TEXT NULL,
                INDEX idx_email (email),
                INDEX idx_status (status),
                INDEX idx_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT NULL,
                category VARCHAR(120) NULL,
                created_by VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                status ENUM('DRAFT', 'PUBLISHED', 'DISABLED') DEFAULT 'DRAFT',
                INDEX idx_templates_status (status),
                INDEX idx_templates_category (category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS template_fields (
                id INT AUTO_INCREMENT PRIMARY KEY,
                template_id INT NOT NULL,
                field_label VARCHAR(255) NOT NULL,
                field_type VARCHAR(50) NOT NULL,
                required BOOLEAN DEFAULT FALSE,
                placeholder TEXT NULL,
                default_value TEXT NULL,
                help_text TEXT NULL,
                options_json LONGTEXT NULL,
                order_no INT NOT NULL,
                validation_json LONGTEXT NULL,
                allowed_file_types LONGTEXT NULL,
                max_file_size BIGINT NULL,
                max_files INT NULL,
                allow_multiple BOOLEAN DEFAULT FALSE,
                document_category VARCHAR(120) NULL,
                min_length INT NULL,
                max_length INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_template_fields_template
                    FOREIGN KEY (template_id) REFERENCES templates(id)
                    ON DELETE CASCADE,
                INDEX idx_template_fields_template (template_id),
                INDEX idx_template_fields_order (template_id, order_no)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS form_submissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                template_id INT NOT NULL,
                submitted_by VARCHAR(255) NOT NULL,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_form_submissions_template
                    FOREIGN KEY (template_id) REFERENCES templates(id)
                    ON DELETE CASCADE,
                INDEX idx_form_submissions_template (template_id),
                INDEX idx_form_submissions_submitted_by (submitted_by)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS form_field_values (
                id INT AUTO_INCREMENT PRIMARY KEY,
                submission_id INT NOT NULL,
                field_id INT NOT NULL,
                value LONGTEXT NULL,
                file_path TEXT NULL,
                CONSTRAINT fk_form_field_values_submission
                    FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_form_field_values_field
                    FOREIGN KEY (field_id) REFERENCES template_fields(id)
                    ON DELETE CASCADE,
                INDEX idx_form_field_values_submission (submission_id),
                INDEX idx_form_field_values_field (field_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        
        connection.commit()
        print("[OK] Database and tables initialized successfully")
        return True
        
    except Error as e:
        print(f"[ERROR] Error initializing database: {e}")
        return False
    finally:
        if connection and connection.is_connected():
            if cursor:
                cursor.close()
            connection.close()

# Initialize database on module import
init_database()
