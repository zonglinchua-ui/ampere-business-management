
# Xero Two-Way Sync - User Guide

## Overview

The Xero Two-Way Sync system provides safe, auditable bidirectional data synchronization between Xero and the web application. This implementation focuses on **Contacts** (Phase C complete), with **Invoices** and **Payments** sync planned for future phases.

---

## Features (Phase A, B, C)

### ✅ Implemented
- **Contacts Pull (Xero → App)**: Automatically creates/updates Clients and Suppliers based on Xero contacts
- **Smart Classification**: Handles contacts that are both Customers and Suppliers
- **Auto-Numbering**: Assigns client numbers (CL00001) and supplier numbers (SUP00001) automatically
- **Change Detection**: Only syncs records that have actually changed (via MD5 hash)
- **Idempotent Operations**: Safe to re-run without creating duplicates
- **Comprehensive Logging**: All operations logged to `xero_logs` table
- **Sync Mappings**: Maintains bidirectional mapping in `xero_sync_mappings` table

### 🚧 Planned (Future Phases)
- Invoice Push (App → Xero)
- Payments Pull (Xero → App)
- Webhooks for real-time updates
- Conflict resolution UI
- Sync status dashboard

---

## API Endpoints

### POST /api/xero/sync/contacts

Pulls contacts from Xero and creates/updates local Client/Supplier records.

**Authentication:** Required  
**Permissions:** SUPERADMIN, FINANCE, PROJECT_MANAGER

#### Request Body (Optional)
```json
{
  "modifiedSince": "2025-01-01T00:00:00Z",  // Only sync contacts modified after this date
  "includeArchived": false,                  // Include archived contacts
  "forceRefresh": false                      // Force sync even if unchanged
}
```

#### Response (Success)
```json
{
  "success": true,
  "message": "Successfully synced 42 contacts (15 created, 20 updated, 7 skipped)",
  "created": 15,
  "updated": 20,
  "skipped": 7,
  "errors": 0,
  "errorDetails": [],
  "logId": "clxxx..."
}
```

#### Response (Partial Success)
```json
{
  "success": false,
  "message": "Synced with 2 errors (15 created, 18 updated, 7 skipped, 2 failed)",
  "created": 15,
  "updated": 18,
  "skipped": 7,
  "errors": 2,
  "errorDetails": [
    "Contact ABC Ltd: Missing required field 'name'",
    "Contact XYZ Corp: Duplicate email detected"
  ],
  "logId": "clxxx..."
}
```

#### Response (Error)
```json
{
  "success": false,
  "error": "Failed to initialize Xero connection",
  "message": "An unexpected error occurred during contact synchronization"
}
```

---

## How It Works

### Contact Classification

Xero contacts are classified based on `IsCustomer` and `IsSupplier` flags:

| IsCustomer | IsSupplier | Result |
|------------|-----------|--------|
| ✅ | ❌ | Creates record in **Client** table |
| ❌ | ✅ | Creates record in **Supplier** table |
| ✅ | ✅ | Creates records in **BOTH** tables |
| ❌ | ❌ | **Skipped** (logged as warning) |

### Auto-Numbering

- **Clients**: `CL00001`, `CL00002`, `CL00003`, ...
- **Suppliers**: `SUP00001`, `SUP00002`, `SUP00003`, ...

Numbers are auto-assigned **only if** the field is empty. Existing manually-assigned numbers are preserved.

### Change Detection

Each contact's relevant fields (name, email, phone, addresses, etc.) are hashed using MD5. If the hash matches the previous sync, the record is **skipped** to avoid unnecessary database writes.

### Sync Mappings

Every synced record creates an entry in `xero_sync_mappings`:

| Field | Description |
|-------|-------------|
| entity_type | 'CONTACT', 'INVOICE', 'PAYMENT' |
| local_id | App record ID (Client or Supplier) |
| xero_id | Xero ContactID |
| last_synced_at | Timestamp of last sync |
| sync_direction | 'PULL', 'PUSH', 'BOTH' |
| change_hash | MD5 hash for change detection |
| status | 'ACTIVE', 'ARCHIVED', 'ERROR', 'CONFLICT' |

---

## Usage Examples

### 1. Full Sync (All Contacts)
```bash
curl -X POST https://ampere.abacusai.app/api/xero/sync/contacts \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{}'
```

### 2. Incremental Sync (Only Recent Changes)
```bash
curl -X POST https://ampere.abacusai.app/api/xero/sync/contacts \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "modifiedSince": "2025-10-01T00:00:00Z"
  }'
```

### 3. Force Refresh (Ignore Change Detection)
```bash
curl -X POST https://ampere.abacusai.app/api/xero/sync/contacts \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "forceRefresh": true
  }'
```

---

## Monitoring & Logs

### Viewing Sync Logs

All sync operations are logged to the `xero_logs` table. You can view them via:

1. **Admin UI** (coming in Phase G)
2. **Direct database query**:
   ```sql
   SELECT 
     timestamp,
     entity,
     direction,
     status,
     records_processed,
     records_succeeded,
     records_failed,
     message,
     error_message
   FROM xero_logs
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY timestamp DESC
   LIMIT 20;
   ```

### Viewing Sync Mappings

