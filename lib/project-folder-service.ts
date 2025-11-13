/**
 * Project Folder Structure Service
 * Automatically creates NAS folder structure for projects
 */

import fs from 'fs'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { prisma } from './db'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

export interface ProjectFolderStructure {
  projectNumber: string
  projectName: string
  basePath: string
  folders: string[]
}

/**
 * Standard project folder structure
 * Structure: [ProjectNo]-[ProjectName]/
 *   ├── OMM/
 *   ├── BCA forms/
 *   ├── documents/
 *   ├── Drawings/
 *   ├── invoices & quotations from suppliers/
 *   ├── VOs/
 *   ├── POs from customer/
 *   └── POs to suppliers/
 */
const STANDARD_FOLDERS = [
  'OMM',
  'BCA forms',
  'documents',
  'Drawings',
  'invoices & quotations from suppliers',
  'VOs',
  'POs from customer',
  'POs to suppliers'
]

/**
 * Sanitize folder name for cross-platform compatibility
 */
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .substring(0, 100) // Limit length
}

/**
 * Generate project folder name
 * Format: [ProjectNo]-[ProjectName]
 */
export function generateProjectFolderName(projectNumber: string, projectName: string): string {
  const sanitizedProjectName = sanitizeFolderName(projectName)
  return `${projectNumber}-${sanitizedProjectName}`
}

/**
 * Get NAS base path from settings
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
      console.log('[Project Folders] No settings file found, using environment variable')
    }

    return settings.storage?.nasPath || process.env.NAS_PATH || null
  } catch (error) {
    console.error('[Project Folders] Error getting NAS path:', error)
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
    // Directory doesn't exist, create it
    await fs.promises.mkdir(dirPath, { recursive: true })
    console.log(`[Project Folders] Created directory: ${dirPath}`)
  }
}

/**
 * Create project folder structure on NAS
 */
export async function createProjectFolders(
  projectNumber: string,
  projectName: string,
  customBasePath?: string
): Promise<{ success: boolean; path?: string; folders?: string[]; error?: string }> {
  try {
    // Get NAS base path
    const nasBasePath = customBasePath || await getNASBasePath()

    if (!nasBasePath) {
      console.warn('[Project Folders] NAS path not configured, skipping folder creation')
      return { 
        success: false, 
        error: 'NAS path not configured. Please configure NAS settings first.' 
      }
    }

    // Check if NAS path is accessible
    try {
      await fs.promises.access(nasBasePath, fs.constants.R_OK | fs.constants.W_OK)
    } catch (error) {
      console.error('[Project Folders] NAS path not accessible:', nasBasePath)
      return { 
        success: false, 
        error: `NAS path not accessible: ${nasBasePath}. Please check NAS connection.` 
      }
    }

    // Ensure projects directory exists first
    const projectsDir = path.join(nasBasePath, 'projects')
    await ensureDirectoryExists(projectsDir)

    // Generate project folder name
    const projectFolderName = generateProjectFolderName(projectNumber, projectName)
    const projectBasePath = path.join(projectsDir, projectFolderName)

    console.log(`[Project Folders] Creating folder structure for: ${projectFolderName}`)
    console.log(`[Project Folders] Base path: ${projectBasePath}`)

    // Create main project folder
    await ensureDirectoryExists(projectBasePath)

    // Create all subfolders
    const createdFolders: string[] = []
    for (const folder of STANDARD_FOLDERS) {
      const folderPath = path.join(projectBasePath, folder)
      await ensureDirectoryExists(folderPath)
      createdFolders.push(folderPath)
      console.log(`[Project Folders] Created: ${folder}`)
    }

    // Create a README file in the project folder
    const readmePath = path.join(projectBasePath, 'README.txt')
    const readmeContent = `Project: ${projectName}
Project Number: ${projectNumber}
Created: ${new Date().toISOString()}

Folder Structure:
- OMM: Operation & Maintenance Manuals
- BCA forms: Building and Construction Authority forms
- documents: General project documents
- Drawings: Project drawings, blueprints, and technical diagrams
- invoices & quotations from suppliers: Supplier invoices and quotations
- VOs: Variation Orders
- POs from customer: Purchase Orders from customer
- POs to suppliers: Purchase Orders to suppliers

This folder structure was automatically generated.
`
    await fs.promises.writeFile(readmePath, readmeContent, 'utf-8')

    console.log(`[Project Folders] ✅ Successfully created folder structure for ${projectFolderName}`)

    return {
      success: true,
      path: projectBasePath,
      folders: createdFolders
    }

  } catch (error) {
    console.error('[Project Folders] Error creating project folders:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating folders'
    }
  }
}

