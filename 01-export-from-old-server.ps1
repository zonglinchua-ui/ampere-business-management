# ========================================
# Ampere Business Management
# Data Export Script - OLD SERVER
# ========================================
# This script exports Users and Tenders from the old server
# Run this on your OLD server (C:\ampere\ampere_business_management)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ampere Data Export - OLD SERVER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$exportDir = "C:\ampere\migration-export"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

# Create export directory
Write-Host "Creating export directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $exportDir -Force | Out-Null

# Database connection details (update if different)
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "ampere_db"
$dbUser = "ampere_user"

Write-Host "Database: $dbName" -ForegroundColor Gray
Write-Host "Host: $dbHost:$dbPort" -ForegroundColor Gray
Write-Host ""

# Function to export table
function Export-Table {
    param (
        [string]$TableName,
        [string]$Description
    )
    
    Write-Host "Exporting $Description..." -ForegroundColor Yellow
    
    $outputFile = "$exportDir\$TableName.sql"
    
    # Export table structure and data
    docker exec ampere-postgres pg_dump -U $dbUser -d $dbName -t $TableName --column-inserts --data-only > $outputFile
    
    if ($LASTEXITCODE -eq 0) {
        $fileSize = (Get-Item $outputFile).Length
        Write-Host "  ✓ Exported $Description ($fileSize bytes)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to export $Description" -ForegroundColor Red
    }
}

# Export Users table
Write-Host ""
Write-Host "Step 1: Exporting Users" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Export-Table -TableName "User" -Description "Users"

# Export Tenders table
Write-Host ""
Write-Host "Step 2: Exporting Tenders" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Export-Table -TableName "Tender" -Description "Tenders"

# Create metadata file
Write-Host ""
Write-Host "Step 3: Creating metadata file" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray

$metadata = @{
    exportDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    serverName = $env:COMPUTERNAME
    databaseName = $dbName
    tablesExported = @("User", "Tender")
    notes = "Selective export for migration - Users and Tenders only"
}

$metadata | ConvertTo-Json | Out-File "$exportDir\metadata.json"
Write-Host "  ✓ Created metadata.json" -ForegroundColor Green

# Create README
Write-Host ""
Write-Host "Step 4: Creating README" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray

$readme = @"
# Ampere Data Export

**Export Date:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Server:** $env:COMPUTERNAME
**Database:** $dbName

## Exported Tables

1. **User.sql** - All user accounts and profiles
2. **Tender.sql** - All tender records

## What's NOT Included

The following data is NOT exported (will start fresh on new server):
- Projects
- Quotations
- Invoices
- Purchase Orders
- Inventory
- Finance records
- WhatsApp logs
- Other transactional data

## Next Steps

1. Copy this entire folder to the new server
2. Run the import script on the new server
3. Verify the imported data

## Files in This Export

"@

Get-ChildItem $exportDir | ForEach-Object {
    $readme += "`n- $($_.Name) ($([math]::Round($_.Length/1KB, 2)) KB)"
}

$readme | Out-File "$exportDir\README.txt"
Write-Host "  ✓ Created README.txt" -ForegroundColor Green

# Create archive
Write-Host ""
Write-Host "Step 5: Creating archive" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray

$archivePath = "C:\ampere\ampere-migration-$timestamp.zip"
Compress-Archive -Path "$exportDir\*" -DestinationPath $archivePath -Force

if (Test-Path $archivePath) {
    $archiveSize = (Get-Item $archivePath).Length / 1MB
    Write-Host "  ✓ Created archive: $archivePath" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($archiveSize, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "  ✗ Failed to create archive" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Export Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Export Location:" -ForegroundColor Yellow
Write-Host "  $exportDir" -ForegroundColor White
Write-Host ""
Write-Host "Archive Location:" -ForegroundColor Yellow
Write-Host "  $archivePath" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Copy the ZIP file to your new server" -ForegroundColor White
Write-Host "  2. Extract the ZIP file" -ForegroundColor White
Write-Host "  3. Run the import script on the new server" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
