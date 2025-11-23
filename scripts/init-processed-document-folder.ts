/**
 * Initialize PROCESSED DOCUMENT folder on NAS
 * 
 * This script creates the PROCESSED DOCUMENT folder structure on NAS
 * for storing AI-processed documents (POs, Invoices, Progress Claims)
 */

import { promises as fs } from 'fs'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

async function initProcessedDocumentFolder() {
  console.log('='.repeat(60))
  console.log('Initialize PROCESSED DOCUMENT Folder on NAS')
  console.log('='.repeat(60))
  console.log()

  try {
    // Load settings to get NAS path
    let settings: any = {
      storage: {
        nasEnabled: false,
        nasPath: ""
      }
    }

    try {
      const settingsData = await fs.readFile(SETTINGS_FILE, 'utf-8')
      settings = JSON.parse(settingsData)
    } catch (error) {
      console.error('❌ Settings file not found')
      console.log('\nPlease configure NAS path in:')
      console.log('  - Settings → Integrations → NAS Storage')
      process.exit(1)
    }

    const nasBasePath = settings.storage.nasPath
    
    if (!nasBasePath) {
      console.error('❌ NAS path not configured in settings')
      console.log('\nPlease configure NAS path in:')
      console.log('  - Settings → Integrations → NAS Storage')
      process.exit(1)
    }

    console.log(`📁 NAS Base Path: ${nasBasePath}`)
    console.log()

    // Check if NAS is accessible
    try {
      await fs.access(nasBasePath)
      console.log('✅ NAS is accessible')
    } catch (error) {
      console.error('❌ NAS path not accessible:', nasBasePath)
      console.log('\nPlease ensure:')
      console.log('  1. NAS is mounted')
      console.log('  2. Path exists and is writable')
      console.log('  3. Application has permissions')
      process.exit(1)
    }

    // Create PROCESSED DOCUMENT folder
    const processedDocPath = path.join(nasBasePath, 'PROCESSED DOCUMENT')
    
    console.log()
    console.log('📂 Creating folder structure...')
    console.log()

    await fs.mkdir(processedDocPath, { recursive: true })
    console.log(`✅ Created: ${processedDocPath}`)

    // Create README file
    const readmePath = path.join(processedDocPath, 'README.txt')
    const readmeContent = `PROCESSED DOCUMENT Folder
========================

This folder stores documents uploaded to the AI Assistant for processing.

Folder Structure:
-----------------
PROCESSED DOCUMENT/
  ├── [timestamp]_[filename].pdf     # Uploaded documents
  ├── [timestamp]_[filename].docx
  └── ...

Document Types:
---------------
- Purchase Orders (POs) - For automatic project creation
- Invoices - For linking to projects and expense tracking
- Progress Claims - For preparing invoices
- Other business documents

File Naming Convention:
-----------------------
Format: [ISO-timestamp]_[original-filename].[ext]
Example: 2025-01-13T10-30-45-123Z_PO-2025-001.pdf

Notes:
------
- Files are automatically uploaded when using AI Document Processing
- Original filenames are preserved in the database
- Files are linked to database records for tracking
- Do not manually delete files unless you're sure they're not referenced

Maintenance:
------------
- Old processed documents can be archived periodically
- Check database before deleting files
- Use the AI Assistant interface to manage documents

Generated: ${new Date().toISOString()}
`

    await fs.writeFile(readmePath, readmeContent, 'utf-8')
    console.log(`✅ Created: README.txt`)

    console.log()
    console.log('='.repeat(60))
    console.log('✅ PROCESSED DOCUMENT folder initialized successfully!')
    console.log('='.repeat(60))
    console.log()
    console.log('📍 Location:', processedDocPath)
    console.log()
    console.log('You can now use the AI Document Processing feature!')
    console.log('Go to: AI Assistant → Document Processing')
    console.log()

  } catch (error: any) {
    console.error()
    console.error('='.repeat(60))
    console.error('❌ Error initializing PROCESSED DOCUMENT folder')
    console.error('='.repeat(60))
    console.error()
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

// Run the initialization
initProcessedDocumentFolder()
