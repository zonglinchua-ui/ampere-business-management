
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prepareServiceInvoiceData, generateAndStoreServiceInvoicePDF } from '@/lib/servicing-invoice-pdf-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const userRole = session.user?.role
    const canGenerate = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canGenerate) {
      return NextResponse.json({ error: 'Insufficient permissions to generate invoices' }, { status: 403 })
    }

    const invoiceId = params.id

    // Fetch and prepare invoice data
    const invoiceData = await prepareServiceInvoiceData(invoiceId)
    
    if (!invoiceData) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Generate and store PDF
    const cloudStoragePath = await generateAndStoreServiceInvoicePDF(invoiceData, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Service invoice generated successfully',
      cloudStoragePath,
      invoiceNo: invoiceData.invoiceNo
    }, { status: 200 })
  } catch (error) {
    console.error('Error generating service invoice PDF:', error)
    return NextResponse.json({ 
      error: 'Failed to generate service invoice',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
