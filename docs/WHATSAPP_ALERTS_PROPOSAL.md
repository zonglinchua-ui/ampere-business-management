# WhatsApp Alerts Settings - Comprehensive Proposal

## Overview
This document outlines the proposed WhatsApp alerts system with comprehensive settings for super admins to configure various notification types, timing, and recipients.

## Alert Categories

### 1. **Deadline & Due Date Alerts**

#### 1.1 Tender Deadlines
- **Recipients:** Assigned user, Sales team, Super admins
- **Configurable Settings:**
  - Enable/Disable
  - Days before deadline: 7, 5, 3, 2, 1 days (multi-select)
  - Send to assigned user (Yes/No)
  - Send to sales team (Yes/No)
  - Send to super admins (Yes/No)
  - Include tender details (Yes/No)
  - Custom message template

#### 1.2 Task Deadlines
- **Recipients:** Assigned user, Task creator, Project manager
- **Configurable Settings:**
  - Enable/Disable
  - Days before deadline: 5, 3, 2, 1 days (multi-select)
  - Send to assigned user (Yes/No)
  - Send to task creator (Yes/No)
  - Send to project manager (Yes/No)
  - Priority filter: All / High & Critical only
  - Custom message template

#### 1.3 Project Milestones
- **Recipients:** Project manager, Customer, Super admins
- **Configurable Settings:**
  - Enable/Disable
  - Days before milestone: 7, 5, 3 days (multi-select)
  - Send to project manager (Yes/No)
  - Send to customer (Yes/No)
  - Send to super admins (Yes/No)
  - Custom message template

#### 1.4 Contract Expiry
- **Recipients:** Project manager, Sales team, Super admins
- **Configurable Settings:**
  - Enable/Disable
  - Days before expiry: 90, 60, 30, 14, 7 days (multi-select)
  - Send to project manager (Yes/No)
  - Send to sales team (Yes/No)
  - Send to super admins (Yes/No)
  - Custom message template

### 2. **Financial Alerts**

#### 2.1 Outstanding Invoices
- **Recipients:** Customer, Finance team, Super admins
- **Configurable Settings:**
  - Enable/Disable
  - Days before due date: 7, 3, 1 days (multi-select)
  - Days after due date (overdue): 1, 3, 7, 14, 30 days (multi-select)
  - Send to customer (Yes/No)
  - Send to finance team (Yes/No)
  - Send to super admins (Yes/No)
  - Minimum amount threshold (SGD)
  - Custom message template for reminder
  - Custom message template for overdue

#### 2.2 Payment Received
- **Recipients:** Project manager, Finance team, Customer
- **Configurable Settings:**
  - Enable/Disable
  - Send to project manager (Yes/No)
  - Send to finance team (Yes/No)
  - Send to customer (Yes/No)
  - Minimum amount threshold (SGD)
  - Custom message template

#### 2.3 Budget Threshold Alerts
- **Recipients:** Project manager, Finance team, Super admins
- **Configurable Settings:**
  - Enable/Disable
  - Threshold percentages: 50%, 75%, 90%, 100%, 110% (multi-select)
  - Send to project manager (Yes/No)
  - Send to finance team (Yes/No)
  - Send to super admins (Yes/No)
  - Custom message template

#### 2.4 Supplier Invoice Pending Approval
- **Recipients:** Approver, Finance team, Project manager
- **Configurable Settings:**
  - Enable/Disable
  - Days pending: 2, 5, 7 days (multi-select)
  - Send to approver (Yes/No)
  - Send to finance team (Yes/No)
  - Send to project manager (Yes/No)
  - Minimum amount threshold (SGD)
  - Custom message template

#### 2.5 Progress Claim Submission
- **Recipients:** Project manager, Customer, Finance team
- **Configurable Settings:**
  - Enable/Disable
  - Days before submission: 5, 3, 2 days (multi-select)
  - Send to project manager (Yes/No)
  - Send to customer (Yes/No)
  - Send to finance team (Yes/No)
  - Custom message template

### 3. **Project Status Alerts**

#### 3.1 Project Status Changes
- **Recipients:** Project manager, Customer, Team members
- **Configurable Settings:**
  - Enable/Disable
  - Status changes to notify: Planning, In Progress, On Hold, Completed, Cancelled (multi-select)
  - Send to project manager (Yes/No)
  - Send to customer (Yes/No)
  - Send to team members (Yes/No)
  - Custom message template per status

#### 3.2 Project Delay Alerts
- **Recipients:** Project manager, Customer, Super admins
- **Configurable Settings:**
  - Enable/Disable
  - Delay threshold: 1, 3, 7 days (multi-select)
  - Send to project manager (Yes/No)
  - Send to customer (Yes/No)
  - Send to super admins (Yes/No)
  - Custom message template

#### 3.3 Project Completion
- **Recipients:** Project manager, Customer, Finance team
- **Configurable Settings:**
  - Enable/Disable
  - Send to project manager (Yes/No)
  - Send to customer (Yes/No)
  - Send to finance team (Yes/No)
  - Custom message template

### 4. **Document & Approval Alerts**

