/**
 * Migration Script: Create NAS Folders for Existing Projects
 * 
 * Run this script to create folder structures for all existing projects
 * 
 * Usage:
 *   npx ts-node scripts/create-project-folders.ts
 * 
 * Or with custom NAS path:
 *   NAS_PATH=/path/to/nas npx ts-node scripts/create-project-folders.ts
 */

import { createFoldersForExistingProjects } from '../lib/project-folder-service'
import { prisma } from '../lib/db'
import { promises as fs } from 'fs'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

async function main() {
  console.log('='.repeat(60))
  console.log('Project Folder Structure Migration')
  console.log('='.repeat(60))
  console.log('')

  try {
    // Get NAS path
    const nasPath = process.env.NAS_PATH || await getNASPathFromSettings()
    
    if (!nasPath) {
      console.error('❌ NAS path not configured!')
      console.error('   Please set NAS_PATH environment variable or configure it in settings.')
      console.error('')
      console.error('   Example:')
      console.error('   NAS_PATH=/mnt/nas npx ts-node scripts/create-project-folders.ts')
      process.exit(1)
    }

    console.log(`📁 NAS Base Path: ${nasPath}`)
    console.log(`📂 Projects will be created in: ${nasPath}/projects/`)
    console.log('')

    // Confirm before proceeding
    console.log('⚠️  This will create folder structures for ALL active projects.')
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...')
    console.log('')

    await sleep(5000)

    console.log('🚀 Starting migration...')
    console.log('')

    // Create folders
    const results = await createFoldersForExistingProjects(nasPath)

    console.log('')
    console.log('='.repeat(60))
    console.log('Migration Results')
    console.log('='.repeat(60))
    console.log(`Total Projects: ${results.total}`)
    console.log(`✅ Successful: ${results.successful}`)
    console.log(`❌ Failed: ${results.failed}`)
    console.log('')

    if (results.errors.length > 0) {
      console.log('Errors:')
      results.errors.forEach(error => {
        console.log(`  - ${error}`)
      })
      console.log('')
    }

    if (results.successful === results.total) {
      console.log('🎉 All project folders created successfully!')
    } else if (results.successful > 0) {
      console.log('⚠️  Some projects failed. Check errors above.')
    } else {
      console.log('❌ No folders were created. Check errors above.')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function getNASPathFromSettings(): Promise<string | null> {
  try {
    // Load settings from JSON file
    let settings: any = {
      storage: {
        nasPath: ""
      }
    }

    try {
      const settingsData = await fs.readFile(SETTINGS_FILE, 'utf-8')
      settings = JSON.parse(settingsData)
    } catch (error) {
      // No settings file found
      return null
    }

    return settings.storage?.nasPath || null
  } catch (error) {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(console.error)
