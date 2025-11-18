# Budget Module Deployment Guide

## Overview

This guide covers the deployment of the new **Supplier-Based Budget Module** for the Ampere Business Management application. This module provides comprehensive budget tracking with AI-powered quotation upload, cost tracking, profit/loss calculation, and Purchase Order integration.

---

## Features

### Core Functionality

1. **Supplier-Based Budgeting**
   - Track budgets per supplier/trade (not item-by-item)
   - Support for multiple suppliers per project
   - Automatic budget totaling and variance calculation

2. **AI-Powered Quotation Upload**
   - Upload quotation PDFs or images
   - AI extraction of supplier name, amounts, dates, and line items
   - Confidence scoring and manual review workflow
   - Automatic budget entry creation from quotations

3. **Cost Tracking & Profit/Loss**
   - Track quoted amounts vs. actual costs
   - Real-time profit/loss calculation
   - Profit margin percentage tracking
   - Budget utilization monitoring

4. **Budget Warnings & Alerts**
   - Automatic warning when budget exceeds contract value
   - Profit margin warnings
   - Cost overrun alerts
   - Configurable severity levels (INFO, WARNING, CRITICAL)

5. **Purchase Order Integration**
   - Issue POs directly from approved budget quotations
   - Automatic PO creation with quotation details
   - Link POs back to budget items
   - Track PO status in budget dashboard

---

## Database Schema Changes

### New Tables

#### 1. SupplierBudgetItem
Stores individual supplier budget entries with quotation details.

**Key Fields:**
- `quotedAmount`, `quotedAmountBeforeTax`, `quotedTaxAmount` - Quoted amounts
- `actualCost`, `actualCostBeforeTax`, `actualTaxAmount` - Actual costs
- `variance`, `variancePercentage` - Budget variance tracking
- `quotationFilePath`, `quotationFileName` - Uploaded quotation files
- `extractedByAI`, `aiConfidence`, `aiExtractedData` - AI extraction metadata
- `purchaseOrderId`, `poIssued`, `poIssuedDate` - PO linkage
- `status` - Budget item status (QUOTED, APPROVED, PO_ISSUED, etc.)
- `isApproved`, `approvedById`, `approvedAt` - Approval workflow

#### 2. ProjectBudgetSummary
Aggregated budget summary per project.

**Key Fields:**
- `contractValue` - Project contract/revenue value
- `totalBudget` - Sum of all supplier budgets
- `totalActualCost` - Sum of all actual costs
- `estimatedProfit`, `estimatedProfitMargin` - Profit calculations
- `budgetUtilization`, `costUtilization` - Utilization percentages
- `totalSuppliers`, `suppliersWithPO`, `suppliersWithQuotation` - Counts
- `hasWarnings`, `warningCount`, `criticalWarningCount` - Alert tracking

#### 3. BudgetAlert
Budget warnings and alerts.

**Key Fields:**
- `alertType` - Type of alert (BUDGET_EXCEEDED, PROFIT_LOSS, etc.)
- `severity` - Alert severity (INFO, WARNING, CRITICAL)
- `title`, `message` - Alert content
- `supplierBudgetItemId`, `supplierName` - Related supplier (if applicable)
- `isRead`, `isDismissed`, `isResolved` - Alert status

### New Enums

```typescript
enum SupplierBudgetStatus {
  QUOTED
  PENDING_APPROVAL
  APPROVED
  PO_ISSUED
  IN_PROGRESS
  COMPLETED
  INVOICED
  PAID
  CANCELLED
}

enum BudgetAlertType {
  BUDGET_EXCEEDED
  BUDGET_WARNING
  COST_EXCEEDED
  COST_WARNING
  PROFIT_LOSS
  PROFIT_WARNING
  SUPPLIER_OVER_BUDGET
  MISSING_QUOTATION
}

enum AlertSeverity {
  INFO
  WARNING
  CRITICAL
}
```

---

## File Structure

### Backend API Routes

```
app/api/projects/[id]/budget/
├── upload-quotation/
│   └── route.ts                    # Upload quotation with AI extraction
├── supplier-items/
│   ├── route.ts                    # List/create supplier budget items
│   └── [itemId]/
│       ├── route.ts                # Get/update/delete individual item
│       └── issue-po/
│           └── route.ts            # Issue PO from budget item
```

### Frontend Components

```
app/(dashboard)/projects/[id]/budget/
├── page.tsx                        # Main budget dashboard
└── components/
    ├── UploadQuotationDialog.tsx  # Upload quotation dialog
    ├── AddSupplierBudgetDialog.tsx # Manual budget entry dialog
    └── EditSupplierBudgetDialog.tsx # Edit budget item dialog
```

### Database Files

```
prisma/
├── budget-simplified-schema.prisma # New schema models (reference)
└── migrations/
    └── add_supplier_budget_tables.sql # Migration SQL script
```

---

## Deployment Steps

