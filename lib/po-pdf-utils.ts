
import { PrismaClient } from '@prisma/client'
import { generatePurchaseOrderPDF } from './pdf-generator'
import { generatePurchaseOrderExcel } from './excel-generator'
import { uploadFile } from './s3'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

export interface POPDFData {
  id: string
  poNumber: string
  type: string
  subtotal: number
  taxAmount?: number | null
  discountAmount?: number
  totalAmount: number
  currency: string
  issueDate?: string | Date | null
  deliveryDate: string | Date | null
  deliveryAddress?: string | null
  terms?: string | null
  notes?: string | null
  supplier?: {
    name: string
    companyName?: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  }
  customer?: {
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
    id: string
    name: string
    projectNumber?: string
  }
  items?: Array<{
    serialNumber?: string
    description: string
    category: string
    quantity: number
    unit?: string | null
    unitPrice: number
    discount?: number
    taxRate?: number
    totalPrice: number
  }>
}

/**
 * Generate and store both PDF and Excel for a Purchase Order
 */
export async function generateAndStorePOPDF(
  poData: POPDFData,
  userId: string
): Promise<string> {
  try {
    // Generate both PDF and Excel buffers in parallel
    const [pdfBuffer, excelBuffer] = await Promise.all([
      generatePurchaseOrderPDF(poData),
      generatePurchaseOrderExcel(poData)
    ])
    
    // Create filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const pdfFilename = `po-${poData.poNumber}-${timestamp}.pdf`
    const excelFilename = `po-${poData.poNumber}-${timestamp}.xlsx`
    
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
          originalName: `${poData.poNumber}.pdf`,
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
          cloudStoragePath: pdfCloudPath,
          description: `Auto-generated PDF for purchase order ${poData.poNumber}`,
          category: 'GENERAL',
          purchaseOrderId: poData.id,
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
          originalName: `${poData.poNumber}.xlsx`,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: excelBuffer.length,
          cloudStoragePath: excelCloudPath,
          description: `Auto-generated Excel for purchase order ${poData.poNumber}`,
          category: 'GENERAL',
          purchaseOrderId: poData.id,
          uploadedById: userId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    ])
    
    console.log(`✅ Generated and stored both PDF and Excel for PO ${poData.poNumber}`)
    return pdfCloudPath
  } catch (error) {
    console.error('❌ Error generating and storing PO documents:', error)
    throw new Error(`Failed to generate documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Update existing PDF for a Purchase Order
 */
export async function updatePOPDF(
  poData: POPDFData,
  userId: string
): Promise<string> {
  try {
    // First, mark any existing PDFs as inactive
    await prisma.document.updateMany({
      where: {
        purchaseOrderId: poData.id,
        category: 'GENERAL',
        isActive: true
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })
    
    // Generate new PDF
    return await generateAndStorePOPDF(poData, userId)
  } catch (error) {
    console.error('❌ Error updating PO PDF:', error)
    throw new Error(`Failed to update PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get the latest active PDF for a Purchase Order
 */
export async function getPOPDF(poId: string): Promise<{
  cloudStoragePath: string
  filename: string
  createdAt: Date
} | null> {
  try {
    const document = await prisma.document.findFirst({
      where: {
        purchaseOrderId: poId,
        category: 'GENERAL',
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
    console.error('❌ Error getting PO PDF:', error)
    return null
  }
}

/**
 * Get the latest active Excel for a Purchase Order
 */
export async function getPOExcel(poId: string): Promise<{
  cloudStoragePath: string
  filename: string
  createdAt: Date
} | null> {
  try {
    const document = await prisma.document.findFirst({
      where: {
        purchaseOrderId: poId,
        category: 'GENERAL',
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
    console.error('❌ Error getting PO Excel:', error)
    return null
  }
}
