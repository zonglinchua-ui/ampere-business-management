
import { PrismaClient } from '@prisma/client'
import { generateQuotationPDF } from './pdf-generator'
import { generateQuotationExcel } from './excel-generator'
import { uploadFile } from './s3'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

export interface VariationOrderPDFData {
  id: string
  variationNumber: string
  projectNumber: string
  title: string
  description?: string | null
  type: string
  amount: number
  currency: string
  submittedDate?: string | Date | null
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
  project?: {
    name: string
    projectNumber: string
  }
}

/**
 * Generate and store PDF for a variation order (using quotation template)
 */
export async function generateAndStoreVariationOrderPDF(
  voData: VariationOrderPDFData,
  userId: string
): Promise<string> {
  try {
    // Convert VO data to quotation format for PDF generation
    const quotationData = {
      id: voData.id,
      quotationNumber: voData.variationNumber,
      version: 1,
      title: `Variation Order: ${voData.title}`,
      description: voData.description,
      clientReference: voData.projectNumber,
      subtotal: voData.amount,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: voData.amount,
      currency: voData.currency,
      validUntil: voData.submittedDate || new Date(),
      terms: `This Variation Order ${voData.type === 'ADDITION' ? 'adds to' : voData.type === 'DEDUCTION' ? 'deducts from' : 'modifies'} the original contract value.`,
      notes: voData.description,
      client: voData.client,
      items: [
        {
          description: voData.title,
          category: 'GENERAL',
          quantity: 1,
          unit: 'lump sum',
          unitPrice: voData.amount,
          totalPrice: voData.amount,
        }
      ]
    }
    
    // Generate both PDF and Excel buffers in parallel
    const [pdfBuffer, excelBuffer] = await Promise.all([
      generateQuotationPDF(quotationData),
      generateQuotationExcel(quotationData)
    ])
    
    // Create filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const pdfFilename = `variation-order-${voData.variationNumber}-${timestamp}.pdf`
    const excelFilename = `variation-order-${voData.variationNumber}-${timestamp}.xlsx`
    
    // Upload both files to S3 in parallel
    const [pdfCloudPath, excelCloudPath] = await Promise.all([
      uploadFile(pdfBuffer, pdfFilename),
      uploadFile(excelBuffer, excelFilename)
    ])
    
    // Store both document records in database
    await prisma.$transaction([
      prisma.document.create({
        data: {
          id: uuidv4(),
          filename: pdfFilename,
          originalName: `${voData.variationNumber} - ${voData.title}.pdf`,
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
          cloudStoragePath: pdfCloudPath,
          description: `Auto-generated PDF for variation order ${voData.variationNumber}`,
          category: 'CONTRACT',
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
          originalName: `${voData.variationNumber} - ${voData.title}.xlsx`,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: excelBuffer.length,
          cloudStoragePath: excelCloudPath,
          description: `Auto-generated Excel for variation order ${voData.variationNumber}`,
          category: 'CONTRACT',
          uploadedById: userId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    ])
    
    console.log(`Generated and stored both PDF and Excel for variation order ${voData.variationNumber}`)
    return pdfCloudPath
  } catch (error) {
    console.error('Error generating and storing variation order documents:', error)
    throw new Error(`Failed to generate documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get the latest active PDF for a variation order
 */
export async function getVariationOrderPDF(variationOrderId: string): Promise<{
  cloudStoragePath: string
  filename: string
  createdAt: Date
} | null> {
  try {
    const document = await prisma.document.findFirst({
      where: {
        category: 'CONTRACT',
        mimetype: 'application/pdf',
        description: {
          contains: variationOrderId
        },
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
    console.error('Error fetching variation order PDF:', error)
    return null
  }
}