### Step 1: Backup Database

**CRITICAL: Always backup before applying migrations!**

```bash
# SSH into your production server
ssh user@your-server

# Backup PostgreSQL database
docker exec ampere-postgres pg_dump -U ampere_user ampere_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Or if not using Docker:
pg_dump -U ampere_user ampere_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Apply Database Migration

```bash
# Navigate to project directory
cd /path/to/ampere-repo

# Apply the migration SQL
docker exec -i ampere-postgres psql -U ampere_user -d ampere_db < prisma/migrations/add_supplier_budget_tables.sql

# Or if not using Docker:
psql -U ampere_user -d ampere_db < prisma/migrations/add_supplier_budget_tables.sql
```

### Step 3: Update Prisma Schema

The new models need to be added to your main `prisma/schema.prisma` file. You can either:

**Option A: Manual Integration**
Copy the models from `prisma/budget-simplified-schema.prisma` into your main `schema.prisma` file.

**Option B: Use Prisma Introspection**
```bash
# Regenerate Prisma schema from database
npx prisma db pull

# Generate Prisma Client
npx prisma generate
```

### Step 4: Install Dependencies

```bash
# Install any missing dependencies
npm install

# Or if using pnpm
pnpm install
```

### Step 5: Build and Deploy

```bash
# Build the Next.js application
npm run build

# Or if using pnpm
pnpm build

# Restart the application
pm2 restart ampere-app
# Or your deployment method (Docker, systemd, etc.)
```

### Step 6: Verify Deployment

1. **Check Database Tables**
   ```sql
   -- Connect to database
   psql -U ampere_user -d ampere_db
   
   -- Verify tables exist
   \dt SupplierBudgetItem
   \dt ProjectBudgetSummary
   \dt BudgetAlert
   
   -- Verify enums
   \dT SupplierBudgetStatus
   \dT BudgetAlertType
   \dT AlertSeverity
   ```

2. **Test Budget Module**
   - Navigate to a project: `/projects/[id]/budget`
   - Upload a quotation PDF
   - Verify AI extraction works
   - Create a manual budget entry
   - Approve a budget item and issue a PO
   - Check budget summary calculations

3. **Check Logs**
   ```bash
   # Check application logs
   pm2 logs ampere-app
   
   # Or Docker logs
   docker logs ampere-app
   ```

---

## Configuration

### Environment Variables

Ensure these environment variables are set in your `.env` or `.env.local`:

```env
# Database
DATABASE_URL="postgresql://ampere_user:password@localhost:5432/ampere_db"

# OpenAI API (for quotation extraction)
OPENAI_API_KEY="sk-..."

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key"
```

### OpenAI Model Configuration

The quotation upload feature uses OpenAI's GPT-4 Vision model (`gpt-4o`) for PDF/image parsing. The model is configured in:

```typescript
// app/api/projects/[id]/budget/upload-quotation/route.ts
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  // ... other settings
});
```

You can adjust the model or parameters as needed.

---

## Usage Guide

### For Project Managers

#### 1. Set Project Contract Value
Before using the budget module, ensure the project has a contract value set:
- Go to Project Details
- Set "Contract Value" (this becomes the revenue for profit calculation)

#### 2. Upload Quotations
- Navigate to Project → Budget
- Click "Upload Quotation"
- Select supplier and upload PDF/image
- AI will extract details automatically
- Review and approve extracted data

#### 3. Manual Budget Entry
- Click "Add Manual Entry"
- Select supplier and trade type
- Enter quoted amount and details
- Save budget item

#### 4. Review and Approve
- Budget items extracted by AI may need review
- Check the "Needs Review" flag
- Edit details if needed
- Click "Approve" when ready

#### 5. Issue Purchase Orders
- For approved budget items, click "Issue PO"
- PO will be created automatically with quotation details
- PO is linked back to budget item
- Track PO status in budget dashboard

#### 6. Monitor Budget Health
The dashboard shows:
- **Contract Value** - Total project revenue
- **Total Budget** - Sum of all supplier budgets
- **Estimated Profit** - Contract value - Total budget
- **Profit Margin** - Percentage profit
- **Budget Utilization** - % of contract value used by budgets
- **Warnings** - Budget alerts and overruns

### For Finance Team

#### Track Actual Costs
- Edit budget items to add actual costs
- Actual costs are compared against quoted amounts
- Variance is calculated automatically

#### Monitor Profit/Loss
- View "Actual Profit" vs "Estimated Profit"
- Track profit margin changes
- Identify cost overruns early

---

## API Reference

### Upload Quotation
```
POST /api/projects/[id]/budget/upload-quotation
Content-Type: multipart/form-data

Body:
- file: File (PDF, PNG, JPEG)
- supplierId: string
- tradeType: string (optional)

Response:
{
  success: true,
  budgetItem: {...},
  extractedData: {...},
  needsReview: boolean,
  message: string
}
```

### List Budget Items
```
GET /api/projects/[id]/budget/supplier-items

