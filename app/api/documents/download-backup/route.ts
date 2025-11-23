
/**
 * API endpoint for downloading backed up documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import fs from 'fs'
import path from 'path'
import { createSystemLog } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const backupPath = searchParams.get('path')

    if (!backupPath) {
      return NextResponse.json(
        { error: 'Backup path is required' },
        { status: 400 }
      )
    }

    // Security: Ensure the path is within the NAS storage directory
    const nasBasePath = path.resolve('./nas_storage')
    const resolvedPath = path.resolve(backupPath)
    
    if (!resolvedPath.startsWith(nasBasePath)) {
      return NextResponse.json(
        { error: 'Invalid backup path' },
        { status: 403 }
      )
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json(
        { error: 'Backup file not found' },
        { status: 404 }
      )
    }

    // Read file
    const fileBuffer = await fs.promises.readFile(resolvedPath)
    const filename = path.basename(resolvedPath)
    const ext = path.extname(resolvedPath).toLowerCase()

    // Determine content type
    let contentType = 'application/octet-stream'
    if (ext === '.pdf') {
      contentType = 'application/pdf'
    } else if (ext === '.xlsx' || ext === '.xls') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }

    await createSystemLog({
      type: 'ACTIVITY',
      status: 'SUCCESS',
      module: 'Documents',
      action: 'DOWNLOAD_BACKUP',
      message: `Backup downloaded: ${filename}`,
      username: session.user?.email || 'Unknown',
      userId: (session.user as any)?.id
    })

    // Return file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Error downloading backup:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
