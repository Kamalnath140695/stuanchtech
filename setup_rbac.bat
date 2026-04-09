@echo off
echo ========================================
echo RBAC Authentication Setup Script
echo ========================================
echo.

echo Step 1: Installing Python dependencies...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)
echo ✓ Python dependencies installed
echo.

echo Step 2: Running database migration...
python migrate_rbac.py
if %errorlevel% neq 0 (
    echo ERROR: Database migration failed
    pause
    exit /b 1
)
echo ✓ Database migration completed
echo.

echo Step 3: Installing frontend dependencies...
cd ..
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install npm dependencies
    pause
    exit /b 1
)
echo ✓ Frontend dependencies installed
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Configure Google OAuth in .env file
echo 2. Start backend: cd backend ^&^& uvicorn main:app --reload
echo 3. Start frontend: npm start
echo.
echo See RBAC_AUTHENTICATION_COMPLETE.md for full documentation
echo.
pause