#### 4.1 Document Pending Approval
- **Recipients:** Approver, Document submitter
- **Configurable Settings:**
  - Enable/Disable
  - Days pending: 2, 5, 7 days (multi-select)
  - Send to approver (Yes/No)
  - Send to submitter (Yes/No)
  - Document types: All / Specific types (multi-select)
  - Custom message template

#### 4.2 Document Approved/Rejected
- **Recipients:** Document submitter, Project manager
- **Configurable Settings:**
  - Enable/Disable
  - Send to submitter (Yes/No)
  - Send to project manager (Yes/No)
  - Custom message template for approval
  - Custom message template for rejection

#### 4.3 Quotation Submitted
- **Recipients:** Customer, Sales team, Super admins
- **Configurable Settings:**
  - Enable/Disable
  - Send to customer (Yes/No)
  - Send to sales team (Yes/No)
  - Send to super admins (Yes/No)
  - Minimum quotation amount (SGD)
  - Custom message template

#### 4.4 Quotation Expiring
- **Recipients:** Customer, Sales team
- **Configurable Settings:**
  - Enable/Disable
  - Days before expiry: 7, 3, 1 days (multi-select)
  - Send to customer (Yes/No)
  - Send to sales team (Yes/No)
  - Custom message template

### 5. **Purchase Order Alerts**

#### 5.1 PO Pending Approval
- **Recipients:** Approver, Requester, Finance team
- **Configurable Settings:**
  - Enable/Disable
  - Days pending: 2, 5 days (multi-select)
  - Send to approver (Yes/No)
  - Send to requester (Yes/No)
  - Send to finance team (Yes/No)
  - Minimum PO amount (SGD)
  - Custom message template

#### 5.2 PO Approved
- **Recipients:** Requester, Supplier, Finance team
- **Configurable Settings:**
  - Enable/Disable
  - Send to requester (Yes/No)
  - Send to supplier (Yes/No)
  - Send to finance team (Yes/No)
  - Custom message template

#### 5.3 PO Delivery Due
- **Recipients:** Requester, Project manager, Supplier
- **Configurable Settings:**
  - Enable/Disable
  - Days before delivery: 3, 1 days (multi-select)
  - Send to requester (Yes/No)
  - Send to project manager (Yes/No)
  - Send to supplier (Yes/No)
  - Custom message template

### 6. **System & Operational Alerts**

#### 6.1 New User Registration
- **Recipients:** Super admins, HR team
- **Configurable Settings:**
  - Enable/Disable
  - Send to super admins (Yes/No)
  - Send to HR team (Yes/No)
  - Custom message template

#### 6.2 User Inactivity
- **Recipients:** User, User's manager, HR team
- **Configurable Settings:**
  - Enable/Disable
  - Days inactive: 7, 14, 30 days (multi-select)
  - Send to user (Yes/No)
  - Send to user's manager (Yes/No)
  - Send to HR team (Yes/No)
  - Custom message template

#### 6.3 System Errors
- **Recipients:** Super admins, IT team
- **Configurable Settings:**
  - Enable/Disable
  - Error severity: Critical / High / All (multi-select)
  - Send to super admins (Yes/No)
  - Send to IT team (Yes/No)
  - Custom message template

#### 6.4 Backup Status
- **Recipients:** Super admins, IT team
- **Configurable Settings:**
  - Enable/Disable
  - Frequency: Daily / Weekly / Monthly
  - Send to super admins (Yes/No)
  - Send to IT team (Yes/No)
  - Custom message template

### 7. **Service Contract Alerts**

#### 7.1 Service Job Scheduled
- **Recipients:** Assigned technician, Customer, Service manager
- **Configurable Settings:**
  - Enable/Disable
  - Days before service: 3, 1 days (multi-select)
  - Send to assigned technician (Yes/No)
  - Send to customer (Yes/No)
  - Send to service manager (Yes/No)
  - Custom message template

#### 7.2 Service Job Completed
- **Recipients:** Customer, Service manager
- **Configurable Settings:**
  - Enable/Disable
  - Send to customer (Yes/No)
  - Send to service manager (Yes/No)
  - Custom message template

#### 7.3 Service Contract Renewal
- **Recipients:** Customer, Sales team, Service manager
- **Configurable Settings:**
  - Enable/Disable
  - Days before renewal: 60, 30, 14, 7 days (multi-select)
  - Send to customer (Yes/No)
  - Send to sales team (Yes/No)
  - Send to service manager (Yes/No)
  - Custom message template

### 8. **Inventory & Stock Alerts**

#### 8.1 Low Stock Alert
- **Recipients:** Procurement team, Project manager, Super admins
- **Configurable Settings:**
  - Enable/Disable
  - Stock threshold percentage: 20%, 10%, 5%
  - Send to procurement team (Yes/No)
  - Send to project manager (Yes/No)
  - Send to super admins (Yes/No)
  - Custom message template

#### 8.2 Stock Received
- **Recipients:** Requester, Project manager, Warehouse team
- **Configurable Settings:**
  - Enable/Disable
  - Send to requester (Yes/No)
  - Send to project manager (Yes/No)
  - Send to warehouse team (Yes/No)
  - Custom message template

