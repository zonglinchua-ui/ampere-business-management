
import { prisma } from './db'
import { generateJobSheetPDF } from './pdf-generator-jobsheet'
import { uploadFile } from './s3'
import { v4 as uuidv4 } from 'uuid'

export interface JobSheetPDFData {
  id: string
  jobSheetNumber: string
  contract: {
    contractNo: string
    title: string
    serviceType: string
    frequency: string
  }
  customer: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  }
  project?: {
    name: string
    projectNumber: string
    address?: string | null
  } | null
  scheduledDate: Date | string
  status: string
  assignedToType: string
  assignedTo?: {
    name: string
    email?: string | null
    phone?: string | null
  }
  completionNotes?: string | null
  completedAt?: Date | string | null
  workPerformed?: Array<{
    description: string
    timeSpent?: number
    materials?: string
  }>
  clientSignature?: string | null
  technicianSignature?: string | null
}

/**
 * Prepare job sheet data from database with comprehensive validation
 */
export async function prepareJobSheetData(
  jobId: string,
  jobSheetNumber: string
): Promise<JobSheetPDFData | null> {
  try {
    console.log(`[prepareJobSheetData] Starting data preparation for job: ${jobId}`)
    
    const job = await prisma.serviceJob.findUnique({
      where: { id: jobId },
      include: {
        ServiceContract: true,
        Customer: true,
        Project: true,
        AssignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        AssignedSupplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    })

    // Validation: Job exists
    if (!job) {
      console.error(`[prepareJobSheetData] ERROR: Job not found with id: ${jobId}`)
      throw new Error('Job not found')
    }
    console.log(`[prepareJobSheetData] ✓ Job found: ${jobId}`)

    // Validation: ServiceContract exists
    if (!job.ServiceContract) {
      console.error(`[prepareJobSheetData] ERROR: ServiceContract not found for job: ${jobId}`)
      throw new Error('Service contract not found for this job')
    }
    console.log(`[prepareJobSheetData] ✓ ServiceContract found: ${job.ServiceContract.id}`)

    // Validation: contractNo exists
    if (!job.ServiceContract.contractNo) {
      console.error(`[prepareJobSheetData] ERROR: ServiceContract.contractNo is null for job: ${jobId}`)
      throw new Error('Service contract number is missing')
    }
    console.log(`[prepareJobSheetData] ✓ Contract number: ${job.ServiceContract.contractNo}`)

    // Validation: Customer exists
    if (!job.Customer) {
      console.error(`[prepareJobSheetData] ERROR: Customer not found for job: ${jobId}`)
      throw new Error('Customer not found for this job')
    }
    console.log(`[prepareJobSheetData] ✓ Customer found: ${job.Customer.name}`)

    // Validation: Customer name exists
    if (!job.Customer.name) {
      console.error(`[prepareJobSheetData] ERROR: Customer name is null for job: ${jobId}`)
      throw new Error('Customer name is missing')
    }

    // Validation: scheduledDate exists
    if (!job.scheduledDate) {
      console.error(`[prepareJobSheetData] ERROR: scheduledDate is null for job: ${jobId}`)
      throw new Error('Scheduled date is missing')
    }
    console.log(`[prepareJobSheetData] ✓ Scheduled date: ${job.scheduledDate}`)

    // Prepare assigned to information with defensive checks
    const assignedTo = job.AssignedUser
      ? {
          name: `${job.AssignedUser.firstName || ''} ${job.AssignedUser.lastName || ''}`.trim(),
          email: job.AssignedUser.email || null,
          phone: null
        }
      : job.AssignedSupplier
      ? {
          name: job.AssignedSupplier.name || 'Unknown Supplier',
          email: job.AssignedSupplier.email || null,
          phone: job.AssignedSupplier.phone || null
        }
      : undefined

    console.log(`[prepareJobSheetData] ✓ Assigned to: ${assignedTo ? assignedTo.name : 'Not assigned'}`)

    const jobSheetData: JobSheetPDFData = {
      id: job.id,
      jobSheetNumber,
      contract: {
        contractNo: job.ServiceContract.contractNo,
        title: job.ServiceContract.title || `${job.ServiceContract.serviceType} Service`,
        serviceType: job.ServiceContract.serviceType,
        frequency: job.ServiceContract.frequency
      },
      customer: {
        name: job.Customer.name,
        email: job.Customer.email || null,
        phone: job.Customer.phone || null,
        address: job.Customer.address || null,
        city: job.Customer.city || null,
        state: job.Customer.state || null,
        postalCode: job.Customer.postalCode || null,
        country: job.Customer.country || null
      },
      project: job.Project
        ? {
            name: job.Project.name || 'Unnamed Project',
            projectNumber: job.Project.projectNumber || 'N/A',
            address: job.Project.address || null
          }
        : null,
      scheduledDate: job.scheduledDate,
      status: job.status,
      assignedToType: job.assignedToType,
      assignedTo,
      completionNotes: job.completionNotes || null,
      completedAt: job.completedAt || null,
      workPerformed: [],
      clientSignature: null,
      technicianSignature: null
    }

    console.log(`[prepareJobSheetData] ✓ Job sheet data prepared successfully`)
    return jobSheetData
    
  } catch (error) {
    console.error('[prepareJobSheetData] ERROR:', error)
    if (error instanceof Error) {
      console.error('[prepareJobSheetData] Error message:', error.message)
      console.error('[prepareJobSheetData] Error stack:', error.stack)
    }
    // Re-throw to be caught by the API route
    throw error
  }
}

/**
 * Generate and store job sheet PDF with comprehensive logging
 */
export async function generateAndStoreJobSheetPDF(
  jobSheetData: JobSheetPDFData,
  userId: string
): Promise<string> {
  try {
    console.log(`[generateAndStoreJobSheetPDF] Starting process for job: ${jobSheetData.id}`)
    console.log(`[generateAndStoreJobSheetPDF] Job sheet number: ${jobSheetData.jobSheetNumber}`)
    console.log(`[generateAndStoreJobSheetPDF] User ID: ${userId}`)
    
    // Validate inputs
    if (!jobSheetData || !jobSheetData.id) {
      throw new Error('Invalid job sheet data: missing job ID')
    }
    if (!userId) {
      throw new Error('User ID is required')
    }
    
    // Generate PDF buffer
    console.log('[generateAndStoreJobSheetPDF] Calling PDF generator...')
    const pdfBuffer = await generateJobSheetPDF(jobSheetData)
    console.log(`[generateAndStoreJobSheetPDF] ✓ PDF buffer generated, size: ${pdfBuffer.length} bytes`)
    
    // Validate PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty')
    }
    
    // Create filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const pdfFilename = `jobsheet-${jobSheetData.jobSheetNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.pdf`
    console.log(`[generateAndStoreJobSheetPDF] Filename: ${pdfFilename}`)
    
    // Upload to S3
    console.log('[generateAndStoreJobSheetPDF] Uploading to cloud storage...')
    const pdfCloudPath = await uploadFile(pdfBuffer, pdfFilename)
    console.log(`[generateAndStoreJobSheetPDF] ✓ Uploaded to cloud: ${pdfCloudPath}`)
    
    // Validate cloud path
    if (!pdfCloudPath) {
      throw new Error('Failed to get cloud storage path')
    }
    
    // Store document record in database
    console.log('[generateAndStoreJobSheetPDF] Creating document record...')
    const documentId = uuidv4()
    await prisma.document.create({
      data: {
        id: documentId,
        filename: pdfFilename,
        originalName: `Job Sheet ${jobSheetData.jobSheetNumber}.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        cloudStoragePath: pdfCloudPath,
        description: `Auto-generated job sheet for ${jobSheetData.contract.title}`,
        category: 'REPORT',
        uploadedById: userId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    console.log(`[generateAndStoreJobSheetPDF] ✓ Document record created: ${documentId}`)
    
    // Store in ServiceJobSheet table
    console.log('[generateAndStoreJobSheetPDF] Creating ServiceJobSheet record...')
    const jobSheetId = uuidv4()
    await prisma.serviceJobSheet.create({
      data: {
        id: jobSheetId,
        jobId: jobSheetData.id,
        jobSheetNumber: jobSheetData.jobSheetNumber,
        filePath: pdfCloudPath,
        clientSignature: jobSheetData.clientSignature || null,
        generatedAt: new Date()
      }
    })
    console.log(`[generateAndStoreJobSheetPDF] ✓ ServiceJobSheet record created: ${jobSheetId}`)
    
    console.log('[generateAndStoreJobSheetPDF] ✓✓✓ Job sheet generation completed successfully')
    return pdfCloudPath
    
  } catch (error) {
    console.error('[generateAndStoreJobSheetPDF] ERROR:', error)
    if (error instanceof Error) {
      console.error('[generateAndStoreJobSheetPDF] Error message:', error.message)
      console.error('[generateAndStoreJobSheetPDF] Error stack:', error.stack)
    }
    throw error
  }
}
