
/**
 * Enhanced Audit Logging Helper
 * 
 * Provides easy-to-use functions for creating detailed audit logs in API routes
 */

import { prisma } from './db'
import { EntityType } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

export interface AuditLogParams {
  userId: string
  userEmail: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'SUBMIT' | 'COMPLETE' | 'CANCEL'
  entityType: EntityType
  entityId: string
  entityName?: string  // NEW: The name/title of the entity for display
  oldValues?: any
  newValues?: any
}

/**
 * Create an enhanced audit log entry with entity name
 * 
 * Usage in API routes:
 * ```typescript
 * import { createAuditLog } from '@/lib/api-audit-context'
 * 
 * // After creating/updating/deleting a resource:
 * await createAuditLog({
 *   userId: session.user.id,
 *   userEmail: session.user.email,
 *   action: 'CREATE',
 *   entityType: 'PROJECT',
 *   entityId: project.id,
 *   entityName: project.name,  // Include the actual name/title
 *   newValues: { 
 *     name: project.name,
 *     budget: project.estimatedBudget 
 *   }
 * })
 * ```
 * 
 * Supported entity types: CUSTOMER, PROJECT, INVOICE, DOCUMENT, USER, SUPPLIER, 
 * SUPPLIER_INVOICE, SUPPLIER_CONTRACT, TENDER, QUOTATION
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    // Include entityName in newValues for easy retrieval
    const newValues = params.newValues || {}
    if (params.entityName) {
      newValues._entityName = params.entityName
    }

    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        userId: params.userId,
        userEmail: params.userEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValues: params.oldValues || null,
        newValues: Object.keys(newValues).length > 0 ? newValues : null
      }
    })
  } catch (error) {
    // Don't fail the API request if audit logging fails
    console.error('[Audit Log] Failed to create audit log:', error)
  }
}

/**
 * Batch create multiple audit logs
 */
export async function createAuditLogs(logs: AuditLogParams[]): Promise<void> {
  try {
    await prisma.auditLog.createMany({
      data: logs.map(log => ({
        id: uuidv4(),
        userId: log.userId,
        userEmail: log.userEmail,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        oldValues: log.oldValues || null,
        newValues: log.newValues || null
      }))
    })
  } catch (error) {
    console.error('[Audit Log] Failed to create batch audit logs:', error)
  }
}
