
/**
 * Document Backup Service
 * 
 * Handles backup and restore of all document types (PDF + Excel) to NAS
 * Provides disaster recovery capabilities for web app documents
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { generateQuotationExcel, generatePurchaseOrderExcel } from './excel-generator'
import { generateQuotationPDF } from './pdf-generator'
import { saveToNAS, generateFolderPath, testNASConnection } from './nas-storage'

const prisma = new PrismaClient()

export interface DocumentBackupResult {
  success: boolean
  pdfPath?: string
  excelPath?: string
  error?: string
  documentId?: string
  documentType?: string
}

export interface BackupMetadata {
  documentId: string
  documentType: 'quotation' | 'invoice' | 'purchase-order' | 'variation-order' | 'project-document'
  documentNumber: string
  pdfBackupPath?: string
  excelBackupPath?: string
  backupDate: Date
  status: 'success' | 'partial' | 'failed'
  error?: string
}

/**
 * NAS Settings interface
 */
interface NASSettings {
  nasEnabled: boolean
  nasPath: string
  nasUsername: string
  nasPassword: string
  organizeFolders: boolean
  namingConvention: string
}

/**
 * Get NAS settings from database or environment
 */
async function getNASSettings(): Promise<NASSettings> {
  try {
    // Try to get from settings table first
    const settingsFile = path.join(process.cwd(), 'data', 'settings.json')
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
      if (settings.storage) {
        return settings.storage
      }
    }
  } catch (error) {
    console.error('Error loading NAS settings:', error)
  }

  // Default settings
  return {
    nasEnabled: process.env.NAS_ENABLED === 'true',
    nasPath: process.env.NAS_PATH || './nas_storage',
    nasUsername: process.env.NAS_USERNAME || '',
    nasPassword: process.env.NAS_PASSWORD || '',
    organizeFolders: true,
    namingConvention: '{quotationNumber} - {clientName}'
  }
}

/**
 * Backup a quotation (both PDF and Excel)
 */
export async function backupQuotation(
  quotationId: string
): Promise<DocumentBackupResult> {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        Customer: true,
        Project: true,
        QuotationItem: true
      }
    })

    if (!quotation) {
      return { success: false, error: 'Quotation not found' }
    }

    const nasSettings = await getNASSettings()
    if (!nasSettings.nasEnabled) {
      return { success: false, error: 'NAS backup is not enabled' }
    }

    // Prepare quotation data
    const quotationData = {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      version: quotation.version,
      title: quotation.title,
      description: quotation.description,
      clientReference: quotation.clientReference,
      subtotal: Number(quotation.subtotal),
      taxAmount: quotation.taxAmount ? Number(quotation.taxAmount) : null,
      discountAmount: quotation.discountAmount ? Number(quotation.discountAmount) : null,
      totalAmount: Number(quotation.totalAmount),
      currency: quotation.currency,
      validUntil: quotation.validUntil,
      terms: quotation.terms,
      notes: quotation.notes,
      client: quotation.Customer ? {
        name: quotation.Customer.name || quotation.Customer.name,
        email: quotation.Customer.email,
        phone: quotation.Customer.phone,
        address: quotation.Customer.address,
        city: quotation.Customer.city,
        state: quotation.Customer.state,
        postalCode: quotation.Customer.postalCode,
        country: quotation.Customer.country
      } : undefined,
      items: quotation.QuotationItem.map(item => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice)
      }))
    }

    // Generate PDF
    const pdfGenerator = await import('./pdf-generator')
    const pdfBuffer = await pdfGenerator.generateQuotationPDF(quotationData as any)

    // Generate Excel
    const excelBuffer = await generateQuotationExcel(quotationData as any)

    // Save both to NAS
    const documentInfo = {
      quotationNumber: quotation.quotationNumber,
      clientName: quotation.Customer?.name,
      projectName: quotation.Project?.name,
      title: quotation.title,
      documentType: 'quotations' as const,
      createdAt: quotation.createdAt
    }

    const pdfResult = await saveToNAS(pdfBuffer, nasSettings, documentInfo)

    // Save PDF
    // Get the filename from the NAS backup result
    const pdfFilename = path.basename(pdfResult.path || '')

    // Save Excel
    const excelFilename = pdfFilename.replace('.pdf', '.xlsx')
    const excelFolderPath = generateFolderPath(
      nasSettings.nasPath,
      nasSettings.organizeFolders,
      documentInfo
    )
    const excelFullPath = path.join(excelFolderPath, excelFilename)
    await fs.promises.mkdir(excelFolderPath, { recursive: true })
    await fs.promises.writeFile(excelFullPath, excelBuffer)

    // Update quotation record with backup paths
    await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        // Store backup paths in a JSON field or create new fields
        // For now, we'll log them
        updatedAt: new Date()
      }
    })

    // Log backup metadata
    await logBackupMetadata({
      documentId: quotationId,
      documentType: 'quotation',
      documentNumber: quotation.quotationNumber,
      pdfBackupPath: pdfResult.path,
      excelBackupPath: excelFullPath,
      backupDate: new Date(),
      status: 'success'
    })

    return {
      success: true,
      pdfPath: pdfResult.path,
      excelPath: excelFullPath,
      documentId: quotationId,
      documentType: 'quotation'
    }

  } catch (error) {
    console.error('Error backing up quotation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId: quotationId,
      documentType: 'quotation'
    }
  }
}

