

import fs from 'fs'
import path from 'path'

interface NASSettings {
  nasEnabled: boolean
  nasPath: string
  nasUsername: string
  nasPassword: string
  organizeFolders: boolean
  namingConvention: string
}

/**
 * Generate filename based on naming convention
 */
export function generateFileName(
  convention: string,
  quotationData: {
    quotationNumber: string
    clientName?: string
    projectName?: string
    title?: string
  }
): string {
  let filename = convention
    .replace('{quotationNumber}', quotationData.quotationNumber || 'Unknown')
    .replace('{clientName}', sanitizeFilename(quotationData.clientName || 'Unknown Client'))
    .replace('{projectName}', sanitizeFilename(quotationData.projectName || 'General Project'))
    .replace('{title}', sanitizeFilename(quotationData.title || 'Quotation'))
  
  // Clean up any double dots or spaces
  filename = filename.replace(/\.\./g, '.').replace(/\s+/g, ' ').trim()
  
  return `${filename}.pdf`
}

/**
 * Generate folder structure based on organization settings
 * Structure: basePath/[documentType]/[year]/[clientName]/[projectName]
 */
export function generateFolderPath(
  basePath: string,
  organizeFolders: boolean,
  documentData: {
    clientName?: string
    projectName?: string
    documentType?: 'quotations' | 'invoices' | 'projects' | 'documents'
    createdAt?: Date | string
  }
): string {
  // Get the year from the document's creation date or current year
  const year = documentData.createdAt 
    ? new Date(documentData.createdAt).getFullYear().toString()
    : new Date().getFullYear().toString()
  
  // Start with document type folder
  const documentType = documentData.documentType || 'documents'
  let folderPath = path.join(basePath, documentType, year)

  if (!organizeFolders) {
    return folderPath
  }

  // Add client folder if available
  return folderPath
}

/**
 * Save PDF to NAS storage with year-based organization
 */
export async function saveToNAS(
  pdfBuffer: Buffer,
  nasSettings: NASSettings,
  documentData: {
    quotationNumber?: string
    invoiceNumber?: string
    projectName?: string
    clientName?: string
    customerName?: string
    title?: string
    documentType?: 'quotations' | 'invoices' | 'projects' | 'documents'
    createdAt?: Date | string
  }
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    if (!nasSettings.nasEnabled || !nasSettings.nasPath) {
      return { success: false, error: 'NAS storage not configured' }
    }

    // Normalize client/customer name
    const clientName = documentData.clientName || documentData.customerName
    
    // Prepare data for filename generation (backward compatible)
    const quotationData = {
      quotationNumber: documentData.quotationNumber || documentData.invoiceNumber || 'Document',
      clientName: clientName,
      projectName: documentData.projectName,
      title: documentData.title
    }

    // Generate filename
    const filename = generateFileName(nasSettings.namingConvention, quotationData)
    
    // Generate folder path with year-based structure
    const folderPath = generateFolderPath(
      nasSettings.nasPath,
      nasSettings.organizeFolders,
      {
        clientName: clientName,
        projectName: documentData.projectName,
        documentType: documentData.documentType || 'documents',
        createdAt: documentData.createdAt
      }
    )
    
    // Create full file path
    const fullPath = path.join(folderPath, filename)
    
    // Ensure directory exists (create if needed)
    await ensureDirectoryExists(folderPath)
    
    // Write file to NAS
    await fs.promises.writeFile(fullPath, pdfBuffer)
    
    return { success: true, path: fullPath }
    
  } catch (error) {
    console.error('Error saving to NAS:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Test NAS connection
 */
export async function testNASConnection(nasSettings: NASSettings): Promise<{
  success: boolean
  error?: string
}> {
  try {
    if (!nasSettings.nasEnabled || !nasSettings.nasPath) {
      return { success: false, error: 'NAS path not configured' }
    }

    // Try to access the NAS directory
    await fs.promises.access(nasSettings.nasPath, fs.constants.R_OK | fs.constants.W_OK)
    
    // Try to write a test file
    const testFilePath = path.join(nasSettings.nasPath, 'test-connection.tmp')
    const testContent = 'Connection test - ' + new Date().toISOString()
    
    await fs.promises.writeFile(testFilePath, testContent)
    
    // Try to read it back
    const readContent = await fs.promises.readFile(testFilePath, 'utf-8')
    
    // Clean up test file
    await fs.promises.unlink(testFilePath)
    
    if (readContent === testContent) {
      return { success: true }
    } else {
      return { success: false, error: 'Test file content mismatch' }
    }
    
  } catch (error) {
    console.error('NAS connection test failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}

/**
 * Save Invoice to NAS storage
 */
export async function saveInvoiceToNAS(
  pdfBuffer: Buffer,
  nasSettings: NASSettings,
  invoiceData: {
    invoiceNumber: string
    customerName?: string
    projectName?: string
    title?: string
    createdAt?: Date | string
  }
): Promise<{ success: boolean; path?: string; error?: string }> {
  return saveToNAS(pdfBuffer, nasSettings, {
    invoiceNumber: invoiceData.invoiceNumber,
    customerName: invoiceData.customerName,
    projectName: invoiceData.projectName,
    title: invoiceData.title,
    documentType: 'invoices',
    createdAt: invoiceData.createdAt
  })
}

/**
 * Save Project Document to NAS storage
 */
export async function saveProjectDocumentToNAS(
  pdfBuffer: Buffer,
  nasSettings: NASSettings,
  projectData: {
    projectName: string
    customerName?: string
    documentTitle?: string
    createdAt?: Date | string
  }
): Promise<{ success: boolean; path?: string; error?: string }> {
  return saveToNAS(pdfBuffer, nasSettings, {
    projectName: projectData.projectName,
    customerName: projectData.customerName,
    title: projectData.documentTitle || projectData.projectName,
    documentType: 'projects',
    createdAt: projectData.createdAt
  })
}

/**
 * Sanitize filename for cross-platform compatibility
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .substring(0, 100) // Limit length
}

/**
 * Ensure directory exists, create if it doesn't
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.access(dirPath, fs.constants.F_OK)
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(dirPath, { recursive: true })
  }
}

