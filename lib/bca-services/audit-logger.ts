
/**
 * BCA Audit Logger
 * Logs all actions in the BCA module for audit trail
 */

import { prisma } from "@/lib/db"

export interface AuditLogData {
  action: string
  entityType: string
  entityId?: string
  oldValues?: any
  newValues?: any
  userId: string
  userEmail: string
  ipAddress?: string
  userAgent?: string
  applicationId?: string
}

export async function logBcaAction(data: AuditLogData): Promise<void> {
  await prisma.bcaAuditLog.create({
    data: {
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      oldValues: data.oldValues,
      newValues: data.newValues,
      userId: data.userId,
      userEmail: data.userEmail,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      applicationId: data.applicationId,
    },
  })
}
