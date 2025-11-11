@echo off
echo ========================================
echo PostgreSQL Password Reset Script
echo ========================================
echo.
echo This script will reset the postgres user password to: postgres
echo.
echo WARNING: This script must be run as Administrator!
echo.
pause

echo Step 1: Stopping PostgreSQL service...
net stop postgresql-x64-16
if errorlevel 1 (
    echo Failed to stop service. Make sure you're running as Administrator.
    pause
    exit /b 1
)
echo Done!
echo.

echo Step 2: Backing up configuration...
copy "C:\Program Files\PostgreSQL\16\data\pg_hba.conf" "C:\Program Files\PostgreSQL\16\data\pg_hba.conf.backup" >nul
echo Done!
echo.

echo Step 3: Temporarily disabling password authentication...
powershell -Command "(Get-Content 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf') -replace 'scram-sha-256', 'trust' -replace 'md5', 'trust' | Set-Content 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf'"
echo Done!
echo.

echo Step 4: Starting PostgreSQL service...
net start postgresql-x64-16
echo Waiting for service to start...
timeout /t 5 /nobreak >nul
echo Done!
echo.

echo Step 5: Resetting password...
"C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
if errorlevel 1 (
    echo Failed to reset password. Restoring configuration...
    copy "C:\Program Files\PostgreSQL\16\data\pg_hba.conf.backup" "C:\Program Files\PostgreSQL\16\data\pg_hba.conf" >nul
    net stop postgresql-x64-16
    net start postgresql-x64-16
    echo.
    echo Password reset failed. Please check the error above.
    pause
    exit /b 1
)
echo Done!
echo.

echo Step 6: Restoring security configuration...
copy "C:\Program Files\PostgreSQL\16\data\pg_hba.conf.backup" "C:\Program Files\PostgreSQL\16\data\pg_hba.conf" >nul
echo Done!
echo.

echo Step 7: Restarting PostgreSQL service...
net stop postgresql-x64-16
net start postgresql-x64-16
echo Done!
echo.

echo ========================================
echo Password Reset Complete!
echo ========================================
echo.
echo New password: postgres
echo.
echo You can now connect with:
echo   Username: postgres
echo   Password: postgres
echo.
echo Next step: Run setup_postgresql.bat to configure your application
echo.
pause