Check the bidirectional mappings:

```sql
SELECT 
  entity_type,
  local_id,
  xero_id,
  last_synced_at,
  sync_direction,
  status
FROM xero_sync_mappings
WHERE entity_type = 'CONTACT'
ORDER BY last_synced_at DESC
LIMIT 20;
```

---

## Troubleshooting

### "Failed to initialize Xero connection"
**Cause:** OAuth tokens expired or not found  
**Solution:** Reconnect to Xero via Finance Settings → Xero Integration

### "Insufficient permissions"
**Cause:** User role not authorized  
**Solution:** Only SUPERADMIN, FINANCE, and PROJECT_MANAGER can run syncs

### "Contact XYZ skipped - no customer/supplier flag"
**Cause:** Xero contact has neither `IsCustomer` nor `IsSupplier` set to true  
**Solution:** Update the contact in Xero to set the appropriate flag

### "Duplicate email detected"
**Cause:** Multiple Xero contacts with the same email address  
**Solution:** Manual conflict resolution required (coming in Phase G)

### Sync takes too long
**Cause:** Syncing thousands of contacts at once  
**Solution:** Use `modifiedSince` parameter for incremental syncs

---

## Safety & Rollback

### Pre-Sync Safety
- All operations are logged
- Database transactions ensure atomicity
- Change detection prevents unnecessary updates
- Idempotent operations (safe to re-run)

### Rollback Procedure

If you need to rollback a sync:

1. **Identify the sync log ID** from the API response
2. **Query the sync mappings created in that sync:**
   ```sql
   SELECT * FROM xero_sync_mappings
   WHERE created_at >= 'SYNC_TIMESTAMP'
   AND entity_type = 'CONTACT';
   ```
3. **Delete the created/updated records** (if needed):
   ```sql
   -- WARNING: This will delete records!
   DELETE FROM clients WHERE xero_contact_id IN (SELECT xero_id FROM ...);
   DELETE FROM suppliers WHERE xero_contact_id IN (SELECT xero_id FROM ...);
   ```
4. **Delete the sync mappings:**
   ```sql
   DELETE FROM xero_sync_mappings WHERE id IN (...);
   ```

**⚠️ Important:** Always backup your database before performing rollbacks!

---

## Performance Considerations

### Batch Size
- Xero API returns up to 100 contacts per page by default
- The sync service processes all pages sequentially
- Large syncs (1000+ contacts) may take 30-60 seconds

### Rate Limits
- Xero allows 60 requests per minute
- The service automatically handles rate limiting
- Future implementation will add exponential backoff for 429 errors

### Database Performance
- Indexes on `xeroContactId` ensure fast lookups
- Change detection minimizes unnecessary updates
- Transactions ensure data consistency

---

## Data Ownership Rules

### Contacts
**Primary Owner:** Xero  
**Sync Direction:** Pull (Xero → App)  
**Updates:** App always adopts Xero data (Xero wins)

### Future: Invoices
**Primary Owner:** App  
**Sync Direction:** Push (App → Xero) on explicit user action  
**Updates:** App data pushed to Xero, status/payments pulled back

### Future: Payments
**Primary Owner:** Xero  
**Sync Direction:** Pull (Xero → App)  
**Updates:** App always adopts Xero payment data

---

## Field Mapping Reference

For detailed field mappings, see: `docs/xero-field-mapping.md`

### Key Contact Fields
- **Name** → Client.name / Supplier.name
- **Email** → Client.email / Supplier.email (first email from Xero)
- **Phone** → Client.phone / Supplier.phone (first phone from Xero)
- **Addresses** → Client.address, city, state, postalCode
- **TaxNumber** → Client.companyReg / Supplier.companyReg
- **ContactPersons** → Client.contactPerson / Supplier.contactPerson

---

## FAQ

### Q: Will this create duplicate contacts?
**A:** No. The sync service checks for existing `xeroContactId` first. If found, it updates the existing record. Otherwise, it creates a new one.

### Q: What happens if I manually create a client before syncing?
**A:** If the manually-created client doesn't have a `xeroContactId`, it will remain separate. The Xero contact will create a new record. Future enhancement: merge by email detection.

### Q: Can I push app-created clients to Xero?
**A:** Not yet. Phase D (Invoice Push) will include contact push functionality.

### Q: How do I know if a contact is synced?
**A:** Check the `isXeroSynced` field and `xeroContactId` on the Client/Supplier record. Also check `xero_sync_mappings` table.

### Q: Can I sync archived Xero contacts?
**A:** Yes, set `includeArchived: true` in the request body.

---

## Next Steps

After Phase C completion, the following phases will be implemented:

- **Phase D**: Invoice Push (App → Xero)
- **Phase E**: Payments Pull (Xero → App)
- **Phase F**: Webhooks for real-time updates
- **Phase G**: Sync Status UI and conflict resolution
- **Phase H**: Enhanced monitoring and safety features

---

## Support

For issues or questions:
1. Check the `xero_logs` table for error details
2. Review the sync mappings in `xero_sync_mappings`
3. Contact your system administrator
4. Refer to `docs/xero-field-mapping.md` for detailed specifications

---

## Version History
- **v1.0** (2025-10-07): Phase C (Contacts Pull) implemented