Response:
{
  budgetItems: [...],
  summary: {
    contractValue: number,
    totalBudget: number,
    estimatedProfit: number,
    ...
  }
}
```

### Create Budget Item
```
POST /api/projects/[id]/budget/supplier-items
Content-Type: application/json

Body:
{
  supplierId: string,
  tradeType: string,
  quotedAmount: number,
  description?: string,
  ...
}
```

### Update Budget Item
```
PUT /api/projects/[id]/budget/supplier-items/[itemId]
Content-Type: application/json

Body:
{
  quotedAmount?: number,
  actualCost?: number,
  status?: string,
  isApproved?: boolean,
  ...
}
```

### Issue PO from Budget
```
POST /api/projects/[id]/budget/supplier-items/[itemId]/issue-po
Content-Type: application/json

Body:
{
  deliveryDate?: string,
  deliveryAddress?: string,
  terms?: string,
  notes?: string,
  items?: [...] // Optional detailed line items
}

Response:
{
  success: true,
  purchaseOrder: {...},
  message: string
}
```

---

## Troubleshooting

### Issue: AI Extraction Not Working

**Symptoms:** Quotation upload succeeds but no data extracted

**Solutions:**
1. Check OpenAI API key is set correctly
2. Verify API key has access to GPT-4 Vision
3. Check file format (PDF, PNG, JPEG only)
4. Review application logs for API errors

### Issue: Migration Fails

**Symptoms:** SQL migration script errors

**Solutions:**
1. Check if tables already exist: `\dt SupplierBudgetItem`
2. Verify PostgreSQL version (requires 12+)
3. Check user permissions
4. Review error message for specific constraint violations

### Issue: Budget Summary Not Updating

**Symptoms:** Budget totals don't reflect changes

**Solutions:**
1. Budget summary updates automatically on budget item changes
2. Check `updateProjectBudgetSummary()` function in API routes
3. Manually recalculate by editing and saving a budget item
4. Check database triggers and constraints

### Issue: PO Creation Fails

**Symptoms:** "Issue PO" button doesn't work

**Solutions:**
1. Ensure budget item is approved (`isApproved = true`)
2. Check user has PROJECT_MANAGER or SUPERADMIN role
3. Verify supplier exists and is active
4. Check PO number generation logic
5. Review PurchaseOrder table constraints

---

## Security Considerations

### File Upload Security
- Only PDF, PNG, JPEG files allowed
- Maximum file size: 10MB
- Files stored in `/uploads/quotations/[projectId]/`
- File paths are sanitized

### API Access Control
- All routes require authentication
- Project access verified per request
- Role-based permissions:
  - Budget viewing: All project members
  - Budget creation/editing: PROJECT_MANAGER, SUPERADMIN
  - PO issuance: PROJECT_MANAGER, SUPERADMIN
  - Budget approval: PROJECT_MANAGER, SUPERADMIN

### Data Privacy
- Quotation files are project-scoped
- Internal notes are separate from public notes
- AI extracted data stored for audit trail

---

## Performance Optimization

### Database Indexes
The migration creates indexes on:
- `SupplierBudgetItem.projectId`
- `SupplierBudgetItem.supplierId`
- `SupplierBudgetItem.status`
- `SupplierBudgetItem.poIssued`
- `ProjectBudgetSummary.projectId` (unique)
- `BudgetAlert.projectId`
- `BudgetAlert.isRead`
- `BudgetAlert.severity`

### Caching Recommendations
- Cache budget summary per project (TTL: 5 minutes)
- Cache supplier list (TTL: 1 hour)
- Invalidate cache on budget item changes

### AI Extraction Optimization
- AI extraction runs asynchronously
- Results cached in `aiExtractedData` field
- Re-extraction not needed on subsequent edits

---

## Future Enhancements

### Planned Features
1. **Batch Quotation Upload** - Upload multiple quotations at once
2. **Budget Templates** - Create budget templates for common project types
3. **Budget Approval Workflow** - Multi-level approval process
4. **Email Notifications** - Alert stakeholders on budget changes
5. **Budget Reports** - Exportable budget vs. actual reports
6. **Integration with Accounting** - Sync with Xero/QuickBooks
7. **Mobile App Support** - View budgets on mobile devices

### API Extensions
- Bulk budget import from CSV/Excel
- Budget comparison across projects
- Historical budget trend analysis
- Budget forecasting based on project progress

---

## Support

For issues or questions:
1. Check application logs
2. Review this deployment guide
3. Contact development team
4. Submit issue at https://help.manus.im

---

## Changelog

### Version 1.0.0 (Current)
- Initial release
- Supplier-based budget tracking
- AI quotation upload and extraction
- Profit/loss calculation
- PO integration
- Budget warnings and alerts

---

**Last Updated:** November 18, 2025
**Author:** Manus AI Development Team
**Version:** 1.0.0
