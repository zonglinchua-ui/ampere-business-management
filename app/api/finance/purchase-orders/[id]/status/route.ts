

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[PO Status Update] ===== START =====')
    console.log('[PO Status Update] Params:', params)
    
    const session = await getServerSession(authOptions)
    console.log('[PO Status Update] Session retrieved:', { 
      hasSession: !!session, 
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userRole: session?.user?.role
    })
    
    if (!session?.user) {
      console.log('[PO Status Update] No session/user - returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    const userId = session.user.id
    const userEmail = session.user.email || ''

    console.log('[PO Status Update] Session user:', { userId, userEmail, userRole })

    let body
    try {
      body = await request.json()
      console.log('[PO Status Update] Request body:', body)
    } catch (e) {
      console.error('[PO Status Update] Failed to parse request body:', e)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { status: newStatus } = body

    console.log('[PO Status Update] Request:', { poId: params.id, newStatus, currentUser: userId })

    if (!newStatus) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Validate status transitions and permissions
        // Valid statuses must match the PurchaseOrderStatus enum in Prisma schema
    const validStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ISSUED', 'ACKNOWLEDGED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
    
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const poId = params.id
    console.log('[PO Status Update] Looking up PO:', poId)

    // Get existing PO
    let existingPO
    try {
      existingPO = await prisma.purchaseOrder.findUnique({
        where: { id: poId }
      })
      console.log('[PO Status Update] PO lookup result:', { 
        found: !!existingPO, 
        currentStatus: existingPO?.status 
      })
    } catch (e: any) {
      console.error('[PO Status Update] Failed to find PO:', e)
      return NextResponse.json({ 
        error: 'Database error finding purchase order',
        details: e.message 
      }, { status: 500 })
    }

    if (!existingPO) {
      console.log('[PO Status Update] PO not found')
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Define permissions for each status transition
    const canUpdateStatus = (() => {
      switch (newStatus) {
        case 'SUBMITTED':
          // Project managers and superadmin can submit drafts
          return ['SUPERADMIN', 'PROJECT_MANAGER'].includes(userRole) && existingPO.status === 'DRAFT'
        case 'CANCELLED':
          // Only superadmin can cancel/reject submitted or approved POs
          // Project managers can cancel drafts
          if (userRole === 'SUPERADMIN') {
            return !['COMPLETED'].includes(existingPO.status)
          }
          return userRole === 'PROJECT_MANAGER' && 
                 !['APPROVED', 'ISSUED', 'DELIVERED', 'COMPLETED'].includes(existingPO.status)
        case 'ISSUED':
          // Only approved POs can be issued
          return ['SUPERADMIN', 'PROJECT_MANAGER'].includes(userRole) && existingPO.status === 'APPROVED'
        case 'ACKNOWLEDGED':
        case 'DELIVERED':
        case 'COMPLETED':
          // These status updates are typically for tracking progress
          return ['SUPERADMIN', 'PROJECT_MANAGER'].includes(userRole)
        default:
          return false
      }
    })()

    if (!canUpdateStatus) {
      return NextResponse.json({
        error: `You don't have permission to change status from ${existingPO.status} to ${newStatus}`
      }, { status: 403 })
    }

    const now = new Date()

    console.log('[PO Status Update] Updating PO status:', { poId, oldStatus: existingPO.status, newStatus })

    // Prepare update data
    // Note: updatedAt is automatically handled by Prisma @updatedAt directive
    const updateData: any = {
      status: newStatus
    }

    // Set approval fields when approved
    if (newStatus === 'APPROVED') {
      updateData.approvedById = userId
      updateData.approvedAt = now
    }

    // Clear approval fields if status is being cancelled (rejected)
    if (newStatus === 'CANCELLED') {
      updateData.approvedById = null
      updateData.approvedAt = null
    }

    console.log('[PO Status Update] Update data:', updateData)

    // Update PO status
    let updatedPO
    try {
      console.log('[PO Status Update] Executing database update...')
      updatedPO = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: updateData,
        include: {
          Supplier: {
            select: {
              name: true
            }
          },
          Project: {
            select: {
              name: true,
              projectNumber: true,
              contractValue: true
            }
          }
        }
      })
      console.log('[PO Status Update] PO updated successfully:', updatedPO.id)
    } catch (updateError: any) {
      console.error('[PO Status Update] Database update failed:', updateError)
      console.error('[PO Status Update] Update error details:', {
        message: updateError?.message,
        code: updateError?.code,
        meta: updateError?.meta,
        clientVersion: updateError?.clientVersion
      })
      return NextResponse.json({ 
        error: 'Failed to update purchase order in database',
        details: updateError?.message,
        code: updateError?.code,
        meta: updateError?.meta
      }, { status: 500 })
    }

    // Auto-update project contract value when INCOMING PO is approved
    if (newStatus === 'APPROVED' && updatedPO.type === 'INCOMING' && updatedPO.projectId && updatedPO.Project) {
      const currentContractValue = parseFloat(updatedPO.Project.contractValue?.toString() || '0')
      const poAmount = parseFloat(updatedPO.totalAmount.toString())
      const newContractValue = currentContractValue + poAmount

      await prisma.project.update({
        where: { id: updatedPO.projectId },
        data: {
          contractValue: newContractValue,
          updatedAt: now
        }
      })

      console.log(`[PO Status Update] Approved INCOMING PO ${updatedPO.poNumber}, updated project contract value: ${currentContractValue} -> ${newContractValue}`)
    }

    // Log activity
    const activityId = uuidv4()
    console.log('[PO Status Update] Creating activity log:', { activityId, poId, userId, userEmail })
    
    if (!userId || !userEmail) {
      console.error('[PO Status Update] Missing user information:', { userId, userEmail })
      throw new Error('User information is required for activity logging')
    }

    try {
      await prisma.purchaseOrderActivity.create({
        data: {
          id: activityId,
          purchaseOrderId: poId,
          action: 'STATUS_CHANGE',
          description: getStatusChangeDescription(newStatus),
          oldValue: existingPO.status || '',
          newValue: newStatus,
          userId: userId,
          userEmail: userEmail,
          createdAt: now
        }
      })
      console.log('[PO Status Update] Activity log created successfully')
    } catch (activityError: any) {
      console.error('[PO Status Update] Failed to create activity log:', activityError)
      // Don't fail the whole request if activity logging fails
      console.warn('[PO Status Update] Continuing despite activity log failure')
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        id: updatedPO.id,
        poNumber: updatedPO.poNumber,
        status: updatedPO.status,
        updatedAt: updatedPO.updatedAt?.toISOString(),
        supplier: updatedPO.Supplier?.name,
        project: updatedPO.Project,
        totalAmount: Number(updatedPO.totalAmount)
      },
      message: `Purchase order ${updatedPO.poNumber} status updated to ${newStatus}`
    })
  } catch (error: any) {
    console.error('[PO Status Update] Error:', error)
    console.error('[PO Status Update] Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to update purchase order status',
        details: error?.message || 'Unknown error',
        code: error?.code
      },
      { status: 500 }
    )
  }
}

function getStatusChangeDescription(status: string): string {
  const descriptions: Record<string, string> = {
    'SUBMITTED': 'Purchase order submitted for approval',
    'CANCELLED': 'Purchase order rejected/cancelled',
    'ISSUED': 'Purchase order issued to supplier',
    'ACKNOWLEDGED': 'Purchase order acknowledged by supplier',
    'DELIVERED': 'Purchase order items delivered',
    'COMPLETED': 'Purchase order completed'
  }
  
  return descriptions[status] || `Purchase order status changed to ${status}`
}

export const dynamic = 'force-dynamic'
