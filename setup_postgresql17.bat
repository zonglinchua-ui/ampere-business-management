@echo off
echo ========================================
echo PostgreSQL 17 Setup for Ampere Business Management
echo ========================================
echo.

REM Set variables for PostgreSQL 17
set PGPASSWORD=postgres
set PGBIN=C:\Program Files\PostgreSQL\17\bin
set PGPORT=5433
set APPDIR=C:\ampere\ampere_business_management

echo Step 1: Resetting postgres password...
echo (This should work without asking for password)
"%PGBIN%\psql" -U postgres -p %PGPORT% -c "ALTER USER postgres WITH PASSWORD 'postgres';"
if errorlevel 1 (
    echo.
    echo Failed to reset password. Press Enter when prompted for password.
    pause
    "%PGBIN%\psql" -U postgres -p %PGPORT% -c "ALTER USER postgres WITH PASSWORD 'postgres';"
)
echo Done!
echo.

echo Step 2: Restoring security configuration...
copy "C:\Program Files\PostgreSQL\17\data\pg_hba.conf.backup" "C:\Program Files\PostgreSQL\17\data\pg_hba.conf" >nul
net stop postgresql-x64-17
net start postgresql-x64-17
timeout /t 5 /nobreak >nul
echo Done!
echo.

echo Step 3: Creating database and user...
set PGPASSWORD=postgres
"%PGBIN%\psql" -U postgres -p %PGPORT% -c "DROP DATABASE IF EXISTS ampere_db;" 2>nul
"%PGBIN%\psql" -U postgres -p %PGPORT% -c "DROP USER IF EXISTS ampere_user;" 2>nul
"%PGBIN%\psql" -U postgres -p %PGPORT% -c "CREATE DATABASE ampere_db;"
"%PGBIN%\psql" -U postgres -p %PGPORT% -c "CREATE USER ampere_user WITH PASSWORD 'Ampere2024!';"
"%PGBIN%\psql" -U postgres -p %PGPORT% -c "GRANT ALL PRIVILEGES ON DATABASE ampere_db TO ampere_user;"
"%PGBIN%\psql" -U postgres -p %PGPORT% -c "ALTER DATABASE ampere_db OWNER TO ampere_user;"
"%PGBIN%\psql" -U postgres -p %PGPORT% -d ampere_db -c "GRANT ALL ON SCHEMA public TO ampere_user;"
echo Done!
echo.

echo Step 4: Updating application configuration...
cd /d %APPDIR%

REM Update .env file with PostgreSQL 17 on port 5433
powershell -Command "(Get-Content .env) -replace 'DATABASE_URL=.*', 'DATABASE_URL=postgresql://ampere_user:Ampere2024!@localhost:5433/ampere_db' | Set-Content .env"
echo .env updated
echo.

REM Update schema.prisma to use PostgreSQL
powershell -Command "(Get-Content prisma\schema.prisma) -replace 'provider = \"sqlite\"', 'provider = \"postgresql\"' | Set-Content prisma\schema.prisma"
echo schema.prisma updated
echo.

echo Step 5: Cleaning up old database files...
if exist prisma\dev.db del /f prisma\dev.db
if exist prisma\migrations rmdir /s /q prisma\migrations
echo Done!
echo.

echo Step 6: Regenerating Prisma client for PostgreSQL...
call yarn prisma generate
echo Done!
echo.

echo Step 7: Running database migrations...
call yarn prisma db push --skip-generate
if errorlevel 1 (
    echo.
    echo Migration failed. Trying migrate deploy...
    call yarn prisma migrate deploy
)
echo Done!
echo.

echo Step 8: Creating superadmin user...
call node create_superadmin.js
echo.

echo ========================================
echo PostgreSQL 17 Setup Complete!
echo ========================================
echo.
echo Database Information:
echo - Host: localhost
echo - Port: 5433
echo - Database: ampere_db
echo - Username: ampere_user
echo - Password: Ampere2024!
echo.
echo PostgreSQL Superuser:
echo - Username: postgres
echo - Password: postgres
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