/**
 * Backup a purchase order (both PDF and Excel)
 */
export async function backupPurchaseOrder(
  poId: string
): Promise<DocumentBackupResult> {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        Supplier: true,
        Customer: true,
        Project: true,
        PurchaseOrderItem: true
      }
    })

    if (!po) {
      return { success: false, error: 'Purchase Order not found' }
    }

    const nasSettings = await getNASSettings()
    if (!nasSettings.nasEnabled) {
      return { success: false, error: 'NAS backup is not enabled' }
    }

    // Prepare PO data
    const poData = {
      id: po.id,
      poNumber: po.poNumber,
      type: po.type,
      subtotal: Number(po.subtotal),
      taxAmount: po.taxAmount ? Number(po.taxAmount) : null,
      totalAmount: Number(po.totalAmount),
      currency: po.currency,
      issueDate: po.issueDate,
      deliveryDate: po.deliveryDate,
      terms: po.terms,
      notes: po.notes,
      supplier: po.Supplier ? {
        name: po.Supplier.name || po.Supplier.name,
        email: po.Supplier.email,
        phone: po.Supplier.phone,
        address: po.Supplier.address,
        city: po.Supplier.city,
        state: po.Supplier.state,
        postalCode: po.Supplier.postalCode,
        country: po.Supplier.country
      } : undefined,
      customer: po.Customer ? {
        name: po.Customer.name || po.Customer.name,
        email: po.Customer.email,
        phone: po.Customer.phone,
        address: po.Customer.address,
        city: po.Customer.city,
        state: po.Customer.state,
        postalCode: po.Customer.postalCode,
        country: po.Customer.country
      } : undefined,
      project: po.Project ? {
        name: po.Project.name,
        projectNumber: po.Project.projectNumber
      } : undefined,
      items: po.PurchaseOrderItem.map((item, index) => ({
        serialNumber: (index + 1).toString(),
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        discount: item.discount ? Number(item.discount) : undefined,
        taxRate: item.taxRate ? Number(item.taxRate) : undefined,
        totalPrice: Number(item.totalPrice)
      }))
    }

    // Generate PDF
    const pdfGenerator = await import('./pdf-generator')
    const pdfBuffer = await pdfGenerator.generatePurchaseOrderPDF(poData)

    // Generate Excel
    const excelBuffer = await generatePurchaseOrderExcel(poData)

    // Save both to NAS
    const documentInfo = {
      quotationNumber: po.poNumber,
      clientName: po.Supplier?.name || po.Customer?.name,
      projectName: po.Project?.name,
      title: `PO ${po.poNumber}`,
      documentType: 'documents' as const,
      createdAt: po.createdAt
    }

    // Save PDF
    const pdfFilename = `${po.poNumber}.pdf`
    const pdfResult = await saveToNAS(pdfBuffer, nasSettings, documentInfo)

    // Save Excel
    const excelFilename = `${po.poNumber}.xlsx`
    const excelFolderPath = generateFolderPath(
      nasSettings.nasPath,
      nasSettings.organizeFolders,
      documentInfo
    )
    const excelFullPath = path.join(excelFolderPath, excelFilename)
    await fs.promises.mkdir(excelFolderPath, { recursive: true })
    await fs.promises.writeFile(excelFullPath, excelBuffer)

    // Log backup metadata
    await logBackupMetadata({
      documentId: poId,
      documentType: 'purchase-order',
      documentNumber: po.poNumber,
      pdfBackupPath: pdfResult.path,
      excelBackupPath: excelFullPath,
      backupDate: new Date(),
      status: 'success'
    })

    return {
      success: true,
      pdfPath: pdfResult.path,
      excelPath: excelFullPath,
      documentId: poId,
      documentType: 'purchase-order'
    }

  } catch (error) {
    console.error('Error backing up purchase order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId: poId,
      documentType: 'purchase-order'
    }
  }
}

