# WhatsApp Alerts Settings - Implementation Guide

## Overview

This document describes the comprehensive WhatsApp alerts settings system for super admins. The system allows fine-grained control over various notification types, timing, recipients, and message templates.

## Architecture

### Database Schema

The system uses four main tables:

1. **WhatsAppAlertSettings** - Configuration for each alert type
2. **WhatsAppRoleRecipients** - Phone numbers for role-based notifications
3. **WhatsAppGlobalSettings** - System-wide settings
4. **WhatsAppNotificationLog** - Audit trail of all notifications

### API Endpoints

All endpoints require **SUPER_ADMIN** role authentication.

#### Alert Settings Management

**GET /api/admin/whatsapp-alerts/settings**
- Get all alert settings
- Returns array of alert configurations

**POST /api/admin/whatsapp-alerts/settings**
- Create or update alert setting
- Body: `{ alertType, enabled, timingConfig, recipientConfig, thresholdConfig, messageTemplate }`

**GET /api/admin/whatsapp-alerts/settings/[alertType]**
- Get specific alert setting
- Returns single alert configuration

**DELETE /api/admin/whatsapp-alerts/settings/[alertType]**
- Delete alert setting

#### Global Settings

**GET /api/admin/whatsapp-alerts/global-settings**
- Get global WhatsApp settings
- Returns quiet hours, rate limits, WAHA connection details

**PUT /api/admin/whatsapp-alerts/global-settings**
- Update global settings
- Body: `{ quietHoursStart, quietHoursEnd, defaultCountryCode, maxMessagesPerHour, testMode, testPhoneNumber, wahaApiUrl, wahaApiKey, wahaSession, enabled }`

#### Role Recipients

**GET /api/admin/whatsapp-alerts/role-recipients**
- Get all role recipient configurations
- Returns array of roles with phone numbers

**POST /api/admin/whatsapp-alerts/role-recipients**
- Create or update role recipients
- Body: `{ roleName, phoneNumbers[], enabled }`
- Validates phone number format

#### Notification Logs

**GET /api/admin/whatsapp-alerts/logs**
- Get notification logs with filtering
- Query params: `page`, `limit`, `alertType`, `status`, `recipientPhone`, `startDate`, `endDate`
- Returns logs with pagination and statistics

#### Testing

**POST /api/admin/whatsapp-alerts/test**
- Send test notification
- Body: `{ phoneNumber, message, alertType }`
- Validates phone format and logs result

#### Initialization

**POST /api/admin/whatsapp-alerts/initialize**
- Initialize default alert settings
- Creates 10 pre-configured alert types
- Skips existing alerts

## Alert Types

### Currently Implemented (Phase 1)

1. **TENDER_DEADLINE** - Tender submission deadline reminders
2. **TASK_DEADLINE** - Task due date reminders
3. **INVOICE_OVERDUE** - Invoice payment reminders
4. **PROGRESS_CLAIM_SUBMISSION** - Progress claim submission reminders
5. **BUDGET_THRESHOLD** - Project budget threshold alerts

### Additional Alert Types (Configured in Initialize)

6. **DOCUMENT_PENDING_APPROVAL** - Document approval reminders
7. **PO_PENDING_APPROVAL** - Purchase order approval reminders
8. **PROJECT_STATUS_CHANGE** - Project status change notifications
9. **PAYMENT_RECEIVED** - Payment confirmation notifications
10. **QUOTATION_EXPIRING** - Quotation expiry reminders

### Proposed for Future Implementation

- Contract expiry alerts
- Service job scheduling
- Low stock alerts
- User inactivity alerts
- System error alerts
- Backup status notifications

## Configuration Structure

### Alert Setting Object

