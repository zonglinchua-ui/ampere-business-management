import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// Default alert configurations
const DEFAULT_ALERTS = [
  {
    alertType: 'TENDER_DEADLINE',
    enabled: true,
    timingConfig: { daysBefore: [7, 3, 1] },
    recipientConfig: { sendToAssigned: true, sendToSalesTeam: false, sendToSuperAdmins: false },
    thresholdConfig: {},
    messageTemplate: `🔔 *Tender Deadline Reminder*

Tender: {tender_number}
Name: {tender_name}
Deadline: {due_date}
⏰ {days_remaining} day(s) remaining

Please ensure your submission is completed on time.`
  },
  {
    alertType: 'TASK_DEADLINE',
    enabled: true,
    timingConfig: { daysBefore: [3, 1] },
    recipientConfig: { sendToAssigned: true, sendToCreator: false, sendToProjectManager: false },
    thresholdConfig: {},
    messageTemplate: `📋 *Task Deadline Reminder*

Task: {task_title}
Due Date: {due_date}
⏰ {days_remaining} day(s) remaining

Please complete this task on time.`
  },
  {
    alertType: 'INVOICE_OVERDUE',
    enabled: true,
    timingConfig: { daysBefore: [7, 3, 1], daysAfter: [1, 3, 7, 14] },
    recipientConfig: { sendToCustomer: true, sendToFinanceTeam: false, sendToSuperAdmins: false },
    thresholdConfig: { minAmount: 0 },
    messageTemplate: `💰 *Invoice Payment Reminder*

Invoice: {invoice_number}
Customer: {customer_name}
Amount: ${'{amount}'}
Due Date: {due_date}
Status: {status}

Please arrange for payment at your earliest convenience.`
  },
  {
    alertType: 'PROGRESS_CLAIM_SUBMISSION',
    enabled: true,
    timingConfig: { daysBefore: [5, 3] },
    recipientConfig: { sendToProjectManager: true, sendToCustomer: false, sendToFinanceTeam: false },
    thresholdConfig: {},
    messageTemplate: `📊 *Progress Claim Submission Reminder*

Project: {project_number} - {project_name}
Claim Number: {claim_number}
Submission Date: {due_date}
⏰ {days_remaining} day(s) remaining

Please prepare and submit the progress claim.`
  },
  {
    alertType: 'BUDGET_THRESHOLD',
    enabled: true,
    timingConfig: {},
    recipientConfig: { sendToProjectManager: true, sendToFinanceTeam: true, sendToSuperAdmins: false },
    thresholdConfig: { percentages: [75, 90, 100] },
    messageTemplate: `⚠️ *Budget Threshold Alert*

Project: {project_number} - {project_name}
Budget Used: {percentage}%
Amount Used: ${'{amount_used}'} / ${'{budget_total}'}

Please monitor project expenses carefully.`
  },
  {
    alertType: 'DOCUMENT_PENDING_APPROVAL',
    enabled: true,
    timingConfig: { daysPending: [3, 7] },
    recipientConfig: { sendToApprover: true, sendToSubmitter: false },
    thresholdConfig: {},
    messageTemplate: `📄 *Document Pending Approval*

Document: {document_name}
Type: {document_type}
Submitted: {submitted_date}
Pending: {days_pending} day(s)

Please review and approve/reject this document.`
  },
  {
    alertType: 'PO_PENDING_APPROVAL',
    enabled: true,
    timingConfig: { daysPending: [2, 5] },
    recipientConfig: { sendToApprover: true, sendToRequester: false, sendToFinanceTeam: false },
    thresholdConfig: { minAmount: 1000 },
    messageTemplate: `🛒 *Purchase Order Pending Approval*

PO Number: {po_number}
Supplier: {supplier_name}
Amount: ${'{amount}'}
Pending: {days_pending} day(s)

Please review and approve this purchase order.`
  },
  {
    alertType: 'PROJECT_STATUS_CHANGE',
    enabled: true,
    timingConfig: {},
    recipientConfig: { sendToProjectManager: true, sendToCustomer: false, sendToTeamMembers: false },
    thresholdConfig: {},
    messageTemplate: `🔄 *Project Status Changed*

Project: {project_number} - {project_name}
Status: {old_status} → {new_status}
Changed By: {changed_by}

Please take note of this status change.`
  },
  {
    alertType: 'PAYMENT_RECEIVED',
    enabled: true,
    timingConfig: {},
    recipientConfig: { sendToProjectManager: true, sendToFinanceTeam: true, sendToCustomer: false },
    thresholdConfig: { minAmount: 1000 },
    messageTemplate: `✅ *Payment Received*

Invoice: {invoice_number}
Customer: {customer_name}
Amount: ${'{amount}'}
Received: {payment_date}

Thank you for your payment!`
  },
  {
    alertType: 'QUOTATION_EXPIRING',
    enabled: true,
    timingConfig: { daysBefore: [7, 3, 1] },
    recipientConfig: { sendToCustomer: true, sendToSalesTeam: false },
    thresholdConfig: {},
    messageTemplate: `⏰ *Quotation Expiring Soon*

Quotation: {quotation_number}
Project: {project_name}
Expiry Date: {expiry_date}
⏰ {days_remaining} day(s) remaining

Please review and accept the quotation before it expires.`
  }
]

// POST /api/admin/whatsapp-alerts/initialize - Initialize default alert settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const created = []
    const skipped = []

    for (const alert of DEFAULT_ALERTS) {
      // Check if already exists
      const existing = await prisma.whatsAppAlertSettings.findUnique({
        where: { alertType: alert.alertType }
      })

      if (existing) {
        skipped.push(alert.alertType)
      } else {
        await prisma.whatsAppAlertSettings.create({
          data: alert
        })
        created.push(alert.alertType)
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      skipped: skipped.length,
      createdAlerts: created,
      skippedAlerts: skipped
    })
  } catch (error) {
    console.error('[WhatsApp Alerts Initialize] Error initializing alerts:', error)
    return NextResponse.json(
      { error: 'Failed to initialize alert settings' },
      { status: 500 }
    )
  }
}
