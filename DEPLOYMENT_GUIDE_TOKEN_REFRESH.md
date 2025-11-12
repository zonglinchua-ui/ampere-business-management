# Quick Deployment Guide: Xero Token Auto-Refresh

## What Was Done

✅ **Completed automatic token refresh implementation** to eliminate repeated OAuth authorization prompts when using Xero integration.

## Changes Summary

### Modified Files
1. **`app/api/xero/enhanced-sync/route.ts`**
   - Added automatic token refresh before all sync operations
   - Returns clear error if refresh fails

2. **`app/api/xero/test-connection/route.ts`**
   - Added automatic token refresh before testing connection

3. **`app/api/xero/connection-status/route.ts`**
   - Already had token refresh (verified and working)

### New Documentation
1. **`docs/XERO_AUTO_TOKEN_REFRESH.md`**
   - Comprehensive documentation of the token refresh system
   - Architecture, usage examples, troubleshooting

2. **`docs/IMPLEMENTATION_SUMMARY_TOKEN_REFRESH.md`**
   - Detailed implementation summary
   - Testing procedures and monitoring

## Deployment Steps

### 1. Pull Latest Changes

```bash
cd C:\ampere\ampere_business_management
git pull origin fix/tender-file-manager
```

### 2. No New Dependencies Required

All required packages are already installed. No need to run `pnpm install`.

### 3. No Database Migrations Required

The system uses the existing `XeroIntegration` table. No schema changes needed.

### 4. Restart the Application

```bash
# If running in development
pnpm run dev

# If running in production
pnpm run build
pnpm start
```

### 5. Verify It's Working

#### Test 1: Check Connection Status
1. Go to **Settings → Integrations → Xero**
2. The connection status should show without asking for authorization
3. Look for these log messages in the console:
   ```
   🔄 [Xero Status] Ensuring tokens are fresh...
   ✅ [Token Refresh] Tokens refreshed successfully
   ```

#### Test 2: Test Connection
1. In Xero settings, click **"Test Connection"** button
2. Should succeed without "Allow access" prompt
3. Look for these log messages:
   ```
   🔄 [Test Connection] Ensuring tokens are fresh...
   ✅ Xero connection test successful
   ```

#### Test 3: Perform a Sync
1. Go to Xero sync page
2. Perform a contact or invoice sync
3. Should complete without authorization prompt
4. Look for these log messages:
   ```
   🔄 [Enhanced Sync] Ensuring tokens are fresh...
   ✅ [Enhanced Sync] Connection validated and tokens fresh
   ```

## Expected Behavior

### ✅ Success Scenario
- User works with Xero integration
- Tokens automatically refresh in background
- No "Allow access" prompts appear
- Operations complete seamlessly

### ⚠️ Failure Scenario (Rare)
If token refresh fails (e.g., after 60 days when refresh token expires):
- User sees clear error message: "Failed to refresh Xero tokens. Please reconnect to Xero."
- User clicks "Connect to Xero" button once
- System works for another 60 days

## Monitoring

### Log Messages to Watch

**Success**:
```
🔄 [Enhanced Sync] Ensuring tokens are fresh...
✅ [Token Refresh] Tokens refreshed successfully
✅ [Enhanced Sync] Connection validated and tokens fresh
```

**Token Refresh Needed**:
```
🔄 [Token Refresh] Token expiring soon, refreshing...
✅ [Token Refresh] Tokens refreshed successfully
```

**Failure** (requires user action):
```
❌ [Token Refresh] Failed to refresh tokens: [error message]
⚠️ Token refresh failed, user needs to reconnect
```

### Database Check

To verify tokens are being refreshed, check the `XeroIntegration` table:

```sql
SELECT 
  "tenantName",
  "expiresAt",
  "updatedAt",
  "lastSyncAt",
  "isActive"
FROM "XeroIntegration"
WHERE "isActive" = true;
```

The `updatedAt` timestamp should update whenever tokens are refreshed.

## Troubleshooting

### Issue: Still seeing "Allow access" prompts

**Solution**:
1. Verify you pulled the latest code
2. Restart the application
3. Clear browser cache
4. Check logs for token refresh attempts

### Issue: "Token refresh failed" error

**Solution**:
1. Check internet connectivity
2. Verify Xero OAuth credentials in `.env`:
   ```
   XERO_CLIENT_ID=your_client_id
   XERO_CLIENT_SECRET=your_client_secret
   XERO_REDIRECT_URI=your_redirect_uri
   ```
3. If refresh token expired (after 60 days), reconnect once via Xero settings

### Issue: No log messages appearing

**Solution**:
1. Verify application is running the latest code
2. Check console/terminal for logs
3. Ensure logging is enabled in your environment

## Key Features

1. **Automatic Refresh**: Tokens refresh 20 minutes before expiry
2. **No User Interruption**: Happens in background
3. **60-Day Window**: Refresh tokens last 60 days
4. **Comprehensive Coverage**: All critical endpoints covered
5. **Clear Error Messages**: If refresh fails, user knows what to do

## Technical Details

### Refresh Thresholds
- **Standard operations**: 20 minutes before expiry
- **Sync operations**: 5 minutes before expiry (via XeroSyncService)

### Covered Endpoints
- ✅ `/api/xero/connection-status` - Connection checks
- ✅ `/api/xero/enhanced-sync` - All sync operations
- ✅ `/api/xero/test-connection` - Connection testing
- ✅ `/api/xero/sync/contacts` - Contact sync (via XeroSyncService)
- ✅ `/api/xero/sync/invoices/*` - Invoice sync (via XeroSyncService)
- ✅ `/api/xero/sync/payments/*` - Payment sync (via XeroSyncService)

## Support

If you encounter issues:

1. **Check the logs** for token refresh attempts and errors
2. **Review documentation** in `docs/XERO_AUTO_TOKEN_REFRESH.md`
3. **Verify OAuth credentials** in `.env` file
4. **Check database** for token updates in `XeroIntegration` table
5. **Test manually** using the verification steps above

## Next Steps

After successful deployment:

1. ✅ Monitor logs for token refresh activity
2. ✅ Verify user experience improvements
3. ✅ Document any issues encountered
4. ✅ Consider future enhancements:
   - Proactive background refresh job
   - Token health monitoring dashboard
   - Expiry notifications (before 60-day limit)

---

**Deployment Date**: Ready for immediate deployment
**Branch**: `fix/tender-file-manager`
**Status**: ✅ Complete and tested
**Impact**: High (eliminates user friction with Xero integration)

