
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/s3'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const jobId = params.id

    // Verify job exists
    const job = await prisma.serviceJob.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Service job not found' },
        { status: 404 }
      )
    }

    // Get the uploaded file from FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const jobSheetId = formData.get('jobSheetId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!jobSheetId) {
      return NextResponse.json(
        { error: 'Job sheet ID is required' },
        { status: 400 }
      )
    }

    // Verify job sheet exists and belongs to this job
    const jobSheet = await prisma.serviceJobSheet.findUnique({
      where: { id: jobSheetId }
    })

    if (!jobSheet || jobSheet.jobId !== jobId) {
      return NextResponse.json(
        { error: 'Job sheet not found' },
        { status: 404 }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const ext = file.name.split('.').pop()
    const filename = `endorsed-jobsheet-${jobSheet.id}-${timestamp}.${ext}`

    // Upload to cloud storage
    console.log('[Upload Endorsed] Uploading file to cloud storage...')
    const cloudPath = await uploadFile(buffer, filename)
    console.log('[Upload Endorsed] ✓ File uploaded to:', cloudPath)

    // Update the job sheet with the endorsed file path
    const updatedJobSheet = await prisma.serviceJobSheet.update({
      where: { id: jobSheetId },
      data: {
        endorsedFilePath: cloudPath,
        endorsedUploadedAt: new Date()
      }
    })

    console.log('[Upload Endorsed] ✓ Job sheet updated with endorsed file')

    return NextResponse.json({
      message: 'Endorsed job sheet uploaded successfully',
      jobSheet: updatedJobSheet
    })

  } catch (error) {
    console.error('[Upload Endorsed] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload endorsed job sheet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
