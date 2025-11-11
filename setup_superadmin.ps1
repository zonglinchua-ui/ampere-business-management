# Ampere Business Management - Create Superadmin User
# Run this script on your Windows PC

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ampere Business Management Setup" -ForegroundColor Cyan
Write-Host "Creating Superadmin Account" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to app directory
Set-Location "C:\ampere\ampere_business_management"

Write-Host "Step 1: Updating Prisma schema for SQLite..." -ForegroundColor Yellow
# Update schema.prisma to use SQLite
$schemaPath = "C:\ampere\ampere_business_management\prisma\schema.prisma"
$content = Get-Content $schemaPath -Raw
$content = $content -replace 'provider\s*=\s*"postgresql"', 'provider = "sqlite"'
Set-Content $schemaPath -Value $content
Write-Host "✓ Schema updated" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Regenerating Prisma client..." -ForegroundColor Yellow
yarn prisma generate
Write-Host "✓ Prisma client regenerated" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Running database migrations..." -ForegroundColor Yellow
yarn prisma migrate deploy
Write-Host "✓ Database migrated" -ForegroundColor Green
Write-Host ""

Write-Host "Step 4: Creating superadmin user..." -ForegroundColor Yellow
node create_superadmin.js
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now log in with:" -ForegroundColor White
Write-Host "Email: zack@ampere.com" -ForegroundColor Yellow
Write-Host "Password: Czl914816" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

