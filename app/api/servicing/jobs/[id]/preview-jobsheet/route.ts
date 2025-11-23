
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prepareJobSheetData } from '@/lib/servicing-job-sheet-pdf-utils'
import { generateJobSheetPDF } from '@/lib/pdf-generator-jobsheet'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const jobId = params.id

    // Get job to generate sheet number
    const job = await prisma.serviceJob.findUnique({
      where: { id: jobId },
      include: {
        ServiceContract: true
      }
    })

    if (!job) {
      return new NextResponse('Job not found', { status: 404 })
    }

    // Generate job sheet number
    const jobSheetNumber = `JS-${job.ServiceContract.contractNo}-${String(job.id).slice(-4)}`

    // Fetch and prepare job sheet data
    const jobSheetData = await prepareJobSheetData(jobId, jobSheetNumber)
    
    if (!jobSheetData) {
      return new NextResponse('Failed to prepare job sheet data', { status: 500 })
    }

    // Generate PDF
    const pdfBuffer = await generateJobSheetPDF(jobSheetData)

    // Return PDF with proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="JobSheet-${jobSheetData.jobSheetNumber}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error generating job sheet PDF preview:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
