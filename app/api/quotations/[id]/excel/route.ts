
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getQuotationExcel } from '@/lib/quotation-pdf-utils'
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

    // Check if quotation exists
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      select: { 
        id: true,
        quotationNumber: true,
        version: true,
        title: true
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Get the latest Excel for this quotation
    const excelInfo = await getQuotationExcel(params.id)
    
    if (!excelInfo) {
      return NextResponse.json({ 
        error: 'No Excel file found for this quotation. It may still be generating.' 
      }, { status: 404 })
    }

    // Generate a signed URL for the Excel file
    const signedUrl = await downloadFile(excelInfo.cloudStoragePath)
    
    // Return the download URL and metadata
    return NextResponse.json({
      downloadUrl: signedUrl,
      filename: excelInfo.filename,
      quotationNumber: quotation.quotationNumber,
      version: quotation.version,
      title: quotation.title,
      generatedAt: excelInfo.createdAt.toISOString()
    })

  } catch (error) {
    console.error('Error fetching quotation Excel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
