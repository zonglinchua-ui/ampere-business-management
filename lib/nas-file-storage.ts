/**
 * NAS File Storage Service
 * Replaces S3 cloud storage with local NAS storage
 * 
 * File structure on NAS:
 * A:\AMPERE WEB SERVER\
 *   ├── PROJECT\{ProjectNo}-{ProjectName}\
 *   │   ├── invoices & quotations from suppliers\
 *   │   ├── POs from customer\
 *   │   ├── documents\
 *   │   └── ...
 *   ├── TENDER\{Customer}\{Tender}\
 *   └── DOCUMENTS\{category}\
 */

import fs from 'fs'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { prisma } from './db'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

/**
 * Get NAS base path from settings
 */
async function getNASBasePath(): Promise<string> {
  try {
    let settings: any = {
      storage: {
        nasPath: ""
      }
    }

    try {
      const settingsData = await fsPromises.readFile(SETTINGS_FILE, 'utf-8')
      settings = JSON.parse(settingsData)
    } catch (error) {
      console.log('[NAS Storage] No settings file found, using environment variable')
    }

    const nasPath = settings.storage?.nasPath || process.env.NAS_PATH
    
    if (!nasPath) {
      throw new Error('NAS path not configured. Please set it in data/settings.json or NAS_PATH environment variable')
    }

    return nasPath
  } catch (error) {
    console.error('[NAS Storage] Error getting NAS path:', error)
    throw error
  }
}

/**
 * Ensure directory exists, create if it doesn't
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    if (!fs.existsSync(dirPath)) {
      await fsPromises.mkdir(dirPath, { recursive: true })
      console.log(`[NAS Storage] Created directory: ${dirPath}`)
    }
  } catch (error) {
    console.error(`[NAS Storage] Error creating directory ${dirPath}:`, error)
    throw error
  }
}

/**
 * Sanitize filename for cross-platform compatibility
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 200) // Limit length
}

/**
 * Upload file to NAS - Supplier Invoice
 */
export async function uploadSupplierInvoice(
  buffer: Buffer,
  fileName: string,
  projectId: string,
  projectNumber: string,
  projectName: string
): Promise<string> {
  try {
    const nasBasePath = await getNASBasePath()
    
    // Create project folder structure
    const projectFolderName = `${projectNumber}-${projectName.replace(/[<>:"/\\|?*]/g, '_')}`
    const invoicesFolder = path.join(
      nasBasePath,
      'PROJECT',
      projectFolderName,
      'invoices & quotations from suppliers'
    )
    
    await ensureDirectoryExists(invoicesFolder)
    
    // Generate unique filename
    const sanitizedFileName = sanitizeFileName(fileName)
    const timestamp = Date.now()
    const finalFileName = `${timestamp}-${sanitizedFileName}`
    const filePath = path.join(invoicesFolder, finalFileName)
    
    // Write file
    await fsPromises.writeFile(filePath, buffer)
    console.log(`[NAS Storage] Uploaded supplier invoice: ${filePath}`)
    
    // Return relative path from NAS base
    return path.relative(nasBasePath, filePath)
  } catch (error) {
    console.error('[NAS Storage] Error uploading supplier invoice:', error)
    throw error
  }
}

/**
 * Upload file to NAS - Customer PO
 */
export async function uploadCustomerPO(
  buffer: Buffer,
  fileName: string,
  projectId: string,
  projectNumber: string,
  projectName: string
): Promise<string> {
  try {
    const nasBasePath = await getNASBasePath()
    
    // Create project folder structure
    const projectFolderName = `${projectNumber}-${projectName.replace(/[<>:"/\\|?*]/g, '_')}`
    const poFolder = path.join(
      nasBasePath,
      'PROJECT',
      projectFolderName,
      'POs from customer'
    )
    
    await ensureDirectoryExists(poFolder)
    
    // Generate unique filename
    const sanitizedFileName = sanitizeFileName(fileName)
    const timestamp = Date.now()
    const finalFileName = `${timestamp}-${sanitizedFileName}`
    const filePath = path.join(poFolder, finalFileName)
    
    // Write file
    await fsPromises.writeFile(filePath, buffer)
    console.log(`[NAS Storage] Uploaded customer PO: ${filePath}`)
    
    // Return relative path from NAS base
    return path.relative(nasBasePath, filePath)
  } catch (error) {
    console.error('[NAS Storage] Error uploading customer PO:', error)
    throw error
  }
}