```json
{
  "id": "cuid",
  "alertType": "TENDER_DEADLINE",
  "enabled": true,
  "timingConfig": {
    "daysBefore": [7, 3, 1],
    "daysAfter": [1, 3, 7]
  },
  "recipientConfig": {
    "sendToAssigned": true,
    "sendToManager": false,
    "sendToCustomer": true,
    "sendToSalesTeam": false
  },
  "thresholdConfig": {
    "minAmount": 1000,
    "percentage": 75
  },
  "messageTemplate": "🔔 *Alert Title*\n\nDetails: {variable}\n\nAction required.",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### Global Settings Object

```json
{
  "id": "cuid",
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00",
  "defaultCountryCode": "+65",
  "maxMessagesPerHour": 100,
  "testMode": false,
  "testPhoneNumber": "+6591234567",
  "wahaApiUrl": "http://localhost:3001",
  "wahaApiKey": "your_api_key",
  "wahaSession": "default",
  "enabled": true
}
```

### Role Recipients Object

```json
{
  "id": "cuid",
  "roleName": "FINANCE_TEAM",
  "phoneNumbers": ["+6591234567", "+6587654321"],
  "enabled": true
}
```

## Message Template Variables

Available variables for message templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{user_name}` | Recipient's name | John Tan |
| `{project_number}` | Project number | P2025-001 |
| `{project_name}` | Project name | Office Renovation |
| `{tender_number}` | Tender number | T2025-001 |
| `{tender_name}` | Tender name | Construction Project |
| `{invoice_number}` | Invoice number | INV-2025-123 |
| `{amount}` | Formatted amount | $9,000.00 |
| `{due_date}` | Formatted due date | 15 Nov 2025 |
| `{days_remaining}` | Days remaining | 3 |
| `{company_name}` | Company name | ABC Company |
| `{contact_person}` | Contact person | Jane Doe |
| `{status}` | Current status | PENDING |
| `{task_title}` | Task title | Review Documents |
| `{document_name}` | Document name | Contract.pdf |
| `{customer_name}` | Customer name | XYZ Corp |
| `{supplier_name}` | Supplier name | Supplier Ltd |
| `{po_number}` | PO number | PO-2025-001 |
| `{quotation_number}` | Quotation number | Q2025-001 |
| `{claim_number}` | Claim number | PC-001 |
| `{percentage}` | Percentage value | 85% |
| `{old_status}` | Previous status | PLANNING |
| `{new_status}` | New status | IN_PROGRESS |
| `{changed_by}` | User who made change | Admin User |

## User Preferences

Each user can configure their own WhatsApp notification preferences:

### User Model Fields

```typescript
{
  phone: string | null
  whatsappNotifications: boolean  // Global enable/disable
  whatsappAlertPreferences: {     // Per-alert-type preferences
    "TENDER_DEADLINE": true,
    "INVOICE_OVERDUE": false,
    // ...
  }
  quietHoursStart: string | null  // Personal quiet hours
  quietHoursEnd: string | null
}
```

## Setup Instructions

### 1. Run Database Migration

```bash
npx prisma migrate dev --name add_whatsapp_alerts_settings
```

### 2. Initialize Default Alert Settings

```bash
curl -X POST http://localhost:3000/api/admin/whatsapp-alerts/initialize \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Configure Global Settings

```bash
curl -X PUT http://localhost:3000/api/admin/whatsapp-alerts/global-settings \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wahaApiUrl": "http://localhost:3001",
    "wahaApiKey": "your_waha_api_key",
    "wahaSession": "default",
    "enabled": true,
    "defaultCountryCode": "+65",
    "maxMessagesPerHour": 100,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  }'
```

### 4. Configure Role Recipients

```bash
curl -X POST http://localhost:3000/api/admin/whatsapp-alerts/role-recipients \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleName": "FINANCE_TEAM",
    "phoneNumbers": ["+6591234567", "+6587654321"],
    "enabled": true
  }'
```

### 5. Test Notifications

```bash
curl -X POST http://localhost:3000/api/admin/whatsapp-alerts/test \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+6591234567",
    "message": "This is a test notification from Ampere Business Management System.",
    "alertType": "TEST"
  }'