## Settings Structure

### Global Settings
- **WAHA Connection Status:** Display connection status
- **Default Country Code:** +65 (Singapore)
- **Quiet Hours:** Start time, End time (no notifications during this period)
- **Rate Limiting:** Max messages per hour per user
- **Test Mode:** Send all notifications to admin phone only

### Alert Configuration Per Type
Each alert type will have:
1. **Enable/Disable Toggle**
2. **Timing Configuration** (days before/after)
3. **Recipient Selection** (checkboxes for each role)
4. **Threshold Settings** (amounts, percentages, etc.)
5. **Message Template** (customizable with variables)
6. **Test Button** (send test notification)

### Message Template Variables
Available variables for templates:
- `{user_name}` - Recipient's name
- `{project_number}` - Project number
- `{project_name}` - Project name
- `{tender_number}` - Tender number
- `{invoice_number}` - Invoice number
- `{amount}` - Amount (formatted)
- `{due_date}` - Due date (formatted)
- `{days_remaining}` - Days remaining
- `{company_name}` - Company name
- `{contact_person}` - Contact person name
- `{status}` - Current status
- `{task_title}` - Task title
- `{document_name}` - Document name

### User-Level Settings
Each user can:
1. **Enable/Disable WhatsApp Notifications** (global toggle)
2. **Update Phone Number**
3. **Select Alert Types** (which alerts they want to receive)
4. **Set Quiet Hours** (personal quiet hours)

### Role-Based Recipients
Define phone numbers for roles:
- **Super Admins:** List of super admin phone numbers
- **Finance Team:** List of finance team phone numbers
- **Sales Team:** List of sales team phone numbers
- **HR Team:** List of HR team phone numbers
- **IT Team:** List of IT team phone numbers
- **Procurement Team:** List of procurement team phone numbers

## Database Schema

### WhatsAppAlertSettings Table
```
- id (String, PK)
- alertType (String) - e.g., "TENDER_DEADLINE", "INVOICE_OVERDUE"
- enabled (Boolean)
- timingConfig (JSON) - e.g., { "daysBefore": [7, 3, 1] }
- recipientConfig (JSON) - e.g., { "sendToAssigned": true, "sendToManager": false }
- thresholdConfig (JSON) - e.g., { "minAmount": 1000 }
- messageTemplate (String)
- createdAt (DateTime)
- updatedAt (DateTime)
```

### WhatsAppRoleRecipients Table
```
- id (String, PK)
- roleName (String) - e.g., "FINANCE_TEAM", "SALES_TEAM"
- phoneNumbers (String[]) - Array of phone numbers
- createdAt (DateTime)
- updatedAt (DateTime)
```

### WhatsAppGlobalSettings Table
```
- id (String, PK)
- quietHoursStart (String) - e.g., "22:00"
- quietHoursEnd (String) - e.g., "08:00"
- defaultCountryCode (String) - e.g., "+65"
- maxMessagesPerHour (Int)
- testMode (Boolean)
- testPhoneNumber (String)
- createdAt (DateTime)
- updatedAt (DateTime)
```

### WhatsAppNotificationLog Table
```
- id (String, PK)
- alertType (String)
- recipientPhone (String)
- recipientName (String)
- message (String)
- status (String) - "SENT", "FAILED", "QUEUED"
- errorMessage (String?)
- sentAt (DateTime)
- createdAt (DateTime)
```

## UI Components

### 1. Settings Dashboard
- Overview of all alert types with enable/disable toggles
- Connection status indicator
- Recent notifications log
- Statistics (sent today, failed, pending)

### 2. Alert Type Configuration Page
- Detailed settings for each alert type
- Message template editor with variable picker
- Test notification button
- Save and reset buttons

### 3. Role Recipients Management
- Add/remove phone numbers for each role
- Bulk import from CSV
- Validate phone numbers
- Test send to role

### 4. Global Settings Page
- WAHA connection settings
- Quiet hours configuration
- Rate limiting settings
- Test mode toggle

### 5. Notification Logs
- Searchable and filterable log table
- Export to CSV
- Retry failed notifications
- View message content

## Implementation Priority

### Phase 1 (High Priority)
1. Tender deadlines
2. Task deadlines
3. Outstanding invoices
4. Progress claim submission
5. Budget threshold alerts

### Phase 2 (Medium Priority)
1. Project status changes
2. Document pending approval
3. PO pending approval
4. Payment received
5. Quotation expiring

### Phase 3 (Low Priority)
1. Service contract alerts
2. Inventory alerts
3. System operational alerts
4. User inactivity alerts

## Benefits

1. **Centralized Control:** Super admins can manage all notifications from one place
2. **Flexibility:** Each alert type can be customized independently
3. **User Control:** Users can opt-in/out of specific alert types
4. **Audit Trail:** Complete log of all notifications sent
5. **Testing:** Test notifications before enabling
6. **Scalability:** Easy to add new alert types
7. **Compliance:** Quiet hours and rate limiting prevent spam
8. **Cost Control:** Test mode and rate limiting manage costs
