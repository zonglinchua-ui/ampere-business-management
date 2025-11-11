
/**
 * API endpoint for document backup operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import {
  backupQuotation,
  backupPurchaseOrder,
  backupInvoice,
  backupVariationOrder,
  batchBackupDocuments
} from '@/lib/document-backup-service'
import { createSystemLog } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { documentType, documentId, batchMode, filter } = body

    // Batch backup mode
    if (batchMode) {
      const result = await batchBackupDocuments(documentType, filter)
      
      await createSystemLog({
        type: 'ACTIVITY',
        status: 'SUCCESS',
        module: 'Documents',
        action: 'BATCH_BACKUP',
        message: `Batch backup completed: ${result.successful}/${result.total} successful`,
        username: session.user?.email || 'Unknown',
        userId: (session.user as any)?.id
      })

      return NextResponse.json({
        success: true,
        ...result
      })
    }

    // Single document backup
    let result
    switch (documentType) {
      case 'quotation':
        result = await backupQuotation(documentId)
        break
      case 'purchase-order':
        result = await backupPurchaseOrder(documentId)
        break
      case 'invoice':
        result = await backupInvoice(documentId, body.invoiceType || 'customer')
        break
      case 'variation-order':
        result = await backupVariationOrder(documentId)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid document type' },
          { status: 400 }
        )
    }

    if (result.success) {
      await createSystemLog({
        type: 'ACTIVITY',
        status: 'SUCCESS',
        module: 'Documents',
        action: 'BACKUP_DOCUMENT',
        message: `Document backed up successfully: ${documentType} ${documentId}`,
        username: session.user?.email || 'Unknown',
        userId: (session.user as any)?.id
      })
    } else {
      await createSystemLog({
        type: 'ERROR',
        status: 'FAILED',
        module: 'Documents',
        action: 'BACKUP_DOCUMENT',
        message: `Document backup failed: ${result.error}`,
        username: session.user?.email || 'Unknown',
        userId: (session.user as any)?.id
      })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in backup API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
