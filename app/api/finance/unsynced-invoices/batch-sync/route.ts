
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/finance/unsynced-invoices/batch-sync
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPERADMIN can batch sync
    if (session.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden - SUPERADMIN access required' }, { status: 403 })
    }

    const body = await req.json()
    const { invoiceIds, invoiceType } = body

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json({ error: 'Invoice IDs are required' }, { status: 400 })
    }

    if (!invoiceType || !['CUSTOMER', 'SUPPLIER', 'MIXED'].includes(invoiceType)) {
      return NextResponse.json({ error: 'Invalid invoice type' }, { status: 400 })
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[]
    }

    // Process each invoice
    for (const invoiceId of invoiceIds) {
      try {
        // Determine if this is a customer or supplier invoice by checking both tables
        const customerInvoice = await prisma.customerInvoice.findUnique({
          where: { id: invoiceId },
          include: { Customer: true, Project: true }
        })

        const supplierInvoice = await prisma.supplierInvoice.findUnique({
          where: { id: invoiceId },
          include: { Supplier: true, Project: true }
        })

        if (!customerInvoice && !supplierInvoice) {
          results.failed.push({ id: invoiceId, error: 'Invoice not found' })
          continue
        }

        // Sync to Xero based on invoice type
        let syncResponse
        if (customerInvoice) {
          syncResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/xero/sync/customer-invoice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': req.headers.get('cookie') || ''
            },
            body: JSON.stringify({ invoiceId: customerInvoice.id })
          })
        } else if (supplierInvoice) {
          syncResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/xero/sync/supplier-invoice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': req.headers.get('cookie') || ''
            },
            body: JSON.stringify({ invoiceId: supplierInvoice.id })
          })
        }

        if (syncResponse && syncResponse.ok) {
          results.success.push(invoiceId)
        } else {
          const errorData = syncResponse ? await syncResponse.json() : { error: 'Unknown error' }
          results.failed.push({ id: invoiceId, error: errorData.error || 'Sync failed' })
        }
      } catch (error: any) {
        console.error(`Failed to sync invoice ${invoiceId}:`, error)
        results.failed.push({ id: invoiceId, error: error.message || 'Unknown error' })
      }
    }

    const message = results.success.length > 0
      ? `Successfully synced ${results.success.length} of ${invoiceIds.length} invoice(s) to Xero`
      : 'Failed to sync invoices to Xero'

    return NextResponse.json({
      success: results.success.length > 0,
      message,
      results
    })
  } catch (error: any) {
    console.error('POST /api/finance/unsynced-invoices/batch-sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
