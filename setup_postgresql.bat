@echo off
echo ========================================
echo PostgreSQL Setup for Ampere Business Management
echo ========================================
echo.
echo This script will:
echo 1. Create PostgreSQL database and user
echo 2. Update application configuration
echo 3. Run database migrations
echo 4. Create superadmin account
echo.
echo PREREQUISITES:
echo - PostgreSQL must be installed
echo - You need the postgres password
echo.
pause
echo.

REM Set variables
set PGPASSWORD=P0stgr3sAdmin2024
set PGBIN=C:\Program Files\PostgreSQL\16\bin
set APPDIR=C:\ampere\ampere_business_management

echo Step 1: Creating database and user...
"%PGBIN%\psql" -U postgres -c "CREATE DATABASE ampere_db;" 2>nul
"%PGBIN%\psql" -U postgres -c "CREATE USER ampere_user WITH PASSWORD 'Ampere2024!';" 2>nul
"%PGBIN%\psql" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ampere_db TO ampere_user;"
"%PGBIN%\psql" -U postgres -c "ALTER DATABASE ampere_db OWNER TO ampere_user;"
echo Done!
echo.

echo Step 2: Updating application configuration...
cd /d %APPDIR%

REM Update .env file
powershell -Command "(Get-Content .env) -replace 'DATABASE_URL=.*', 'DATABASE_URL=postgresql://ampere_user:Ampere2024!@localhost:5432/ampere_db' | Set-Content .env"
echo .env updated
echo.

REM Update schema.prisma
powershell -Command "(Get-Content prisma\schema.prisma) -replace 'provider = \"sqlite\"', 'provider = \"postgresql\"' | Set-Content prisma\schema.prisma"
echo schema.prisma updated
echo.

echo Step 3: Deleting old SQLite database...
if exist prisma\dev.db del /f prisma\dev.db
if exist prisma\migrations rmdir /s /q prisma\migrations
echo Done!
echo.

echo Step 4: Regenerating Prisma client for PostgreSQL...
call yarn prisma generate
echo Done!
echo.

echo Step 5: Running database migrations...
call yarn prisma migrate deploy
if errorlevel 1 (
    echo.
    echo Migration failed. Trying db push instead...
    call yarn prisma db push --skip-generate
)
echo Done!
echo.

echo Step 6: Creating superadmin user...
call node create_superadmin.js
echo.

echo ========================================
echo PostgreSQL Setup Complete!
echo ========================================
echo.
echo Database Information:
echo - Host: localhost
echo - Port: 5432
echo - Database: ampere_db
echo - Username: ampere_user
echo - Password: Ampere2024!
echo.
echo Application Login:
echo - Email: zack@ampere.com
echo - Password: Czl914816
echo.
echo Next steps:
echo 1. Start the app: yarn start
echo 2. Enable Tailscale: tailscale funnel 3000
echo 3. Access at: https://czl-pc.tail2217a9.ts.net
echo.
pause