/**
 * Upload file to NAS - Project Document
 */
export async function uploadProjectDocument(
  buffer: Buffer,
  fileName: string,
  projectId: string,
  projectNumber: string,
  projectName: string,
  subfolder: string = 'documents'
): Promise<string> {
  try {
    const nasBasePath = await getNASBasePath()
    
    // Create project folder structure
    const projectFolderName = `${projectNumber}-${projectName.replace(/[<>:"/\\|?*]/g, '_')}`
    const documentFolder = path.join(
      nasBasePath,
      'PROJECT',
      projectFolderName,
      subfolder
    )
    
    await ensureDirectoryExists(documentFolder)
    
    // Generate unique filename
    const sanitizedFileName = sanitizeFileName(fileName)
    const timestamp = Date.now()
    const finalFileName = `${timestamp}-${sanitizedFileName}`
    const filePath = path.join(documentFolder, finalFileName)
    
    // Write file
    await fsPromises.writeFile(filePath, buffer)
    console.log(`[NAS Storage] Uploaded project document: ${filePath}`)
    
    // Return relative path from NAS base
    return path.relative(nasBasePath, filePath)
  } catch (error) {
    console.error('[NAS Storage] Error uploading project document:', error)
    throw error
  }
}

/**
 * Upload file to NAS - General Document
 */
export async function uploadGeneralDocument(
  buffer: Buffer,
  fileName: string,
  category: string = 'general'
): Promise<string> {
  try {
    const nasBasePath = await getNASBasePath()
    
    const documentFolder = path.join(
      nasBasePath,
      'DOCUMENTS',
      category
    )
    
    await ensureDirectoryExists(documentFolder)
    
    // Generate unique filename
    const sanitizedFileName = sanitizeFileName(fileName)
    const timestamp = Date.now()
    const finalFileName = `${timestamp}-${sanitizedFileName}`
    const filePath = path.join(documentFolder, finalFileName)
    
    // Write file
    await fsPromises.writeFile(filePath, buffer)
    console.log(`[NAS Storage] Uploaded general document: ${filePath}`)
    
    // Return relative path from NAS base
    return path.relative(nasBasePath, filePath)
  } catch (error) {
    console.error('[NAS Storage] Error uploading general document:', error)
    throw error
  }
}

/**
 * Get file from NAS
 */
export async function getFileBuffer(relativePath: string): Promise<Buffer> {
  try {
    const nasBasePath = await getNASBasePath()
    const fullPath = path.join(nasBasePath, relativePath)
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`)
    }
    
    return await fsPromises.readFile(fullPath)
  } catch (error) {
    console.error('[NAS Storage] Error reading file:', error)
    throw error
  }
}

/**
 * Delete file from NAS
 */
export async function deleteFile(relativePath: string): Promise<void> {
  try {
    const nasBasePath = await getNASBasePath()
    const fullPath = path.join(nasBasePath, relativePath)
    
    if (fs.existsSync(fullPath)) {
      await fsPromises.unlink(fullPath)
      console.log(`[NAS Storage] Deleted file: ${fullPath}`)
    }
  } catch (error) {
    console.error('[NAS Storage] Error deleting file:', error)
    throw error
  }
}

/**
 * Check if file exists on NAS
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const nasBasePath = await getNASBasePath()
    const fullPath = path.join(nasBasePath, relativePath)
    return fs.existsSync(fullPath)
  } catch (error) {
    return false
  }
}

/**
 * Get absolute file path (for serving files)
 */
export async function getAbsolutePath(relativePath: string): Promise<string> {
  const nasBasePath = await getNASBasePath()
  return path.join(nasBasePath, relativePath)
}
