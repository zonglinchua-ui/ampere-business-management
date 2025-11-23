
# Xero Two-Way Sync - QA Checklist

## Pre-Deployment Checks

### Database Migration
- [x] Migration file created: `prisma/migrations/20251007_xero_sync_mapping/migration.sql`
- [x] Migration applied successfully: `yarn prisma db execute`
- [x] Prisma client regenerated: `yarn prisma generate`
- [x] Table `xero_sync_mappings` exists in database
- [x] Enums created: `XeroSyncDirection`, `XeroSyncStatus`, `XeroSyncEntityType`
- [x] Indexes created correctly

### Code Compilation
- [x] TypeScript compiles without errors: `yarn tsc --noEmit`
- [x] Next.js builds successfully: `yarn build`
- [x] Dev server starts without errors: `yarn dev`
- [x] No console errors on page load

### File Structure
- [x] `docs/xero-field-mapping.md` created
- [x] `lib/xero-sync-service.ts` created
- [x] `app/api/xero/sync/contacts/route.ts` created
- [x] `docs/XERO_TWO_WAY_SYNC_PHASE_ABC.md` created
- [x] `docs/XERO_SYNC_README.md` created
- [x] No existing files modified (isolated implementation)

---

## Functional Testing

### API Endpoint Tests
- [ ] **Endpoint exists**: `POST /api/xero/sync/contacts` responds (not 404)
- [ ] **Authentication required**: Returns 401 when not logged in
- [ ] **Permission check**: Returns 403 for unauthorized roles (e.g., basic users)
- [ ] **Authorized roles**: SUPERADMIN, FINANCE, PROJECT_MANAGER can access
- [ ] **Valid JSON response**: API returns valid JSON structure

### Contact Sync Tests
- [ ] **Pull all contacts**: Sync 10-20 Xero contacts successfully
- [ ] **Customer classification**: Xero contacts with `IsCustomer=true` create Client records
- [ ] **Supplier classification**: Xero contacts with `IsSupplier=true` create Supplier records
- [ ] **Both classification**: Contacts with both flags create records in BOTH tables
- [ ] **Skip unclassified**: Contacts with neither flag are skipped (logged)
- [ ] **Auto-numbering**: New clients get `CL00001`, `CL00002`, etc.
- [ ] **Auto-numbering**: New suppliers get `SUP00001`, `SUP00002`, etc.
- [ ] **Preserve existing numbers**: Manually-assigned numbers not overwritten

### Data Integrity Tests
- [ ] **No duplicates**: Re-running sync does not create duplicate records
- [ ] **Change detection**: Unchanged contacts are skipped (check logs)
- [ ] **Update existing**: Modified Xero contacts update existing app records
- [ ] **Correct field mapping**: Name, email, phone, address fields populated correctly
- [ ] **Xero metadata stored**: `xeroContactId`, `xeroPhones`, `xeroAddresses` saved as JSON
- [ ] **Timestamps updated**: `lastXeroSync` updated after successful sync

### Sync Mapping Tests
- [ ] **Mapping created**: Each synced contact creates `xero_sync_mappings` record
- [ ] **Correct entity type**: entity_type = 'CONTACT'
- [ ] **Correct IDs**: local_id matches Client/Supplier ID, xero_id matches ContactID
- [ ] **Sync direction**: sync_direction = 'PULL'
- [ ] **Status active**: status = 'ACTIVE'
- [ ] **Change hash calculated**: change_hash is non-null MD5 string
- [ ] **Timestamps**: last_synced_at, created_at, updated_at populated

### Logging Tests
- [ ] **Logs created**: Each sync creates record in `xero_logs` table
- [ ] **Correct entity**: entity = 'CONTACTS'
- [ ] **Correct direction**: direction = 'PULL'
- [ ] **Success status**: status = 'SUCCESS' for successful syncs
- [ ] **Error status**: status = 'ERROR' for failed syncs
- [ ] **Counts accurate**: records_processed, records_succeeded, records_failed match
- [ ] **Duration recorded**: duration field populated in milliseconds
- [ ] **Error details**: error_message and error_stack populated on failures

### Optional Parameters Tests
- [ ] **modifiedSince**: Only syncs contacts modified after specified date
- [ ] **includeArchived**: Archived contacts synced when flag is true
- [ ] **forceRefresh**: Skips change detection when flag is true
- [ ] **Empty request body**: Syncs all active contacts (defaults work)

---

## Error Handling Tests

### Authentication Errors
- [ ] **No session**: Returns 401 with appropriate message
- [ ] **Expired session**: Redirects to login or returns 401
- [ ] **Invalid session**: Returns 401

### Authorization Errors
- [ ] **Insufficient role**: Returns 403 for basic users
- [ ] **Error message clear**: Response explains permission requirement

### Xero Connection Errors
- [ ] **No tokens**: Returns error "Failed to initialize Xero connection"
- [ ] **Expired tokens**: Attempts to refresh, or returns error if refresh fails
- [ ] **Invalid tokens**: Returns error with guidance to reconnect

### API Errors
- [ ] **Network timeout**: Handles gracefully, logs error
- [ ] **Xero 429 (rate limit)**: Logs warning (future: retry logic)
- [ ] **Xero 500 (server error)**: Logs error, does not crash app
- [ ] **Malformed response**: Handles gracefully, logs error

### Data Validation Errors
- [ ] **Missing required fields**: Skips contact, logs error detail
- [ ] **Invalid email format**: Handles gracefully (or uses null)
- [ ] **Invalid phone format**: Handles gracefully (or uses null)
- [ ] **Duplicate emails**: Logs warning (future: conflict resolution)

### Database Errors
- [ ] **Connection failure**: Returns 500 with appropriate message
- [ ] **Constraint violation**: Handles gracefully, logs specific error
- [ ] **Transaction rollback**: Ensures partial data not saved