```

## UI Components (To Be Implemented)

### 1. Settings Dashboard (`/settings/whatsapp-alerts`)

**Features:**
- Overview cards showing enabled/disabled alerts
- WAHA connection status indicator
- Quick enable/disable toggles
- Recent notifications summary
- Statistics: sent today, failed, pending

### 2. Alert Configuration Page (`/settings/whatsapp-alerts/[alertType]`)

**Features:**
- Enable/disable toggle
- Timing configuration (days before/after)
- Recipient selection checkboxes
- Threshold settings (amounts, percentages)
- Message template editor with:
  - Variable picker dropdown
  - Preview panel
  - Emoji picker
- Test notification button
- Save and reset buttons

### 3. Global Settings Page (`/settings/whatsapp-alerts/global`)

**Features:**
- WAHA connection settings
- Connection test button
- Quiet hours time pickers
- Default country code selector
- Rate limiting slider
- Test mode toggle with test phone input

### 4. Role Recipients Page (`/settings/whatsapp-alerts/recipients`)

**Features:**
- Table of roles with phone numbers
- Add/edit/delete phone numbers
- Bulk import from CSV
- Phone number validation
- Test send to role button
- Enable/disable per role

### 5. Notification Logs Page (`/settings/whatsapp-alerts/logs`)

**Features:**
- Filterable table:
  - Alert type filter
  - Status filter (SENT, FAILED, QUEUED, SKIPPED)
  - Date range picker
  - Phone number search
- Statistics cards
- Export to CSV button
- Retry failed notifications button
- View message content modal

## Best Practices

### Message Templates

1. **Keep it concise** - WhatsApp messages should be brief and to the point
2. **Use emojis** - Makes messages more engaging and easier to scan
3. **Include action items** - Clearly state what the recipient should do
4. **Use formatting** - Bold text with `*text*` for emphasis
5. **Test thoroughly** - Always test templates before enabling

### Timing Configuration

1. **Don't over-notify** - Too many reminders can be annoying
2. **Consider business hours** - Use quiet hours to avoid late-night messages
3. **Escalate gradually** - Increase frequency as deadline approaches
4. **Respect user preferences** - Allow users to opt-out of specific alerts

### Recipient Configuration

1. **Be selective** - Only send to relevant parties
2. **Use roles wisely** - Configure role recipients for team notifications
3. **Validate phone numbers** - Always validate format before saving
4. **Test with small groups** - Test with a few users before rolling out

### Rate Limiting

1. **Set reasonable limits** - Default 100 messages/hour is usually sufficient
2. **Monitor logs** - Check for patterns of excessive messaging
3. **Use test mode** - Test thoroughly before enabling production mode

## Troubleshooting

### Notifications Not Sending

1. Check WAHA connection status
2. Verify WAHA API key is correct
3. Check WhatsApp session is active (scan QR code if needed)
4. Verify recipient phone numbers are valid
5. Check notification logs for error messages

### Messages Being Skipped

1. Check if user has WhatsApp notifications enabled
2. Verify user has a valid phone number
3. Check if within quiet hours
4. Verify alert type is enabled
5. Check if threshold conditions are met

### Too Many Notifications

1. Review timing configuration
2. Adjust threshold settings
3. Enable quiet hours
4. Reduce rate limit
5. Allow users to customize preferences

## Security Considerations

1. **API Key Protection** - Store WAHA API key securely in environment variables
2. **Role-Based Access** - Only SUPER_ADMIN can access settings
3. **Phone Number Privacy** - Log phone numbers securely
4. **Rate Limiting** - Prevent abuse with message limits
5. **Audit Trail** - All notifications are logged for accountability

## Future Enhancements

1. **Scheduled Reports** - Daily/weekly summary of notifications sent
2. **A/B Testing** - Test different message templates
3. **Analytics Dashboard** - Engagement metrics, open rates
4. **Multi-language Support** - Templates in different languages
5. **Rich Media** - Support for images and documents
6. **Two-way Communication** - Handle replies from recipients
7. **Notification Groups** - Batch notifications for efficiency
8. **Custom Variables** - Allow admins to define custom variables
9. **Conditional Logic** - Send different messages based on conditions
10. **Integration with Calendar** - Schedule one-time notifications

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review notification logs for errors
3. Test with a single phone number first
4. Contact system administrator

## Changelog

### Version 1.0.0 (Current)
- Initial implementation
- 10 default alert types
- Role-based recipients
- Global settings management
- Notification logging
- Test functionality
- API endpoints for all operations