/**
 * Get project folder path
 */
export async function getProjectFolderPath(
  projectNumber: string,
  projectName: string,
  customBasePath?: string
): Promise<string | null> {
  try {
    const nasBasePath = customBasePath || await getNASBasePath()
    if (!nasBasePath) {
      return null
    }

    const projectFolderName = generateProjectFolderName(projectNumber, projectName)
    return path.join(nasBasePath, 'projects', projectFolderName)
  } catch (error) {
    console.error('[Project Folders] Error getting project folder path:', error)
    return null
  }
}

/**
 * Check if project folders exist
 */
export async function projectFoldersExist(
  projectNumber: string,
  projectName: string,
  customBasePath?: string
): Promise<boolean> {
  try {
    const projectPath = await getProjectFolderPath(projectNumber, projectName, customBasePath)
    if (!projectPath) {
      return false
    }

    await fs.promises.access(projectPath, fs.constants.F_OK)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get project subfolder path
 * @param folderType - One of: 'OMM', 'BCA forms', 'documents', 'Drawings', 'invoices & quotations from suppliers', 'VOs', 'POs from customer', 'POs to suppliers'
 */
export async function getProjectSubfolderPath(
  projectNumber: string,
  projectName: string,
  folderType: string,
  customBasePath?: string
): Promise<string | null> {
  try {
    const projectPath = await getProjectFolderPath(projectNumber, projectName, customBasePath)
    if (!projectPath) {
      return null
    }

    return path.join(projectPath, folderType)
  } catch (error) {
    console.error('[Project Folders] Error getting subfolder path:', error)
    return null
  }
}

/**
 * List all files in a project subfolder
 */
export async function listProjectSubfolderFiles(
  projectNumber: string,
  projectName: string,
  folderType: string,
  customBasePath?: string
): Promise<string[]> {
  try {
    const subfolderPath = await getProjectSubfolderPath(projectNumber, projectName, folderType, customBasePath)
    if (!subfolderPath) {
      return []
    }

    const files = await fs.promises.readdir(subfolderPath)
    return files.filter(file => {
      // Filter out system files and directories
      return !file.startsWith('.') && file !== 'README.txt'
    })
  } catch (error) {
    console.error('[Project Folders] Error listing files:', error)
    return []
  }
}

/**
 * Create project folders for existing projects (migration utility)
 */
export async function createFoldersForExistingProjects(
  customBasePath?: string
): Promise<{ total: number; successful: number; failed: number; errors: string[] }> {
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  }

  try {
    // Get all active projects
    const projects = await prisma.project.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        projectNumber: true,
        name: true
      }
    })

    results.total = projects.length
    console.log(`[Project Folders] Creating folders for ${projects.length} existing projects...`)

    for (const project of projects) {
      try {
        const result = await createProjectFolders(project.projectNumber, project.name, customBasePath)
        
        if (result.success) {
          results.successful++
          console.log(`[Project Folders] ✅ ${project.projectNumber}: ${project.name}`)
        } else {
          results.failed++
          const error = `${project.projectNumber}: ${result.error}`
          results.errors.push(error)
          console.error(`[Project Folders] ❌ ${error}`)
        }
      } catch (error) {
        results.failed++
        const errorMsg = `${project.projectNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
        results.errors.push(errorMsg)
        console.error(`[Project Folders] ❌ ${errorMsg}`)
      }
    }

    console.log(`[Project Folders] Migration complete: ${results.successful}/${results.total} successful`)
    return results

  } catch (error) {
    console.error('[Project Folders] Migration error:', error)
    throw error
  }
}
