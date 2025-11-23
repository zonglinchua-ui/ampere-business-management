
/**
 * API endpoint for document restore operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import {
  restoreDocument,
  scanNASBackups,
  bulkRestoreDocuments,
  getBackupStatistics
} from '@/lib/document-restore-service'
import { createSystemLog } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const nasPath = searchParams.get('nasPath') || './nas_storage'

    if (action === 'scan') {
      // Scan NAS for available backups
      const scanned = await scanNASBackups(nasPath)
      
      await createSystemLog({
        type: 'ACTIVITY',
        status: 'SUCCESS',
        module: 'Documents',
        action: 'SCAN_NAS_BACKUPS',
        message: `NAS scan completed: ${scanned.total} documents found`,
        username: session.user?.email || 'Unknown',
        userId: (session.user as any)?.id
      })

      return NextResponse.json({
        success: true,
        ...scanned
      })
    } else if (action === 'statistics') {
      // Get backup statistics
      const stats = await getBackupStatistics(nasPath)
      
      return NextResponse.json({
        success: true,
        statistics: stats
      })
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in restore API (GET):', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, nasFilePath, documentType, options, nasBasePath } = body

    if (action === 'restore-single') {
      // Restore a single document
      const result = await restoreDocument(nasFilePath, documentType, options)
      
      if (result.success) {
        await createSystemLog({
          type: 'ACTIVITY',
          status: 'SUCCESS',
          module: 'Documents',
          action: 'RESTORE_DOCUMENT',
          message: `Document restored successfully: ${documentType}`,
          username: session.user?.email || 'Unknown',
          userId: (session.user as any)?.id
        })
      } else {
        await createSystemLog({
          type: 'ERROR',
          status: 'FAILED',
          module: 'Documents',
          action: 'RESTORE_DOCUMENT',
          message: `Document restore failed: ${result.error}`,
          username: session.user?.email || 'Unknown',
          userId: (session.user as any)?.id
        })
      }

      return NextResponse.json(result)

    } else if (action === 'restore-bulk') {
      // Bulk restore documents
      const result = await bulkRestoreDocuments(nasBasePath, documentType, options)
      
      await createSystemLog({
        type: 'ACTIVITY',
        status: 'SUCCESS',
        module: 'Documents',
        action: 'BULK_RESTORE',
        message: `Bulk restore completed: ${result.successful}/${result.total} successful`,
        username: session.user?.email || 'Unknown',
        userId: (session.user as any)?.id
      })

      return NextResponse.json({
        success: true,
        ...result
      })
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in restore API (POST):', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
