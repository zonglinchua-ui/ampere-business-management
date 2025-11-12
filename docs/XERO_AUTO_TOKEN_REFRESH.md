# Xero Automatic Token Refresh System

## Overview

The Xero integration implements **automatic token refresh** to eliminate the need for users to repeatedly authorize access. This system ensures that OAuth tokens are automatically refreshed in the background before they expire, providing a seamless user experience.

## Problem Solved

**Before**: Users had to click "Allow access" every time their Xero OAuth tokens expired (typically after 30 minutes of inactivity), disrupting their workflow.

**After**: Tokens are automatically refreshed in the background using the refresh token, allowing users to work continuously without re-authorization prompts.

## Architecture

### Core Components

1. **Token Refresh Service** (`lib/xero-auto-refresh.ts`)
   - `ensureXeroTokensFresh(minutesBeforeExpiry)`: Main function that checks and refreshes tokens
   - `checkIfTokensNeedRefresh(minutesBeforeExpiry)`: Checks if tokens are expiring soon
   - Uses refresh tokens to obtain new access tokens automatically

2. **OAuth Service** (`lib/xero-oauth-service.ts`)
   - `refreshAccessToken()`: Exchanges refresh token for new access token
   - Handles token storage in database
   - Manages token lifecycle

3. **API Service** (`lib/xero-api-service.ts`)
   - `initialize()`: Calls `ensureXeroTokensFresh()` during initialization
   - Ensures all API operations use fresh tokens

4. **Sync Service** (`lib/xero-sync-service.ts`)
   - `initialize()`: Built-in token refresh (5-minute threshold)
   - All sync operations automatically use fresh tokens

## Token Refresh Flow

```
User Action → API Endpoint → ensureXeroTokensFresh()
                                    ↓
                          Check token expiry
                                    ↓
                    Expiring within threshold? (20 min)
                                    ↓
                                  YES → refreshAccessToken()
                                    ↓
                          Store new tokens in DB
                                    ↓
                          Return success/failure
                                    ↓
                    Proceed with API operation
```

## Integration Points

### API Endpoints with Auto-Refresh

The following critical endpoints have automatic token refresh integrated:

1. **Connection Status** (`/api/xero/connection-status`)
   - Refreshes tokens before checking connection
   - Threshold: 20 minutes before expiry
   - Location: Line 63-64

2. **Enhanced Sync** (`/api/xero/enhanced-sync`)
   - Refreshes tokens before any sync operation
   - Threshold: 20 minutes before expiry
   - Location: Line 197-211
   - Returns 401 error if refresh fails

3. **Test Connection** (`/api/xero/test-connection`)
   - Refreshes tokens before testing connection
   - Threshold: 20 minutes before expiry
   - Location: Line 62-63

4. **All Sync Operations** (via `XeroSyncService`)
   - Contacts sync (`/api/xero/sync/contacts`)
   - Invoice sync (`/api/xero/sync/invoices/pull`, `/api/xero/sync/invoices/push`)
   - Payment sync (`/api/xero/sync/payments/pull`, `/api/xero/sync/payments/push`)
   - Threshold: 5 minutes before expiry (built into `XeroSyncService.initialize()`)

### Refresh Thresholds

- **Standard Operations**: 20 minutes before expiry
- **Sync Operations**: 5 minutes before expiry (via XeroSyncService)
- **Rationale**: Provides buffer time for long-running operations

## Configuration

### Environment Variables

No additional environment variables required. The system uses existing Xero OAuth configuration:

```env
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=your_redirect_uri
```

### Database Schema

Tokens are stored in the `XeroIntegration` table:

```prisma
model XeroIntegration {
  id            String   @id @default(cuid())
  accessToken   String
  refreshToken  String
  expiresAt     DateTime
  tenantId      String
  tenantName    String?
  isActive      Boolean  @default(true)
  connectedAt   DateTime @default(now())
  lastSyncAt    DateTime?
  updatedAt     DateTime @updatedAt
}
```

## Usage Examples

### In API Routes

```typescript
import { ensureXeroTokensFresh } from '@/lib/xero-auto-refresh'

export async function POST(request: NextRequest) {
  // Ensure tokens are fresh before making Xero API calls
  const tokensFresh = await ensureXeroTokensFresh(20)
  
  if (!tokensFresh) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Token refresh failed',
        message: 'Failed to refresh Xero tokens. Please reconnect to Xero.'
      },
      { status: 401 }
    )
  }
  
  // Proceed with Xero API operations
  const apiService = await createXeroApiService()
  // ... rest of the code
}
```

### In Services

```typescript
import { XeroSyncService } from '@/lib/xero-sync-service'

// XeroSyncService automatically refreshes tokens in initialize()
const syncService = new XeroSyncService(userId)
const initialized = await syncService.initialize()

if (!initialized) {
  // Handle initialization failure (tokens couldn't be refreshed)
  return { success: false, error: 'Failed to initialize Xero connection' }
}

// Proceed with sync operations - tokens are guaranteed fresh
await syncService.pullContacts()
```

## Error Handling

### Token Refresh Failures

When token refresh fails, the system:

