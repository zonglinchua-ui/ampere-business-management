# Data Quality Dashboard Fix - Deployment Guide

## ✅ Issues Fixed

### 1. **Sync Errors Not Being Captured**
**Problem**: The error logging functions existed but were never called during sync operations.

**Solution**: Integrated error logging into `XeroSyncService`:
- Added `logSyncFailure` calls in contact sync error handlers
- Added `logSyncFailure` calls in invoice sync error handlers  
- Added `logSyncFailure` calls in payment sync error handlers

Now all sync errors are automatically logged to the `XeroSyncLog` table with full error details.

### 2. **Duplicate Contact Detection Not Working**
**Problem**: The duplicate detection logic existed but had no API endpoint to trigger it, and the UI was calling a non-existent endpoint.

**Solution**:
- Created `/api/xero/duplicate-contacts` endpoint to scan existing contacts
- Fixed `DataQualityTab` component to call the correct endpoint
- Added proper error handling and logging

Now the "Scan for Duplicates" button actually scans the existing `Customer` table for potential duplicates.

---

## 🚀 Deployment Steps

### Step 1: Pull Latest Code

```bash
cd C:\ampere\ampere_business_management
git pull origin fix/tender-file-manager
```

### Step 2: Restart Application

**No new dependencies or database migrations required!**

```bash
# Development
pnpm run dev

# Production
pnpm run build
pnpm start
```

### Step 3: Verify Data Quality Dashboard

1. **Navigate to Settings → Integrations → Xero**
2. **Click on "Data Quality" tab**
3. **Verify sync errors are showing** (if any exist)
4. **Click "Scan for Duplicates"** button
5. **Verify duplicate contacts are detected** (if any exist)

---

## 📊 How It Works Now

### Sync Error Logging

**When sync operations run**:
```
Contact/Invoice/Payment Sync → Error Occurs → logSyncFailure() → XeroSyncLog Table
```

**What gets logged**:
- Sync type (CONTACT, INVOICE, PAYMENT)
- Entity name and ID
- Xero ID
- Error message
- Full error details and stack trace
- Attempt count
- Timestamp

**Where to view**:
- Settings → Integrations → Xero → Data Quality tab → Sync Errors

### Duplicate Contact Detection

**When you click "Scan for Duplicates"**:
```
Button Click → /api/xero/duplicate-contacts → detectDuplicateContacts() → Customer Table Scan
```

**What it detects**:
- Similar names (using Levenshtein distance algorithm)
- Matching emails
- Matching phone numbers
- Similarity score (0-100%)

**Detection thresholds**:
- **High confidence**: 90%+ similarity
- **Medium confidence**: 80-89% similarity
- **Low confidence**: 70-79% similarity (not shown by default)

**Where to view**:
- Settings → Integrations → Xero → Data Quality tab → Duplicate Contacts

---

## 🔍 Testing

### Test 1: Verify Sync Error Logging

1. **Trigger a sync operation** (e.g., sync contacts from Xero)
2. If any errors occur, they should now appear in the Data Quality tab
3. Check the database:
   ```sql
   SELECT * FROM "XeroSyncLog" 
   WHERE status IN ('FAILED', 'SKIPPED') 
   ORDER BY "createdAt" DESC 
   LIMIT 10;
   ```

### Test 2: Verify Duplicate Detection

1. **Go to Data Quality tab**
2. **Click "Scan for Duplicates"**
3. Should see a toast notification: "Scanning for duplicate contacts..."
4. Results should appear showing any duplicate groups
5. Check console logs for:
   ```
   [Duplicate Detector] Starting duplicate detection...
   [Duplicate Detector] Analyzing X contacts...
   [Duplicate Detector] Found Y duplicate groups
   ```

### Test 3: Run Test Script (Optional)

```bash
cd C:\ampere\ampere_business_management
npx ts-node scripts/test-duplicate-detection.ts
```

This will:
- Scan for duplicates
- Display statistics
- Show sample duplicate groups

---

## 📋 What Was Changed

### Files Modified

1. **`lib/xero-sync-service.ts`**
   - Added import for error logging functions
   - Added error logging in `pullContacts` catch block (line 373-380)
   - Added error logging in `pullInvoices` catch block (line 1379-1386)
   - Added error logging in `pullPayments` catch block (line 2439-2446)

2. **`components/xero/data-quality-tab.tsx`**
   - Fixed API endpoint from `/api/contacts/duplicates` to `/api/xero/duplicate-contacts`
   - Added proper response parsing for duplicate data
   - Added console logging for debugging

### Files Created

1. **`app/api/xero/duplicate-contacts/route.ts`**
   - New API endpoint to scan for duplicate contacts
   - Supports threshold parameter (default 0.8)
   - Returns duplicate groups with similarity scores
   - Requires SUPERADMIN or FINANCE role

2. **`components/xero/data-quality-dashboard.tsx`**
   - Alternative implementation of data quality dashboard
   - More comprehensive UI with detailed tables
   - Can be used as a replacement if needed

3. **`scripts/test-duplicate-detection.ts`**
   - Test script to verify duplicate detection
   - Can be run independently to check functionality

---

## 🎯 Expected Results

### Sync Errors Tab

**Before Fix**:
- ❌ Always showed "No sync errors found" even when errors occurred
- ❌ Errors were logged to console but not database

**After Fix**:
- ✅ Shows actual sync errors from database
- ✅ Displays error message, entity name, timestamp
- ✅ Allows marking errors as resolved
- ✅ Shows statistics: total errors, unresolved, recent (24h)

### Duplicate Contacts Tab

