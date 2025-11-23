/**
 * API Endpoint: Create NAS Folders for Projects
 * POST /api/projects/create-folders
 * 
 * Creates NAS folder structure for:
 * - A specific project (provide projectId)
 * - All existing projects (migration utility)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { 
  createProjectFolders, 
  createFoldersForExistingProjects,
  projectFoldersExist 
} from '@/lib/project-folder-service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPERADMIN and PROJECT_MANAGER can create project folders
    const user = session.user as any
    if (!['SUPERADMIN', 'PROJECT_MANAGER', 'FINANCE'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only SUPERADMIN, PROJECT_MANAGER, and FINANCE can create project folders.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { projectId, createAll } = body

    // Option 1: Create folders for a specific project
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          projectNumber: true,
          name: true
        }
      })

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      // Check if folders already exist
      const exists = await projectFoldersExist(project.projectNumber, project.name)
      if (exists) {
        return NextResponse.json({
          success: true,
          message: 'Project folders already exist',
          projectNumber: project.projectNumber,
          projectName: project.name,
          alreadyExists: true
        })
      }

      // Create folders
      const result = await createProjectFolders(project.projectNumber, project.name)

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Project folders created successfully',
          projectNumber: project.projectNumber,
          projectName: project.name,
          path: result.path,
          folders: result.folders
        })
      } else {
        return NextResponse.json({
          success: false,
          error: result.error,
          projectNumber: project.projectNumber,
          projectName: project.name
        }, { status: 500 })
      }
    }

    // Option 2: Create folders for all existing projects (migration)
    if (createAll) {
      console.log('[Create Folders] Starting migration for all projects...')
      
      const results = await createFoldersForExistingProjects()

      return NextResponse.json({
        success: true,
        message: `Migration complete: ${results.successful}/${results.total} projects`,
        total: results.total,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors
      })
    }

    return NextResponse.json({
      error: 'Please provide either projectId or set createAll to true'
    }, { status: 400 })

  } catch (error) {
    console.error('[Create Folders] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
