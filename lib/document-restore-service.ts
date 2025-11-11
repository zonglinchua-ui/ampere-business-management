
/**
 * Document Restore Service
 * 
 * Handles restoration of documents from NAS backups after web app breakdown/disaster
 * Provides UI and API for easy document recovery
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface RestoreOptions {
  overwrite?: boolean
  restoreToDatabase?: boolean
  generateThumbnail?: boolean
}

export interface RestoreResult {
  success: boolean
  documentId?: string
  documentType?: string
  pdfRestored?: boolean
  excelRestored?: boolean
  error?: string
  metadata?: any
}

export interface NASDocument {
  path: string
  filename: string
  type: 'pdf' | 'excel'
  size: number
  modifiedDate: Date
  documentNumber?: string
  year?: string
  customerName?: string
  projectName?: string
}

/**
 * Scan NAS for all available backups
 */
export async function scanNASBackups(
  nasBasePath: string = './nas_storage'
): Promise<{
  quotations: NASDocument[]
  invoices: NASDocument[]
  purchaseOrders: NASDocument[]
  projects: NASDocument[]
  total: number
}> {
  const quotations: NASDocument[] = []
  const invoices: NASDocument[] = []
  const purchaseOrders: NASDocument[] = []
  const projects: NASDocument[] = []

  try {
    // Scan quotations folder
    const quotationsPath = path.join(nasBasePath, 'quotations')
    if (fs.existsSync(quotationsPath)) {
      await scanFolder(quotationsPath, quotations, 'quotations')
    }

    // Scan invoices folder
    const invoicesPath = path.join(nasBasePath, 'invoices')
    if (fs.existsSync(invoicesPath)) {
      await scanFolder(invoicesPath, invoices, 'invoices')
    }

    // Scan documents folder (for POs)
    const documentsPath = path.join(nasBasePath, 'documents')
    if (fs.existsSync(documentsPath)) {
      await scanFolder(documentsPath, purchaseOrders, 'purchase-orders')
    }

    // Scan projects folder
    const projectsPath = path.join(nasBasePath, 'projects')
    if (fs.existsSync(projectsPath)) {
      await scanFolder(projectsPath, projects, 'projects')
    }

    return {
      quotations,
      invoices,
      purchaseOrders,
      projects,
      total: quotations.length + invoices.length + purchaseOrders.length + projects.length
    }

  } catch (error) {
    console.error('Error scanning NAS backups:', error)
    return {
      quotations: [],
      invoices: [],
      purchaseOrders: [],
      projects: [],
      total: 0
    }
  }
}

/**
 * Recursively scan a folder for documents
 */
