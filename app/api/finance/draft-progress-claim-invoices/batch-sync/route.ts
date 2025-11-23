
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/api-audit-context'
import { XeroInvoiceSyncEnhanced } from '@/lib/xero-invoice-sync-enhanced'

// POST /api/finance/draft-progress-claim-invoices/batch-sync
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPERADMIN can batch sync to Xero
    if (session.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ 
        error: 'Forbidden: Only superadmins can batch sync invoices to Xero' 
      }, { status: 403 })
    }

    const body = await req.json()
    const { invoiceIds } = body

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json({ 
        error: 'Invalid request: invoiceIds array is required' 
      }, { status: 400 })
    }

    // Verify all invoices exist and are eligible for sync
    const invoices = await prisma.customerInvoice.findMany({
      where: {
        id: { in: invoiceIds },
        isProgressClaimInvoice: true,
        status: 'DRAFT',
        isXeroSynced: false,
      },
      include: {
        Customer: true,
        Project: true,
        CustomerInvoiceItem: true,
      }
    })

    if (invoices.length !== invoiceIds.length) {
      return NextResponse.json({ 
        error: 'Some invoices were not found or are not eligible for sync' 
      }, { status: 400 })
    }

    // Initialize Xero sync service
    const syncService = new XeroInvoiceSyncEnhanced(session.user.id)
    const initialized = await syncService.initialize()

    if (!initialized) {
      return NextResponse.json({ 
        error: 'Xero is not connected. Please connect to Xero first.' 
      }, { status: 400 })
    }

    // Sync invoices to Xero
    console.log(`🔄 Batch syncing ${invoices.length} draft progress claim invoices to Xero...`)
    
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[]
    }

    for (const invoice of invoices) {
      try {
        await syncService.syncInvoices({
          invoiceIds: [invoice.id],
          direction: 'push',
        })
        
        results.success.push(invoice.id)
        console.log(`✅ Successfully synced invoice ${invoice.invoiceNumber}`)
        
        // Create audit log
        await createAuditLog({
          userId: session.user.id,
          userEmail: session.user.email || '',
          action: 'UPDATE',
          entityType: 'INVOICE',
          entityId: invoice.id,
          entityName: `Synced: ${invoice.invoiceNumber}`,
          oldValues: { isXeroSynced: false },
          newValues: { 
            isXeroSynced: true,
            syncedAt: new Date().toISOString(),
            customerName: invoice.Customer.name,
            projectName: invoice.Project?.name || 'N/A'
          },
        })
      } catch (error: any) {
        results.failed.push({
          id: invoice.id,
          error: error.message || 'Unknown error'
        })
        console.error(`❌ Failed to sync invoice ${invoice.invoiceNumber}:`, error)
      }
    }

    // Create summary audit log
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'UPDATE',
      entityType: 'INVOICE',
      entityId: 'batch',
      entityName: `Batch sync: ${invoices.length} invoices`,
      oldValues: { totalInvoices: invoices.length },
      newValues: {
        successCount: results.success.length,
        failedCount: results.failed.length,
        syncedAt: new Date().toISOString()
      },
    })

    return NextResponse.json({
      success: true,
      message: `Synced ${results.success.length} of ${invoices.length} invoices successfully`,
      results
    })
  } catch (error: any) {
    console.error('POST /api/finance/draft-progress-claim-invoices/batch-sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
