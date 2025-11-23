
import { PrismaClient } from '@prisma/client'
import { generateQuotationPDF } from './pdf-generator'
import { generateQuotationExcel } from './excel-generator'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { backupQuotation } from './document-backup-service'

const prisma = new PrismaClient()

export interface QuotationPDFData {
  id: string
  quotationNumber: string
  version: number
  title: string
  description?: string | null
  clientReference?: string | null
  subtotal: number
  taxAmount?: number | null
  discountAmount?: number | null
  totalAmount: number
  currency: string
  validUntil: string | Date
  terms?: string | null
  notes?: string | null
  client?: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  }
  items?: Array<{
    description: string
    category: string
    quantity: number
    unit?: string | null
    unitPrice: number
    totalPrice: number
  }>
}

/**
 * Generate and store both PDF and Excel for a quotation
 */
export async function generateAndStoreQuotationPDF(
  quotationData: QuotationPDFData,
  userId: string
): Promise<string> {
  try {
    // Generate both PDF and Excel buffers in parallel
    const [pdfBuffer, excelBuffer] = await Promise.all([
      generateQuotationPDF(quotationData),
      generateQuotationExcel(quotationData)
    ])
    
    // Use naming convention to match NAS backup files
    const { generateFileName } = await import('./nas-storage')
    const baseFilename = generateFileName(
      '{quotationNumber}.{clientName}.{projectName}.{title}',
      {
        quotationNumber: quotationData.quotationNumber,
        clientName: quotationData.client?.name,
        projectName: 'GeneralProject',
        title: quotationData.title
      }
    )
    const pdfFilename = `${baseFilename}.pdf`
    const excelFilename = `${baseFilename}.xlsx`


    // Save files locally instead of S3
    const storageDir = path.join(process.cwd(), 'storage', 'quotations')
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true })
    }
    
    const pdfLocalPath = path.join(storageDir, pdfFilename)
    const excelLocalPath = path.join(storageDir, excelFilename)
    
    // Write files to local storage
    await Promise.all([
      fs.promises.writeFile(pdfLocalPath, pdfBuffer),
      fs.promises.writeFile(excelLocalPath, excelBuffer)
    ])
    
    // Use local paths instead of cloud paths
    const pdfCloudPath = pdfLocalPath
    const excelCloudPath = excelLocalPath
    
    // Store both document records in database
    await prisma.$transaction([
      prisma.document.create({
        data: {
          id: uuidv4(),
          filename: pdfFilename,
          originalName: `${quotationData.quotationNumber} - ${quotationData.title}.pdf`,
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
          cloudStoragePath: pdfCloudPath,
          description: `Auto-generated PDF for quotation ${quotationData.quotationNumber} v${quotationData.version}`,
          category: 'PROPOSAL',
          quotationId: quotationData.id,
          uploadedById: userId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }),
      prisma.document.create({
        data: {
          id: uuidv4(),
          filename: excelFilename,
          originalName: `${quotationData.quotationNumber} - ${quotationData.title}.xlsx`,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: excelBuffer.length,
          cloudStoragePath: excelCloudPath,
          description: `Auto-generated Excel for quotation ${quotationData.quotationNumber} v${quotationData.version}`,
          category: 'PROPOSAL',
          quotationId: quotationData.id,
          uploadedById: userId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    ])
    
    console.log(`Generated and stored both PDF and Excel for quotation ${quotationData.quotationNumber}`)
    // Trigger NAS backup asynchronously
    backupQuotation(quotationData.id).then(result => {
      if (result.success) {
        console.log('✅ Quotation backed up to NAS:', result.pdfPath)
      } else {
        console.warn('⚠️ NAS backup failed:', result.error)
      }
    }).catch(err => console.error('❌ NAS backup error:', err))

    return pdfCloudPath
  } catch (error) {
    console.error('Error generating and storing quotation documents:', error)
    throw new Error(`Failed to generate documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Update existing PDF for a quotation (for when quotation is updated)
 */
export async function updateQuotationPDF(
  quotationData: QuotationPDFData,
  userId: string
): Promise<string> {
  try {
    // First, mark any existing PDFs as inactive
    await prisma.document.updateMany({
      where: {
        quotationId: quotationData.id,
        category: 'PROPOSAL',
        isActive: true
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })
    
    // Generate new PDF
    return await generateAndStoreQuotationPDF(quotationData, userId)
  } catch (error) {
    console.error('Error updating quotation PDF:', error)
    throw new Error(`Failed to update PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get the latest active PDF for a quotation
 */
export async function getQuotationPDF(quotationId: string): Promise<{
  cloudStoragePath: string
  filename: string
  createdAt: Date
} | null> {
  try {
    const document = await prisma.document.findFirst({
      where: {
        quotationId: quotationId,
        category: 'PROPOSAL',
        mimetype: 'application/pdf',
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        cloudStoragePath: true,
        filename: true,
        createdAt: true
      }
    })
    
    return document
  } catch (error) {
    console.error('Error fetching quotation PDF:', error)
    return null
  }
}

/**
 * Get the latest active Excel for a quotation
 */
export async function getQuotationExcel(quotationId: string): Promise<{
  cloudStoragePath: string
  filename: string
  createdAt: Date
} | null> {
  try {
    const document = await prisma.document.findFirst({
      where: {
        quotationId: quotationId,
        category: 'PROPOSAL',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        cloudStoragePath: true,
        filename: true,
        createdAt: true
      }
    })
    
    return document
  } catch (error) {
    console.error('Error fetching quotation Excel:', error)
    return null
  }
}

/**
 * Get all active documents (PDF and Excel) for a quotation
 */
export async function getQuotationDocuments(quotationId: string): Promise<{
  pdf: { cloudStoragePath: string; filename: string; createdAt: Date } | null
  excel: { cloudStoragePath: string; filename: string; createdAt: Date } | null
}> {
  try {
    const [pdf, excel] = await Promise.all([
      getQuotationPDF(quotationId),
      getQuotationExcel(quotationId)
    ])
    
    return { pdf, excel }
  } catch (error) {
    console.error('Error fetching quotation documents:', error)
    return { pdf: null, excel: null }
  }
}

/**
 * Delete all PDFs for a quotation (when quotation is deleted)
 */
export async function deleteQuotationPDFs(quotationId: string): Promise<void> {
  try {
    await prisma.document.updateMany({
      where: {
        quotationId: quotationId,
        category: 'PROPOSAL'
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Error deleting quotation PDFs:', error)
    // Don't throw error here as it's cleanup
  }
}

/**
 * Check if quotation has an active PDF
 */
export async function hasActivePDF(quotationId: string): Promise<boolean> {
  try {
    const count = await prisma.document.count({
      where: {
        quotationId: quotationId,
        category: 'PROPOSAL',
        isActive: true
      }
    })
    
    return count > 0
  } catch (error) {
    console.error('Error checking for active PDF:', error)
    return false
  }
}
