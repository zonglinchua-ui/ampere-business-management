
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteFile } from '@/lib/s3'

// DELETE /api/servicing/jobsheets/[id] - Delete a specific job sheet
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 })
    }

    // Get the job sheet
    const jobSheet = await prisma.serviceJobSheet.findUnique({
      where: { id: params.id },
      include: {
        ServiceJob: {
          select: {
            id: true,
            assignedToType: true,
            assignedToId: true
          }
        }
      }
    })

    if (!jobSheet) {
      return NextResponse.json({ error: 'Job sheet not found' }, { status: 404 })
    }

    // Check permissions - only SUPERADMIN and ADMIN can delete job sheets
    const canDelete = ["SUPERADMIN", "ADMIN"].includes(userRole || "")

    if (!canDelete) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only Admins can delete job sheets.' 
      }, { status: 403 })
    }

    // Delete the file from cloud storage if it exists
    if (jobSheet.filePath) {
      try {
        await deleteFile(jobSheet.filePath)
        console.log(`[DELETE JobSheet] Deleted file from cloud: ${jobSheet.filePath}`)
      } catch (fileError) {
        console.error('[DELETE JobSheet] Error deleting file from cloud:', fileError)
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete endorsed file if it exists
    if (jobSheet.endorsedFilePath) {
      try {
        await deleteFile(jobSheet.endorsedFilePath)
        console.log(`[DELETE JobSheet] Deleted endorsed file from cloud: ${jobSheet.endorsedFilePath}`)
      } catch (fileError) {
        console.error('[DELETE JobSheet] Error deleting endorsed file from cloud:', fileError)
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the job sheet record
    await prisma.serviceJobSheet.delete({
      where: { id: params.id }
    })

    console.log(`[DELETE JobSheet] Successfully deleted job sheet: ${params.id}`)

    return NextResponse.json({
      success: true,
      message: 'Job sheet deleted successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('[DELETE JobSheet] Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/servicing/jobsheets/[id] - Get a specific job sheet
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id

    // Get the job sheet
    const jobSheet = await prisma.serviceJobSheet.findUnique({
      where: { id: params.id },
      include: {
        ServiceJob: {
          select: {
            id: true,
            assignedToType: true,
            assignedToId: true
          }
        }
      }
    })

    if (!jobSheet) {
      return NextResponse.json({ error: 'Job sheet not found' }, { status: 404 })
    }

    // Check permissions
    const canView = (
      ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "") ||
      (jobSheet.ServiceJob.assignedToType === 'Staff' && jobSheet.ServiceJob.assignedToId === userId) ||
      (jobSheet.ServiceJob.assignedToType === 'Supplier' && jobSheet.ServiceJob.assignedToId === userId)
    )

    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    return NextResponse.json(jobSheet)

  } catch (error) {
    console.error('[GET JobSheet] Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