1. **Logs the error** with detailed information
2. **Returns false** from `ensureXeroTokensFresh()`
3. **API endpoints return 401** with user-friendly message
4. **Frontend shows reconnect prompt** to user

### Common Failure Scenarios

1. **Refresh token expired**: User must re-authorize (rare, refresh tokens last 60 days)
2. **Network issues**: Temporary failure, retry recommended
3. **Invalid credentials**: Check OAuth configuration
4. **Xero API down**: Wait and retry

## Monitoring

### Logging

The system provides comprehensive logging:

```
🔄 [Enhanced Sync] Ensuring tokens are fresh...
✅ [Token Refresh] Tokens refreshed successfully
✅ [Enhanced Sync] Connection validated and tokens fresh
```

### Database Tracking

Token refresh operations update the `XeroIntegration` table:

- `expiresAt`: New token expiry time
- `accessToken`: New access token
- `refreshToken`: New refresh token (rotated by Xero)
- `updatedAt`: Last refresh timestamp

## Testing

### Manual Testing

1. **Test token refresh**:
   ```bash
   curl -X GET http://localhost:3000/api/xero/check-tokens
   ```

2. **Test connection with auto-refresh**:
   ```bash
   curl -X POST http://localhost:3000/api/xero/test-connection
   ```

3. **Test sync with auto-refresh**:
   ```bash
   curl -X POST http://localhost:3000/api/xero/enhanced-sync \
     -H "Content-Type: application/json" \
     -d '{"syncType": "contacts", "direction": "pull"}'
   ```

### Simulating Token Expiry

To test the refresh mechanism:

1. Manually update `expiresAt` in database to a near-future time:
   ```sql
   UPDATE "XeroIntegration" 
   SET "expiresAt" = NOW() + INTERVAL '10 minutes'
   WHERE "isActive" = true;
   ```

2. Make an API call that triggers token refresh
3. Verify new tokens are obtained and stored

## Best Practices

### For Developers

1. **Always call `ensureXeroTokensFresh()` before Xero API operations**
   - Use 20-minute threshold for standard operations
   - Use 5-minute threshold for quick operations

2. **Handle refresh failures gracefully**
   - Return 401 status code
   - Provide clear error messages
   - Log failures for debugging

3. **Don't refresh too frequently**
   - Use appropriate thresholds
   - Leverage caching where possible
   - Avoid unnecessary API calls

4. **Test token refresh in development**
   - Simulate token expiry
   - Verify error handling
   - Check logging output

### For Users

1. **Initial connection required**: First-time setup still requires OAuth authorization
2. **Automatic thereafter**: No re-authorization needed for 60 days (refresh token lifetime)
3. **Reconnect if needed**: If refresh fails, reconnect via Xero settings page

## Troubleshooting

### Issue: "Token refresh failed" error

**Possible Causes**:
- Refresh token expired (after 60 days)
- OAuth credentials changed
- Network connectivity issues
- Xero API downtime

**Solution**:
1. Check Xero OAuth configuration in `.env`
2. Verify network connectivity
3. Reconnect to Xero via settings page
4. Check Xero API status

### Issue: Frequent re-authorization prompts

**Possible Causes**:
- Token refresh not being called
- Database connection issues
- Token storage failures

**Solution**:
1. Check logs for token refresh attempts
2. Verify database connectivity
3. Ensure `ensureXeroTokensFresh()` is called in API routes
4. Check `XeroIntegration` table for token updates

### Issue: Tokens not being refreshed

**Possible Causes**:
- Threshold too low (tokens expire before refresh)
- Service initialization failures
- Database write failures

**Solution**:
1. Increase refresh threshold (e.g., from 5 to 20 minutes)
2. Check service initialization logs
3. Verify database write permissions
4. Review error logs for specific failures

## Security Considerations

1. **Refresh tokens are sensitive**: Stored encrypted in database
2. **Access tokens are short-lived**: 30-minute expiry by default
3. **Refresh tokens rotate**: Xero issues new refresh token on each refresh
4. **HTTPS required**: All OAuth operations must use HTTPS in production
5. **Environment variables**: Never commit OAuth credentials to version control

## Future Enhancements

1. **Proactive refresh**: Background job to refresh tokens before expiry
2. **Token health monitoring**: Dashboard showing token status
3. **Automatic reconnection**: Prompt users to reconnect before refresh token expires
4. **Multi-tenant support**: Handle multiple Xero connections per organization
5. **Token refresh metrics**: Track refresh success/failure rates

## Related Documentation

- [Xero OAuth Setup](./XERO_OAUTH_SETUP.md)
- [Xero Sync Error Logging](./XERO_SYNC_ERROR_LOGGING.md)
- [Xero Integration Guide](./XERO_INTEGRATION.md)

## Support

For issues related to automatic token refresh:

1. Check application logs for token refresh attempts
2. Verify Xero OAuth configuration
3. Review database for token storage
4. Contact Xero support for OAuth-related issues
5. Refer to [Xero OAuth 2.0 documentation](https://developer.xero.com/documentation/oauth2/overview)

---

**Last Updated**: 2024-01-13
**Version**: 1.0.0
**Maintainer**: Development Team