---

## Performance Tests

### Small Dataset (10-50 contacts)
- [ ] **Sync completes**: In under 10 seconds
- [ ] **No memory leaks**: Memory usage stable after sync
- [ ] **No connection pool exhaustion**: Prisma connections released

### Medium Dataset (100-500 contacts)
- [ ] **Sync completes**: In under 60 seconds (max duration)
- [ ] **Progress logged**: Intermediate progress visible in logs
- [ ] **No timeouts**: API does not timeout

### Large Dataset (500+ contacts)
- [ ] **Pagination handled**: Xero API pagination works correctly
- [ ] **Memory efficient**: Does not load all contacts into memory at once
- [ ] **Rate limiting**: Respects Xero's 60 requests/minute limit

---

## Security Tests

### Input Validation
- [ ] **Request body validated**: Invalid JSON rejected
- [ ] **Date format validated**: Invalid dates rejected or handled
- [ ] **SQL injection prevention**: No raw SQL with user input
- [ ] **XSS prevention**: No unescaped user input in responses

### Token Security
- [ ] **Tokens not logged**: Access/refresh tokens not in console or logs
- [ ] **Tokens not exposed**: Not included in API responses
- [ ] **Token refresh secure**: Uses existing OAuth service

### Permission Enforcement
- [ ] **Role check enforced**: Cannot bypass via request manipulation
- [ ] **User ID validated**: Cannot sync as another user

---

## Rollback Tests

### Database Rollback
- [ ] **Backup created**: Database backup exists before migration
- [ ] **Rollback script works**: Can drop table and enums cleanly
- [ ] **No orphaned data**: Rollback leaves no inconsistent state

### Code Rollback
- [ ] **Files removable**: Can delete new files without breaking app
- [ ] **No dependencies**: Existing code doesn't depend on new sync service
- [ ] **Prisma regeneration**: Can regenerate client after rollback

---

## Documentation Tests

### README Completeness
- [ ] **Purpose clear**: Document explains what the sync does
- [ ] **API documented**: Endpoint, request/response schemas included
- [ ] **Examples provided**: cURL examples work as-is
- [ ] **Troubleshooting guide**: Common errors documented
- [ ] **Rollback instructions**: Clear steps to undo changes

### Field Mapping Document
- [ ] **All fields mapped**: Contact, Invoice, Payment fields documented
- [ ] **Ownership defined**: Clear rules for Xero vs App authority
- [ ] **Edge cases covered**: Duplicate detection, conflicts, etc.
- [ ] **Testing scenarios**: Checklist for comprehensive testing

---

## Integration Tests

### OAuth Token Flow
- [ ] **Reuses existing service**: No OAuth code duplication
- [ ] **Token refresh works**: Expired tokens refreshed automatically
- [ ] **Multiple tenants**: Handles multiple Xero organizations (if applicable)

### Existing Features Unaffected
- [ ] **Contacts module**: Manual client/supplier creation still works
- [ ] **Quotations**: Quotation creation/editing unaffected
- [ ] **Invoices**: Invoice creation/editing unaffected
- [ ] **Projects**: Project management unaffected
- [ ] **Finance settings**: Xero connection UI unaffected

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests above passing
- [ ] Database backup created
- [ ] Migration script reviewed
- [ ] Documentation complete
- [ ] Rollback plan documented

### Deployment Steps
1. [ ] Run migration: `yarn prisma db execute --file prisma/migrations/20251007_xero_sync_mapping/migration.sql`
2. [ ] Regenerate Prisma client: `yarn prisma generate`
3. [ ] Build app: `yarn build`
4. [ ] Deploy to production
5. [ ] Verify endpoint accessible: `POST /api/xero/sync/contacts`

### Post-Deployment
- [ ] Run test sync with small dataset (10 contacts)
- [ ] Verify logs created in `xero_logs`
- [ ] Verify mappings created in `xero_sync_mappings`
- [ ] Check for console errors
- [ ] Monitor performance (response time, memory)

---

## User Acceptance Testing

### Finance Team Tests
- [ ] Can access sync endpoint from UI (future)
- [ ] Sync completes without errors
- [ ] New contacts appear in Clients/Suppliers modules
- [ ] Existing contacts updated correctly
- [ ] Logs viewable and understandable

### Admin Tests
- [ ] Permissions enforced correctly
- [ ] Error messages clear and actionable
- [ ] Rollback procedure works if needed
- [ ] Documentation sufficient for troubleshooting

---

## Success Criteria

All items must be checked before considering Phase C complete:

### Must Have
- [x] Migration applies successfully
- [x] TypeScript compiles without errors
- [x] App builds and runs successfully
- [ ] API endpoint accessible and returns valid responses
- [ ] At least 10 Xero contacts synced successfully
- [ ] No duplicates created on re-run
- [ ] Logs created correctly
- [ ] Mappings created correctly
- [ ] Documentation complete

### Should Have
- [ ] Change detection working (skips unchanged records)
- [ ] Auto-numbering working correctly
- [ ] Error handling comprehensive
- [ ] Performance acceptable (<60s for 100 contacts)

### Nice to Have
- [ ] Detailed error messages for all failure modes
- [ ] Performance optimizations (batching, caching)
- [ ] Admin UI for viewing sync logs

---

## Sign-Off

- [ ] **Developer**: Code reviewed and tested
- [ ] **QA**: All tests passing
- [ ] **Product Owner**: Functionality meets requirements
- [ ] **DevOps**: Deployment plan reviewed

---

## Notes

Any issues or edge cases discovered during testing:

```
[Add notes here]
```

---

## Version History
- **v1.0** (2025-10-07): Initial QA checklist for Phase C
