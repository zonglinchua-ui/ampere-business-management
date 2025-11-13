/**
 * NAS Archival Service
 * Automatically moves deleted projects, tenders, and quotations to DELETED folders on NAS
 */

import fs from 'fs'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { prisma } from './db'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

interface ArchivalResult {
  success: boolean
  archivedPath?: string
  error?: string
}

/**
 * Get NAS base path from settings or environment
 */
async function getNASBasePath(): Promise<string | null> {
  try {
    // Load settings from JSON file
    let settings: any = {
      storage: {
        nasPath: ""
      }
    }

    try {
      const settingsData = await fsPromises.readFile(SETTINGS_FILE, 'utf-8')
      settings = JSON.parse(settingsData)
    } catch (error) {
      console.log('[NAS Archival] No settings file found, using environment variable')
    }

    return settings.storage?.nasPath || process.env.NAS_PATH || null
  } catch (error) {
    console.error('[NAS Archival] Error getting NAS path:', error)
    return process.env.NAS_PATH || null
  }
}

/**
 * Ensure directory exists, create if it doesn't
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.access(dirPath, fs.constants.F_OK)
  } catch (error) {
    await fs.promises.mkdir(dirPath, { recursive: true })
    console.log(`[NAS Archival] Created directory: ${dirPath}`)
  }
}

/**
 * Move directory to DELETED folder
 */