**Before Fix**:
- ❌ Always showed "No duplicate contacts found"
- ❌ "Scan for Duplicates" button did nothing (API endpoint didn't exist)

**After Fix**:
- ✅ Scans existing contacts in database
- ✅ Detects duplicates based on name similarity, email, phone
- ✅ Shows similarity score for each group
- ✅ Suggests which contact to keep (oldest with Xero ID)
- ✅ Displays contact details: name, email, phone, type, Xero sync status

---

## 📊 Example Output

### Sync Errors

```
Type: CONTACT
Status: FAILED
Entity: ABC Company Pte Ltd
Error: Customer not found for Xero contact ABC Company Pte Ltd
Date: Jan 13, 2024 14:30
[Mark Resolved] button
```

### Duplicate Contacts

```
3 Potential Duplicates (Similarity: 92%)

┌─────────────────────────────────────────────────────────────┐
│ ABC Company Pte Ltd ← SUGGESTED                             │
│ abc@company.com • +65 1234 5678                             │
│ [Customer] [Synced to Xero]                                 │
│ Created: Jan 1, 2024                                        │
├─────────────────────────────────────────────────────────────┤
│ ABC Company Private Limited                                 │
│ info@abccompany.com • +65 1234 5678                         │
│ [Customer]                                                  │
│ Created: Jan 5, 2024                                        │
├─────────────────────────────────────────────────────────────┤
│ ABC Co Pte Ltd                                              │
│ contact@abc.com • +65 1234 5678                             │
│ [Customer] [Supplier]                                       │
│ Created: Jan 10, 2024                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Issue: No sync errors showing

**Possible Causes**:
- No sync operations have been performed yet
- All syncs completed successfully
- Errors occurred before the fix was deployed

**Solution**:
1. Perform a new sync operation (contacts, invoices, or payments)
2. If errors occur, they should now be logged
3. Check database directly:
   ```sql
   SELECT COUNT(*) FROM "XeroSyncLog" WHERE status IN ('FAILED', 'SKIPPED');
   ```

### Issue: "Scan for Duplicates" not working

**Possible Causes**:
- User doesn't have SUPERADMIN or FINANCE role
- API endpoint not accessible
- No contacts in database

**Solution**:
1. Check user role in session
2. Check browser console for API errors
3. Verify contacts exist:
   ```sql
   SELECT COUNT(*) FROM "Customer";
   ```
4. Check server logs for errors

### Issue: Duplicates not being detected

**Possible Causes**:
- No actual duplicates exist
- Similarity threshold too high (default 0.8 = 80%)
- Contact names too different

**Solution**:
1. Lower the threshold in the API call (e.g., 0.7 for 70%)
2. Check if contacts have similar names manually
3. Run the test script to see what's being detected

---

## 🎓 How to Use

### For End Users

**Monitoring Sync Errors**:
1. Go to Settings → Integrations → Xero → Data Quality
2. Check "Sync Errors" tab regularly
3. Review any failed or skipped operations
4. Mark errors as resolved after fixing

**Finding Duplicate Contacts**:
1. Go to Settings → Integrations → Xero → Data Quality
2. Click "Duplicate Contacts" tab
3. Click "Scan for Duplicates" button
4. Review detected duplicates
5. Manually merge or delete duplicates as needed

### For Developers

**Adding Error Logging to New Sync Operations**:

```typescript
import { logSyncFailure, logSyncSuccess } from '@/lib/xero-sync-error-logger'

try {
  // Sync operation
  await syncSomething()
  
  // Log success
  await logSyncSuccess('CONTACT', entityId, entityName, xeroId)
} catch (error: any) {
  // Log failure
  await logSyncFailure(
    'CONTACT',
    error,
    entityId,
    entityName,
    xeroId,
    { additionalContext: 'any extra data' }
  )
}
```

**Customizing Duplicate Detection**:

```typescript
// Adjust threshold (0.0 to 1.0)
const duplicates = await detectDuplicateContacts(0.7) // 70% similarity

// Get statistics only (faster)
const stats = await getDuplicateStats()
```

---

## 📈 Monitoring

### Key Metrics to Track

1. **Sync Error Rate**
   - Total errors vs successful syncs
   - Errors by type (CONTACT, INVOICE, PAYMENT)
   - Recent errors (last 24 hours)

2. **Duplicate Contact Rate**
   - Total duplicate groups
   - High confidence duplicates (90%+)
   - Medium confidence duplicates (80-89%)

3. **Resolution Rate**
   - Resolved errors vs unresolved
   - Time to resolve errors
   - Recurring errors

### Database Queries

**Check sync error trends**:
```sql
SELECT 
  DATE("createdAt") as date,
  "syncType",
  COUNT(*) as error_count
FROM "XeroSyncLog"
WHERE status IN ('FAILED', 'SKIPPED')
GROUP BY DATE("createdAt"), "syncType"
ORDER BY date DESC
LIMIT 30;
```

**Check duplicate statistics**:
```sql
SELECT 
  COUNT(*) as total_contacts,
  COUNT(DISTINCT name) as unique_names,
  COUNT(*) - COUNT(DISTINCT name) as potential_duplicates
FROM "Customer";
```

---

## 🎊 Summary

The Data Quality Dashboard now properly:

✅ **Captures sync errors** during all sync operations  
✅ **Logs errors to database** with full details  
✅ **Scans existing contacts** for duplicates  
✅ **Detects duplicates** using intelligent algorithms  
✅ **Displays errors and duplicates** in the UI  
✅ **Allows error resolution** tracking  
✅ **Provides statistics** for monitoring  

**Next Steps**:
1. Pull the latest code
2. Restart your application
3. Navigate to Data Quality tab
4. Scan for duplicates
5. Monitor sync errors going forward

---

**Deployment Date**: Ready for immediate deployment  
**Branch**: `fix/tender-file-manager`  
**Status**: ✅ Complete and tested  
**Impact**: High (enables proper data quality monitoring)

