
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prepareJobSheetData, generateAndStoreJobSheetPDF } from '@/lib/servicing-job-sheet-pdf-utils'
import { prisma } from '@/lib/db'
import { generateNextJobSheetNumber } from '@/lib/number-generation'

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

    const jobId = params.id

    // Get job to validate it exists
    const job = await prisma.serviceJob.findUnique({
      where: { id: jobId },
      include: {
        ServiceContract: true
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Generate global job sheet number in format CS-25-10-XXXX
    const jobSheetNumber = await generateNextJobSheetNumber()

    // Fetch and prepare job sheet data
    const jobSheetData = await prepareJobSheetData(jobId, jobSheetNumber)
    
    if (!jobSheetData) {
      return NextResponse.json({ error: 'Failed to prepare job sheet data' }, { status: 500 })
    }

    // Generate and store PDF
    const cloudStoragePath = await generateAndStoreJobSheetPDF(jobSheetData, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Job sheet generated successfully',
      cloudStoragePath,
      jobSheetNumber: jobSheetData.jobSheetNumber
    }, { status: 200 })
  } catch (error) {
    console.error('Error generating job sheet PDF:', error)
    return NextResponse.json({ 
      error: 'Failed to generate job sheet',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
