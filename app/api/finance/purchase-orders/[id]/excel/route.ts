
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPOExcel } from '@/lib/po-pdf-utils'
import { downloadFile } from '@/lib/s3'

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

    // Get the latest Excel for this PO
    const excelInfo = await getPOExcel(params.id)
    
    if (!excelInfo) {
      return NextResponse.json({ 
        error: 'No Excel file found for this purchase order. It may still be generating.' 
      }, { status: 404 })
    }

    // Generate a signed URL for the Excel file
    const signedUrl = await downloadFile(excelInfo.cloudStoragePath)
    
    // Return the download URL and metadata
    return NextResponse.json({
      downloadUrl: signedUrl,
      filename: excelInfo.filename,
      poNumber: purchaseOrder.poNumber,
      generatedAt: excelInfo.createdAt.toISOString()
    })

  } catch (error) {
    console.error('❌ Error fetching PO Excel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
