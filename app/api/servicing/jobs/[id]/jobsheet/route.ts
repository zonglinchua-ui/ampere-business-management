
import { v4 as uuidv4 } from 'uuid'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateAndStoreJobSheetPDF, prepareJobSheetData } from '@/lib/servicing-job-sheet-pdf-utils'
import { generateNextJobSheetNumber } from '@/lib/number-generation'

// POST /api/servicing/jobs/[id]/jobsheet - Generate job sheet PDF
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 })
    }

    // Get the job to check permissions
    const job = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      include: {
        ServiceContract: true
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Service job not found' }, { status: 404 })
    }

    // Check permissions
    const canGenerate = (
      ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "") ||
      (job.assignedToType === 'Staff' && job.assignedToId === userId) ||
      (job.assignedToType === 'Supplier' && job.assignedToId === userId)
    )

    if (!canGenerate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Validate ServiceContract exists
    if (!job.ServiceContract) {
      console.error('[JobSheet API] ServiceContract not found for job:', params.id)
      return NextResponse.json({ 
        error: 'Service contract not found for this job' 
      }, { status: 404 })
    }

    // Validate contractNo exists
    if (!job.ServiceContract.contractNo) {
      console.error('[JobSheet API] ServiceContract contractNo is null for job:', params.id)
      return NextResponse.json({ 
        error: 'Service contract number is missing. Please ensure the contract has a valid contract number.' 
      }, { status: 400 })
    }

    // Generate global job sheet number in format CS-25-10-XXXX
    console.log(`[JobSheet API] Generating job sheet for job: ${params.id}`)
    const jobSheetNumber = await generateNextJobSheetNumber()
    console.log(`[JobSheet API] Job sheet number: ${jobSheetNumber}`)

    // Prepare job sheet data for PDF generation with validation
    console.log('[JobSheet API] Preparing job sheet data...')
    let jobSheetData
    try {
      jobSheetData = await prepareJobSheetData(params.id, jobSheetNumber)
    } catch (dataError) {
      console.error('[JobSheet API] Failed to prepare job sheet data:', dataError)
      
      // Return specific error message for validation errors
      if (dataError instanceof Error) {
        const errorMessage = dataError.message.toLowerCase()
        
        // Check for specific validation errors and return 400
        if (errorMessage.includes('not found') || 
            errorMessage.includes('missing') || 
            errorMessage.includes('is null')) {
          return NextResponse.json({ 
            error: dataError.message,
            details: 'Please ensure all required job data fields are properly filled.'
          }, { status: 400 })
        }
      }
      
      // For other errors, return 500
      return NextResponse.json({ 
        error: 'Failed to prepare job sheet data',
        details: dataError instanceof Error ? dataError.message : 'Unknown error'
      }, { status: 500 })
    }

    if (!jobSheetData) {
      console.error('[JobSheet API] Job sheet data is null')
      return NextResponse.json({ 
        error: 'Failed to prepare job sheet data. Please check server logs for details.' 
      }, { status: 500 })
    }

    // Generate and store the PDF
    console.log('[JobSheet API] Generating and storing PDF...')
    try {
      const pdfCloudPath = await generateAndStoreJobSheetPDF(jobSheetData, userId)
      console.log(`[JobSheet API] PDF generated successfully: ${pdfCloudPath}`)

      return NextResponse.json({
        success: true,
        message: 'Job sheet generated successfully',
        filePath: pdfCloudPath,
        jobSheetNumber
      }, { status: 201 })
    } catch (pdfError) {
      console.error('[JobSheet API] Failed to generate PDF:', pdfError)
      return NextResponse.json({ 
        error: 'Failed to generate PDF',
        details: pdfError instanceof Error ? pdfError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[JobSheet API] Unexpected error:', error)
    if (error instanceof Error) {
      console.error('[JobSheet API] Error message:', error.message)
      console.error('[JobSheet API] Error stack:', error.stack)
    }
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/servicing/jobs/[id]/jobsheet - List job sheets for a job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id

    // Get the job to check permissions
    const job = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        assignedToType: true,
        assignedToId: true
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Service job not found' }, { status: 404 })
    }

    // Check permissions
    const canView = (
      ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "") ||
      (job.assignedToType === 'Staff' && job.assignedToId === userId) ||
      (job.assignedToType === 'Supplier' && job.assignedToId === userId)
    )

    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const jobSheets = await prisma.serviceJobSheet.findMany({
      where: { jobId: params.id },
      orderBy: { generatedAt: 'desc' }
    })

    return NextResponse.json(jobSheets)

  } catch (error) {
    console.error('Error fetching job sheets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