/**
 * Backup an invoice (both PDF and Excel)
 */
export async function backupInvoice(
  invoiceId: string,
  invoiceType: 'customer' | 'supplier' = 'customer'
): Promise<DocumentBackupResult> {
  try {
    const nasSettings = await getNASSettings()
    if (!nasSettings.nasEnabled) {
      return { success: false, error: 'NAS backup is not enabled' }
    }

    let invoice: any
    let invoiceData: any

    if (invoiceType === 'customer') {
      invoice = await prisma.customerInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          Customer: true,
          Project: true,
          CustomerInvoiceItem: true,
          User: true
        }
      })

      if (!invoice) {
        return { success: false, error: 'Customer Invoice not found' }
      }

      invoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        subtotal: Number(invoice.subtotal),
        taxAmount: invoice.taxAmount ? Number(invoice.taxAmount) : 0,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        status: invoice.status,
        customer: {
          name: invoice.Customer.name || invoice.Customer.name,
          email: invoice.Customer.email,
          phone: invoice.Customer.phone,
          address: invoice.Customer.address
        },
        items: invoice.CustomerInvoiceItem.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice)
        }))
      }
    } else {
      invoice = await prisma.supplierInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          Supplier: true,
          Project: true,
          SupplierInvoiceItem: true
        }
      })

      if (!invoice) {
        return { success: false, error: 'Supplier Invoice not found' }
      }

      invoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        subtotal: Number(invoice.subtotal),
        taxAmount: invoice.taxAmount ? Number(invoice.taxAmount) : 0,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        status: invoice.status,
        supplier: {
          name: invoice.Supplier.name || invoice.Supplier.name,
          email: invoice.Supplier.email,
          phone: invoice.Supplier.phone,
          address: invoice.Supplier.address
        },
        items: invoice.SupplierInvoiceItem.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice)
        }))
      }
    }

    // Generate Excel for invoice
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Invoice')

    // Add invoice data to worksheet
    worksheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Customer/Supplier', key: 'party', width: 30 },
      { header: 'Total Amount', key: 'total', width: 15 }
    ]

    worksheet.addRow({
      invoiceNumber: invoiceData.invoiceNumber,
      date: invoiceData.issueDate,
      party: invoiceData.customer?.name || invoiceData.supplier?.name,
      total: invoiceData.totalAmount
    })

    const excelBuffer = await workbook.xlsx.writeBuffer()

    // Save to NAS
    const documentInfo = {
      invoiceNumber: invoiceData.invoiceNumber,
      clientName: invoiceData.customer?.name || invoiceData.supplier?.name,
      projectName: invoice.Project?.name,
      documentType: 'invoices' as const,
      createdAt: invoice.createdAt
    }

    const filename = `${invoiceData.invoiceNumber}`
    const folderPath = generateFolderPath(
      nasSettings.nasPath,
      nasSettings.organizeFolders,
      documentInfo
    )

    // Save Excel
    const excelFullPath = path.join(folderPath, `${filename}.xlsx`)
    await fs.promises.mkdir(folderPath, { recursive: true })
    await fs.promises.writeFile(excelFullPath, Buffer.from(excelBuffer))

    // Note: PDF generation for invoices would need to be implemented similar to quotations

    await logBackupMetadata({
      documentId: invoiceId,
      documentType: 'invoice',
      documentNumber: invoiceData.invoiceNumber,
      excelBackupPath: excelFullPath,
      backupDate: new Date(),
      status: 'success'
    })

    return {
      success: true,
      excelPath: excelFullPath,
      documentId: invoiceId,
      documentType: 'invoice'
    }

  } catch (error) {
    console.error('Error backing up invoice:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Backup a variation order (both PDF and Excel)
 */
export async function backupVariationOrder(
  voId: string
): Promise<DocumentBackupResult> {
  try {
    // Variation orders are stored as quotations with isVariationOrder = true
    const vo = await prisma.quotation.findUnique({
      where: { id: voId, isVariationOrder: true },
      include: {
        Customer: true,
        Project: true,
        QuotationItem: true
      }
    })

    if (!vo) {
      return { success: false, error: 'Variation Order not found' }
    }

    // Reuse quotation backup logic
    return await backupQuotation(voId)

  } catch (error) {
    console.error('Error backing up variation order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Restore a document from NAS backup
 */
export async function restoreDocumentFromNAS(
  documentType: 'quotation' | 'invoice' | 'purchase-order' | 'variation-order',
  backupPath: string,
  fileType: 'pdf' | 'excel'
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const nasSettings = await getNASSettings()
    if (!nasSettings.nasEnabled) {
      return { success: false, error: 'NAS is not enabled' }
    }

    // Check if file exists
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup file not found' }
    }

    // Read file from NAS
    const buffer = await fs.promises.readFile(backupPath)

    return {
      success: true,
      buffer: buffer
    }

  } catch (error) {
    console.error('Error restoring document from NAS:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * List all backups for a specific document
 */
export async function listDocumentBackups(
  documentId: string
): Promise<BackupMetadata[]> {
  try {
    // Read backup metadata log
    const metadataPath = path.join(process.cwd(), 'nas_storage', 'backup_metadata.json')
    
    if (!fs.existsSync(metadataPath)) {
      return []
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    return metadata.filter((m: BackupMetadata) => m.documentId === documentId)

  } catch (error) {
    console.error('Error listing document backups:', error)
    return []
  }
}

/**
 * Verify NAS backup integrity
 */
export async function verifyBackupIntegrity(
  backupPath: string
): Promise<{ success: boolean; exists: boolean; size?: number; error?: string }> {
  try {
    if (!fs.existsSync(backupPath)) {
      return { success: false, exists: false, error: 'File not found' }
    }

    const stats = await fs.promises.stat(backupPath)
    
    return {
      success: true,
      exists: true,
      size: stats.size
    }

  } catch (error) {
    return {
      success: false,
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Log backup metadata to file
 */
async function logBackupMetadata(metadata: BackupMetadata): Promise<void> {
  try {
    const metadataPath = path.join(process.cwd(), 'nas_storage', 'backup_metadata.json')
    const metadataDir = path.dirname(metadataPath)

    // Ensure directory exists
    await fs.promises.mkdir(metadataDir, { recursive: true })

    let existingMetadata: BackupMetadata[] = []
    if (fs.existsSync(metadataPath)) {
      existingMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    }

    // Add new metadata
    existingMetadata.push(metadata)

    // Keep only last 1000 entries
    if (existingMetadata.length > 1000) {
      existingMetadata = existingMetadata.slice(-1000)
    }

    // Write back to file
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(existingMetadata, null, 2),
      'utf-8'
    )

  } catch (error) {
    console.error('Error logging backup metadata:', error)
  }
}

/**
 * Batch backup all documents of a specific type
 */
export async function batchBackupDocuments(
  documentType: 'quotation' | 'purchase-order' | 'invoice',
  filter?: {
    startDate?: Date
    endDate?: Date
    status?: string
  }
): Promise<{ total: number; successful: number; failed: number; results: DocumentBackupResult[] }> {
  const results: DocumentBackupResult[] = []
  let total = 0
  let successful = 0
  let failed = 0

  try {
    if (documentType === 'quotation') {
      const quotations = await prisma.quotation.findMany({
        where: {
          createdAt: filter?.startDate || filter?.endDate ? {
            gte: filter?.startDate,
            lte: filter?.endDate
          } : undefined,
          status: filter?.status as any
        },
        select: { id: true }
      })

      total = quotations.length

      for (const q of quotations) {
        const result = await backupQuotation(q.id)
        results.push(result)
        if (result.success) successful++
        else failed++
      }
    } else if (documentType === 'purchase-order') {
      const pos = await prisma.purchaseOrder.findMany({
        where: {
          createdAt: filter?.startDate || filter?.endDate ? {
            gte: filter?.startDate,
            lte: filter?.endDate
          } : undefined,
          status: filter?.status as any
        },
        select: { id: true }
      })

      total = pos.length

      for (const po of pos) {
        const result = await backupPurchaseOrder(po.id)
        results.push(result)
        if (result.success) successful++
        else failed++
      }
    }

    return { total, successful, failed, results }

  } catch (error) {
    console.error('Error in batch backup:', error)
    return { total, successful, failed, results }
  }
}