async function scanFolder(
  folderPath: string,
  results: NASDocument[],
  documentType: string,
  parentPath: string = ''
): Promise<void> {
  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name)

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanFolder(fullPath, results, documentType, path.join(parentPath, entry.name))
      } else if (entry.isFile()) {
        // Check if it's a PDF or Excel file
        const ext = path.extname(entry.name).toLowerCase()
        if (ext === '.pdf' || ext === '.xlsx' || ext === '.xls') {
          const stats = await fs.promises.stat(fullPath)
          
          // Parse path to extract metadata
          const pathParts = parentPath.split(path.sep).filter(Boolean)
          const year = pathParts.length > 0 ? pathParts[0] : undefined
          const customerName = pathParts.length > 1 ? pathParts[1] : undefined
          const projectName = pathParts.length > 2 ? pathParts[2] : undefined
          
          results.push({
            path: fullPath,
            filename: entry.name,
            type: ext === '.pdf' ? 'pdf' : 'excel',
            size: stats.size,
            modifiedDate: stats.mtime,
            documentNumber: parseDocumentNumber(entry.name),
            year,
            customerName,
            projectName
          })
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning folder ${folderPath}:`, error)
  }
}

/**
 * Parse document number from filename
 */
function parseDocumentNumber(filename: string): string | undefined {
  // Remove extension
  const nameWithoutExt = path.basename(filename, path.extname(filename))
  
  // Try to extract document number (assuming format: Q25-XXX or similar)
  const match = nameWithoutExt.match(/^([A-Z]\d{2}-\d+)/)
  return match ? match[1] : nameWithoutExt
}

/**
 * Restore a specific document from NAS
 */
export async function restoreDocument(
  nasFilePath: string,
  documentType: 'quotation' | 'invoice' | 'purchase-order' | 'project-document',
  options: RestoreOptions = {}
): Promise<RestoreResult> {
  try {
    // Verify file exists
    if (!fs.existsSync(nasFilePath)) {
      return {
        success: false,
        error: 'File not found in NAS backup'
      }
    }

    // Read file
    const fileBuffer = await fs.promises.readFile(nasFilePath)
    const filename = path.basename(nasFilePath)
    const fileType = path.extname(nasFilePath).toLowerCase() === '.pdf' ? 'pdf' : 'excel'

    // If restoreToDatabase is true, attempt to parse and restore to database
    if (options.restoreToDatabase && fileType === 'excel') {
      // For Excel files, we can potentially parse and restore to database
      const parseResult = await parseAndRestoreExcel(fileBuffer, documentType)
      
      if (parseResult.success) {
        return {
          success: true,
          documentId: parseResult.documentId,
          documentType,
          excelRestored: true,
          metadata: parseResult.metadata
        }
      }
    }

    // Otherwise, just make the file available for download
    return {
      success: true,
      documentType,
      [fileType === 'pdf' ? 'pdfRestored' : 'excelRestored']: true,
      metadata: {
        filename,
        path: nasFilePath,
        size: fileBuffer.length
      }
    }

  } catch (error) {
    console.error('Error restoring document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Parse Excel file and restore to database
 */
async function parseAndRestoreExcel(
  excelBuffer: Buffer,
  documentType: string
): Promise<{ success: boolean; documentId?: string; metadata?: any; error?: string }> {
  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(excelBuffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return { success: false, error: 'No worksheet found in Excel file' }
    }

    // Parse based on document type
    // This is a simplified example - full implementation would need to handle each document type
    
    if (documentType === 'quotation') {
      // Extract quotation data from Excel
      // This would need to match the structure created in excel-generator.ts
      
      // For now, return a placeholder
      return {
        success: false,
        error: 'Excel parsing not yet implemented for quotations'
      }
    }

    return {
      success: false,
      error: 'Document type not supported for Excel restoration'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Bulk restore documents from NAS
 */
export async function bulkRestoreDocuments(
  nasBasePath: string,
  documentType: 'quotation' | 'invoice' | 'purchase-order' | 'all' = 'all',
  options: RestoreOptions = {}
): Promise<{
  total: number
  successful: number
  failed: number
  results: RestoreResult[]
}> {
  const results: RestoreResult[] = []
  let total = 0
  let successful = 0
  let failed = 0

  try {
    const scanned = await scanNASBackups(nasBasePath)

    const documentsToRestore: { path: string; type: string }[] = []

    if (documentType === 'all' || documentType === 'quotation') {
      scanned.quotations.forEach(doc => {
        documentsToRestore.push({ path: doc.path, type: 'quotation' })
      })
    }

    if (documentType === 'all' || documentType === 'invoice') {
      scanned.invoices.forEach(doc => {
        documentsToRestore.push({ path: doc.path, type: 'invoice' })
      })
    }

    if (documentType === 'all' || documentType === 'purchase-order') {
      scanned.purchaseOrders.forEach(doc => {
        documentsToRestore.push({ path: doc.path, type: 'purchase-order' })
      })
    }

    total = documentsToRestore.length

    for (const doc of documentsToRestore) {
      const result = await restoreDocument(doc.path, doc.type as any, options)
      results.push(result)
      
      if (result.success) {
        successful++
      } else {
        failed++
      }
    }

    return { total, successful, failed, results }

  } catch (error) {
    console.error('Error in bulk restore:', error)
    return { total, successful, failed, results }
  }
}

/**
 * Get backup statistics
 */
export async function getBackupStatistics(
  nasBasePath: string = './nas_storage'
): Promise<{
  totalDocuments: number
  totalSize: number
  byType: {
    quotations: { count: number; size: number }
    invoices: { count: number; size: number }
    purchaseOrders: { count: number; size: number }
    projects: { count: number; size: number }
  }
  byYear: Record<string, number>
  oldestBackup?: Date
  newestBackup?: Date
}> {
  try {
    const scanned = await scanNASBackups(nasBasePath)

    const stats = {
      totalDocuments: scanned.total,
      totalSize: 0,
      byType: {
        quotations: { count: 0, size: 0 },
        invoices: { count: 0, size: 0 },
        purchaseOrders: { count: 0, size: 0 },
        projects: { count: 0, size: 0 }
      },
      byYear: {} as Record<string, number>,
      oldestBackup: undefined as Date | undefined,
      newestBackup: undefined as Date | undefined
    }

    // Calculate statistics
    const allDocs = [
      ...scanned.quotations,
      ...scanned.invoices,
      ...scanned.purchaseOrders,
      ...scanned.projects
    ]

    for (const doc of allDocs) {
      stats.totalSize += doc.size

      // Track oldest and newest
      if (!stats.oldestBackup || doc.modifiedDate < stats.oldestBackup) {
        stats.oldestBackup = doc.modifiedDate
      }
      if (!stats.newestBackup || doc.modifiedDate > stats.newestBackup) {
        stats.newestBackup = doc.modifiedDate
      }

      // Count by year
      if (doc.year) {
        stats.byYear[doc.year] = (stats.byYear[doc.year] || 0) + 1
      }
    }

    // Count by type
    stats.byType.quotations.count = scanned.quotations.length
    stats.byType.quotations.size = scanned.quotations.reduce((sum, doc) => sum + doc.size, 0)

    stats.byType.invoices.count = scanned.invoices.length
    stats.byType.invoices.size = scanned.invoices.reduce((sum, doc) => sum + doc.size, 0)

    stats.byType.purchaseOrders.count = scanned.purchaseOrders.length
    stats.byType.purchaseOrders.size = scanned.purchaseOrders.reduce((sum, doc) => sum + doc.size, 0)

    stats.byType.projects.count = scanned.projects.length
    stats.byType.projects.size = scanned.projects.reduce((sum, doc) => sum + doc.size, 0)

    return stats

  } catch (error) {
    console.error('Error getting backup statistics:', error)
    return {
      totalDocuments: 0,
      totalSize: 0,
      byType: {
        quotations: { count: 0, size: 0 },
        invoices: { count: 0, size: 0 },
        purchaseOrders: { count: 0, size: 0 },
        projects: { count: 0, size: 0 }
      },
      byYear: {}
    }
  }
}
