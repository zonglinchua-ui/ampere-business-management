/**
 * Diagnostic Script: Test NAS Folder Creation
 * 
 * This script tests if the NAS folder creation system is working correctly
 * 
 * Usage:
 *   npx ts-node scripts/test-nas-folder-creation.ts
 */

import { createProjectFolders, getProjectFolderPath } from '../lib/project-folder-service'
import { prisma } from '../lib/db'
import fs from 'fs'
import path from 'path'

async function main() {
  console.log('='.repeat(60))
  console.log('NAS Folder Creation Diagnostic')
  console.log('='.repeat(60))
  console.log('')

  try {
    // Step 1: Check NAS path configuration
    console.log('Step 1: Checking NAS path configuration...')
    console.log('')

    const nasPath = process.env.NAS_PATH
    console.log(`  Environment NAS_PATH: ${nasPath || 'NOT SET'}`)

    const settings = await prisma.setting.findFirst({
      where: {
        OR: [
          { key: 'nas_path' },
          { key: 'nasPath' }
        ]
      }
    })

    if (settings?.value) {
      console.log(`  Database nas_path: ${JSON.stringify(settings.value)}`)
    } else {
      console.log(`  Database nas_path: NOT SET`)
    }

    const effectiveNasPath = nasPath || (settings?.value as any)?.nasPath || (settings?.value as any)?.nas_path || (typeof settings?.value === 'string' ? settings.value : null)

    if (!effectiveNasPath) {
      console.error('')
      console.error('❌ NAS path is not configured!')
      console.error('')
      console.error('Please set NAS_PATH in one of these ways:')
      console.error('1. Add to .env file:')
      console.error('   NAS_PATH=A:\\AMPERE WEB SERVER')
      console.error('')
      console.error('2. Or add to database:')
      console.error('   INSERT INTO "Setting" (key, value, "createdAt", "updatedAt")')
      console.error('   VALUES (\'nas_path\', \'"A:\\\\AMPERE WEB SERVER"\', NOW(), NOW());')
      console.error('')
      process.exit(1)
    }

    console.log(`  ✅ Effective NAS path: ${effectiveNasPath}`)
    console.log('')

    // Step 2: Check if NAS path is accessible
    console.log('Step 2: Checking NAS accessibility...')
    console.log('')

    try {
      await fs.promises.access(effectiveNasPath, fs.constants.F_OK)
      console.log(`  ✅ NAS path exists: ${effectiveNasPath}`)
    } catch (error) {
      console.error(`  ❌ NAS path does not exist or is not accessible: ${effectiveNasPath}`)
      console.error(`  Error: ${error}`)
      console.error('')
      console.error('Please check:')
      console.error('1. Is the NAS mounted?')
      console.error('2. Is the path correct?')
      console.error('3. Does the application have access permissions?')
      console.error('')
      process.exit(1)
    }

    // Step 3: Check if we can write to NAS
    console.log('Step 3: Checking write permissions...')
    console.log('')

    const testFilePath = path.join(effectiveNasPath, 'test-write-permission.txt')
    try {
      await fs.promises.writeFile(testFilePath, 'Test write permission')
      await fs.promises.unlink(testFilePath)
      console.log(`  ✅ Can write to NAS: ${effectiveNasPath}`)
    } catch (error) {
      console.error(`  ❌ Cannot write to NAS: ${effectiveNasPath}`)
      console.error(`  Error: ${error}`)
      console.error('')
      console.error('Please check write permissions for the application user.')
      console.error('')
      process.exit(1)
    }
    console.log('')

    // Step 4: Check if projects directory exists
    console.log('Step 4: Checking projects directory...')
    console.log('')

    const projectsPath = path.join(effectiveNasPath, 'projects')
    try {
      await fs.promises.access(projectsPath, fs.constants.F_OK)
      console.log(`  ✅ Projects directory exists: ${projectsPath}`)
    } catch (error) {
      console.log(`  ⚠️  Projects directory does not exist, will create: ${projectsPath}`)
      try {
        await fs.promises.mkdir(projectsPath, { recursive: true })
        console.log(`  ✅ Created projects directory: ${projectsPath}`)
      } catch (mkdirError) {
        console.error(`  ❌ Failed to create projects directory: ${mkdirError}`)
        process.exit(1)
      }
    }
    console.log('')

    // Step 5: Test folder creation with a sample project
    console.log('Step 5: Testing folder creation...')
    console.log('')

    const testProjectNumber = 'TEST-2025-999'
    const testProjectName = 'Test Project for Diagnostic'

    console.log(`  Creating test project folders...`)
    console.log(`  Project Number: ${testProjectNumber}`)
    console.log(`  Project Name: ${testProjectName}`)
    console.log('')

    const result = await createProjectFolders(testProjectNumber, testProjectName, effectiveNasPath)

    if (result.success) {
      console.log(`  ✅ Test folders created successfully!`)
      console.log(`  Path: ${result.path}`)
      console.log('')
      console.log(`  Created folders:`)
      result.folders?.forEach(folder => {
        console.log(`    - ${path.basename(folder)}`)
      })
      console.log('')

      // Verify folders exist
      console.log('Step 6: Verifying created folders...')
      console.log('')

      const projectPath = await getProjectFolderPath(testProjectNumber, testProjectName, effectiveNasPath)
      if (projectPath) {
        const entries = await fs.promises.readdir(projectPath, { withFileTypes: true })
        console.log(`  Found ${entries.length} items in project folder:`)
        entries.forEach(entry => {
          console.log(`    ${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`)
        })
        console.log('')
      }

      // Clean up test folders
      console.log('Step 7: Cleaning up test folders...')
      console.log('')

      if (projectPath) {
        await fs.promises.rm(projectPath, { recursive: true, force: true })
        console.log(`  ✅ Test folders cleaned up`)
      }

    } else {
      console.error(`  ❌ Test folder creation failed!`)
      console.error(`  Error: ${result.error}`)
      console.error('')
      process.exit(1)
    }

    console.log('')
    console.log('='.repeat(60))
    console.log('✅ All diagnostic checks passed!')
    console.log('='.repeat(60))
    console.log('')
    console.log('The NAS folder creation system is working correctly.')
    console.log('If folders are still not being created for new projects:')
    console.log('1. Check the server logs for errors')
    console.log('2. Restart the application')
    console.log('3. Try creating a new project and check the logs')
    console.log('')

  } catch (error) {
    console.error('')
    console.error('❌ Diagnostic failed:', error)
    console.error('')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
