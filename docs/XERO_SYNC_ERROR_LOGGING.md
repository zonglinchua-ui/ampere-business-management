# Xero Sync Error Logging Integration Guide

This document explains how to integrate the new Xero sync error logging system into your existing sync code.

## Overview

The error logging system tracks:
- ✅ Successful syncs
- ❌ Failed syncs
- ⏭️ Skipped syncs
- ⚠️ Partial syncs

## Quick Start

### 1. Import the Logger

```typescript
import { logSyncSuccess, logSyncFailure, logSyncSkipped } from '@/lib/xero-sync-error-logger'
```

### 2. Log Sync Operations

#### Log Success
```typescript
await logSyncSuccess(
  'CONTACT',  // syncType
  customer.id,  // entityId
  customer.name,  // entityName
  xeroContact.contactID  // xeroId
)
```

#### Log Failure
```typescript
catch (error) {
  await logSyncFailure(
    'CONTACT',  // syncType
    error,  // error object or string
    customer.id,  // entityId
    customer.name,  // entityName
    xeroContact?.contactID,  // xeroId (optional)
    { /* additional context */ }  // errorDetails (optional)
  )
}
```

#### Log Skipped
```typescript
if (shouldSkip) {
  await logSyncSkipped(
    'CONTACT',  // syncType
    'Contact already up to date',  // reason
    customer.id,  // entityId
    customer.name  // entityName
  )
}
```

## Integration Examples

### Example 1: Contact Sync

```typescript
// In lib/xero-contact-sync.ts

import { logSyncSuccess, logSyncFailure, logSyncSkipped } from '@/lib/xero-sync-error-logger'

async function syncContactToXero(customer: Customer) {
  try {
    // Check if sync needed
    if (customer.xeroSyncHash === calculateHash(customer)) {
      await logSyncSkipped(
        'CONTACT',
        'No changes detected',
        customer.id,
        customer.name,
        customer.xeroContactId
      )
      return
    }

    // Perform sync
    const xeroContact = await xeroClient.contacts.create(...)
    
    // Log success
    await logSyncSuccess(
      'CONTACT',
      customer.id,
      customer.name,
      xeroContact.contactID
    )
    
  } catch (error) {
    // Log failure
    await logSyncFailure(
      'CONTACT',
      error,
      customer.id,
      customer.name,
      customer.xeroContactId,
      { 
        operation: 'create',
        customerData: customer 
      }
    )
    throw error
  }
}
```

### Example 2: Invoice Sync

```typescript
// In lib/xero-invoice-sync-enhanced.ts

import { logSyncSuccess, logSyncFailure } from '@/lib/xero-sync-error-logger'

async function syncInvoiceToXero(invoice: Invoice) {
  try {
    const xeroInvoice = await xeroClient.invoices.create(...)
    
    await logSyncSuccess(
      'INVOICE',
      invoice.id,
      invoice.invoiceNumber,
      xeroInvoice.invoiceID
    )
    
  } catch (error) {
    await logSyncFailure(
      'INVOICE',
      error,
      invoice.id,
      invoice.invoiceNumber,
      undefined,
      { invoiceData: invoice }
    )
  }
}
```

### Example 3: Batch Sync with Error Tracking

```typescript
async function batchSyncContacts(contacts: Customer[]) {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0
  }

  for (const contact of contacts) {
    try {
      if (shouldSkip(contact)) {
        await logSyncSkipped('CONTACT', 'Archived', contact.id, contact.name)
        results.skipped++
        continue
      }

      await syncContactToXero(contact)
      await logSyncSuccess('CONTACT', contact.id, contact.name, contact.xeroContactId)
      results.success++
      
    } catch (error) {
      await logSyncFailure('CONTACT', error, contact.id, contact.name)
      results.failed++
    }
  }

  return results
}
```

## Sync Types

Available sync types:
- `CONTACT` - Customer/Supplier contacts
- `INVOICE` - Customer invoices
- `PAYMENT` - Payments
- `BILL` - Supplier bills
- `ITEM` - Inventory items
- `ACCOUNT` - Chart of accounts
- `OTHER` - Other entity types

## Viewing Logs

Users can view sync errors and duplicates at:
**`/xero/data-quality`**

This page shows:
- 📊 Error statistics
- ❌ Failed syncs with details
- ⏭️ Skipped syncs
- 👥 Duplicate contact detection
- ✅ Mark errors as resolved

## API Endpoints

### Get Sync Errors
```
GET /api/xero/sync-errors?limit=100&status=FAILED&syncType=CONTACT
```

### Resolve Error
```
POST /api/xero/sync-errors
Body: { logId: "...", notes: "Fixed manually" }
```

### Get Duplicates
```
GET /api/contacts/duplicates?threshold=0.8
```

## Database Schema

The `XeroSyncLog` table stores:
- `syncType` - Type of entity (CONTACT, INVOICE, etc.)
- `status` - SUCCESS, FAILED, SKIPPED, PARTIAL
- `entityId` - Local database ID
- `entityName` - Human-readable name
- `xeroId` - Xero entity ID
- `errorMessage` - Error description
- `errorDetails` - Full error context (JSON)
- `attemptCount` - Number of retry attempts
- `resolvedAt` - When error was resolved
- `resolvedBy` - Who resolved it

## Best Practices

1. **Always log errors** - Even if you handle them gracefully
2. **Include context** - Add relevant data to `errorDetails`
3. **Use descriptive names** - Make `entityName` human-readable
4. **Don't throw from logger** - Logging errors won't break your sync
5. **Review regularly** - Check `/xero/data-quality` weekly

## Migration

To apply the database changes:

```bash
cd C:\ampere\ampere_business_management
npx prisma migrate dev
npx prisma generate
```

## Troubleshooting

### Logger not working?
- Check database connection
- Verify Prisma client is generated
- Check console for logger errors

### Errors not showing in UI?
- Verify API endpoints are accessible
- Check browser console for errors
- Ensure user is authenticated

## Next Steps

1. Run the migration: `npx prisma migrate dev`
2. Install dependencies: `pnpm install fast-levenshtein`
3. Add logging calls to your sync code
4. Test with a few syncs
5. Visit `/xero/data-quality` to view results

