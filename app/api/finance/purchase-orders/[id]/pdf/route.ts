
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPOPDF } from '@/lib/po-pdf-utils'
import { downloadFile } from '@/lib/s3'
import { backupPurchaseOrder } from '@/lib/document-backup-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if PO exists
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      select: { 
        id: true,
        poNumber: true
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 })
    }

    // Get the latest PDF for this PO
    const pdfInfo = await getPOPDF(params.id)
    
    if (!pdfInfo) {
      return NextResponse.json({ 
        error: 'No PDF found for this purchase order. It may still be generating.',
        suggestion: 'Try refreshing the page or regenerating the PDF.'
      }, { status: 404 })
    }

    try {
      // Generate a signed URL for the PDF
      const signedUrl = await downloadFile(pdfInfo.cloudStoragePath)
      
      // Trigger NAS backup asynchronously (don't wait for it)
      backupPurchaseOrder(params.id).then(backupResult => {
        if (backupResult.success) {
          console.log('✅ Purchase Order backed up to NAS:', backupResult.pdfPath, backupResult.excelPath)
        } else {
          console.warn('⚠️ NAS backup failed:', backupResult.error)
        }
      }).catch(err => {
        console.error('❌ NAS backup error:', err)
      })
      
      // Return the download URL and metadata
      return NextResponse.json({
        downloadUrl: signedUrl,
        filename: pdfInfo.filename,
        generatedAt: pdfInfo.createdAt,
        poNumber: purchaseOrder.poNumber
      })
    } catch (s3Error: any) {
      console.error('❌ Failed to generate download URL:', s3Error)
      return NextResponse.json({ 
        error: 'Failed to generate download URL',
        details: s3Error.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Error in PO PDF endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retrieve PO PDF',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
