-- Check Xero integration status
SELECT 
  'Xero Connection' as check_type,
  "isActive",
  "connectedAt",
  "lastSyncAt",
  "tenantName"
FROM "XeroIntegration"
WHERE "isActive" = true
LIMIT 1;
