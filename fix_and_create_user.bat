@echo off
echo ========================================
echo Ampere Business Management - Database Setup
echo ========================================
echo.

cd /d C:\ampere\ampere_business_management

echo Step 1: Updating Prisma schema to SQLite...
powershell -Command "(Get-Content prisma\schema.prisma) -replace 'postgresql', 'sqlite' | Set-Content prisma\schema.prisma"
echo Done!
echo.

echo Step 2: Deleting old migrations folder...
if exist prisma\migrations rmdir /s /q prisma\migrations
echo Done!
echo.

echo Step 3: Deleting old database...
if exist prisma\dev.db del /f prisma\dev.db
echo Done!
echo.

echo Step 4: Regenerating Prisma client for SQLite...
call yarn prisma generate
echo Done!
echo.

echo Step 5: Creating fresh database with schema...
call yarn prisma db push --skip-generate
echo Done!
echo.

echo Step 6: Creating superadmin user...
call node create_superadmin.js
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo You can now log in with:
echo Email: zack@ampere.com
echo Password: Czl914816
echo.
echo Next steps:
echo 1. Start the app: yarn start
echo 2. Enable Tailscale: tailscale funnel 3000
echo 3. Access at: https://czl-pc.tail2217a9.ts.net
echo.
pause