async function moveDirectoryToDeleted(
  sourcePath: string,
  deletedBasePath: string,
  itemName: string
): Promise<ArchivalResult> {
  try {
    // Check if source exists
    try {
      await fs.promises.access(sourcePath, fs.constants.F_OK)
    } catch (error) {
      console.warn(`[NAS Archival] Source path does not exist: ${sourcePath}`)
      return { success: true, archivedPath: 'N/A - Source not found' }
    }

    // Ensure DELETED directory exists
    await ensureDirectoryExists(deletedBasePath)

    // Add timestamp to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const targetName = `${itemName}_deleted_${timestamp}`
    const targetPath = path.join(deletedBasePath, targetName)

    // Move the directory
    await fs.promises.rename(sourcePath, targetPath)

    console.log(`[NAS Archival] ✅ Moved: ${sourcePath} -> ${targetPath}`)
    return { success: true, archivedPath: targetPath }

  } catch (error) {
    console.error('[NAS Archival] Error moving directory:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Copy directory to DELETED folder (for soft deletes)
 */
async function copyDirectoryToDeleted(
  sourcePath: string,
  deletedBasePath: string,
  itemName: string
): Promise<ArchivalResult> {
  try {
    // Check if source exists
    try {
      await fs.promises.access(sourcePath, fs.constants.F_OK)
    } catch (error) {
      console.warn(`[NAS Archival] Source path does not exist: ${sourcePath}`)
      return { success: true, archivedPath: 'N/A - Source not found' }
    }

    // Ensure DELETED directory exists
    await ensureDirectoryExists(deletedBasePath)

    // Add timestamp to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const targetName = `${itemName}_deleted_${timestamp}`
    const targetPath = path.join(deletedBasePath, targetName)

    // Copy the directory recursively
    await copyDirectory(sourcePath, targetPath)

    console.log(`[NAS Archival] ✅ Copied: ${sourcePath} -> ${targetPath}`)
    return { success: true, archivedPath: targetPath }

  } catch (error) {
    console.error('[NAS Archival] Error copying directory:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Recursively copy directory
 */
async function copyDirectory(source: string, target: string): Promise<void> {
  await ensureDirectoryExists(target)

  const entries = await fs.promises.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const targetPath = path.join(target, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath)
    } else {
      await fs.promises.copyFile(sourcePath, targetPath)
    }
  }
}

/**
 * Archive deleted project folder
 * Moves project folder from projects/ to projects/DELETED/
 */
export async function archiveDeletedProject(
  projectNumber: string,
  projectName: string,
  softDelete: boolean = true
): Promise<ArchivalResult> {
  try {
    const nasBasePath = await getNASBasePath()

    if (!nasBasePath) {
      console.warn('[NAS Archival] NAS path not configured, skipping project archival')
      return {
        success: false,
        error: 'NAS path not configured'
      }
    }

    // Sanitize project name
    const sanitizedName = projectName.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100)
    const projectFolderName = `${projectNumber}-${sanitizedName}`

    const sourcePath = path.join(nasBasePath, 'projects', projectFolderName)
    const deletedBasePath = path.join(nasBasePath, 'projects', 'DELETED')

    console.log(`[NAS Archival] Archiving project: ${projectFolderName}`)

    // For soft deletes, copy instead of move (keep original for recovery)
    if (softDelete) {
      return await copyDirectoryToDeleted(sourcePath, deletedBasePath, projectFolderName)
    } else {
      return await moveDirectoryToDeleted(sourcePath, deletedBasePath, projectFolderName)
    }

  } catch (error) {
    console.error('[NAS Archival] Error archiving project:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Archive deleted quotation PDFs
 * Copies quotation PDFs from quotations/[year]/ to quotations/DELETED/
 */
export async function archiveDeletedQuotation(
  quotationNumber: string,
  quotationId: string,
  createdAt?: Date
): Promise<ArchivalResult> {
  try {
    const nasBasePath = await getNASBasePath()

    if (!nasBasePath) {
      console.warn('[NAS Archival] NAS path not configured, skipping quotation archival')
      return {
        success: false,
        error: 'NAS path not configured'
      }
    }

    const year = createdAt ? new Date(createdAt).getFullYear().toString() : new Date().getFullYear().toString()
    
    // Look for quotation PDFs in the year folder
    const quotationsYearPath = path.join(nasBasePath, 'quotations', year)
    const deletedBasePath = path.join(nasBasePath, 'quotations', 'DELETED')

    console.log(`[NAS Archival] Archiving quotation: ${quotationNumber}`)

    // Ensure DELETED directory exists
    await ensureDirectoryExists(deletedBasePath)

    // Find all files matching the quotation number
    let archivedFiles: string[] = []
    
    try {
      const files = await fs.promises.readdir(quotationsYearPath)
      const quotationFiles = files.filter(file => 
        file.includes(quotationNumber) || file.includes(quotationId)
      )

      for (const file of quotationFiles) {
        const sourcePath = path.join(quotationsYearPath, file)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const targetFileName = `${path.parse(file).name}_deleted_${timestamp}${path.parse(file).ext}`
        const targetPath = path.join(deletedBasePath, targetFileName)

        await fs.promises.copyFile(sourcePath, targetPath)
        archivedFiles.push(targetPath)
        console.log(`[NAS Archival] Copied: ${file} -> ${targetFileName}`)
      }

      if (archivedFiles.length > 0) {
        console.log(`[NAS Archival] ✅ Archived ${archivedFiles.length} file(s) for quotation ${quotationNumber}`)
        return { success: true, archivedPath: deletedBasePath }
      } else {
        console.warn(`[NAS Archival] No files found for quotation ${quotationNumber}`)
        return { success: true, archivedPath: 'N/A - No files found' }
      }

    } catch (error) {
      console.warn(`[NAS Archival] Error reading quotations directory:`, error)
      return { success: true, archivedPath: 'N/A - Directory not accessible' }
    }

  } catch (error) {
    console.error('[NAS Archival] Error archiving quotation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Archive deleted tender files
 * Copies tender folder from tenders/ to tenders/DELETED/
 */
export async function archiveDeletedTender(
  tenderNumber: string,
  tenderTitle: string
): Promise<ArchivalResult> {
  try {
    const nasBasePath = await getNASBasePath()

    if (!nasBasePath) {
      console.warn('[NAS Archival] NAS path not configured, skipping tender archival')
      return {
        success: false,
        error: 'NAS path not configured'
      }
    }

    // Sanitize tender title
    const sanitizedTitle = tenderTitle.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100)
    const tenderFolderName = `${tenderNumber}-${sanitizedTitle}`

    const sourcePath = path.join(nasBasePath, 'tenders', tenderFolderName)
    const deletedBasePath = path.join(nasBasePath, 'tenders', 'DELETED')

    console.log(`[NAS Archival] Archiving tender: ${tenderFolderName}`)

    // Copy tender folder to DELETED
    return await copyDirectoryToDeleted(sourcePath, deletedBasePath, tenderFolderName)

  } catch (error) {
    console.error('[NAS Archival] Error archiving tender:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Create archival log entry
 */
export async function logArchival(
  entityType: 'PROJECT' | 'QUOTATION' | 'TENDER',
  entityId: string,
  entityName: string,
  archivedPath: string,
  userId: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: `AL-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        action: `${entityType}_ARCHIVED`,
        entityType,
        entityId,
        oldValues: { name: entityName },
        newValues: { archivedPath },
        userId,
        userEmail: 'System',
        ipAddress: 'System',
        userAgent: 'NAS Archival Service'
      }
    })
  } catch (error) {
    console.error('[NAS Archival] Error logging archival:', error)
    // Don't fail the archival if logging fails
  }
}
