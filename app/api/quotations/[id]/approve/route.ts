
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'


export async function POST(
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

    const { action, comments } = await request.json()

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be APPROVED or REJECTED' }, { status: 400 })
    }

    // Check if quotation exists and requires approval
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        QuotationApproval: {
          where: {
            approverId: session.user?.id
          }
        }
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Check if user can approve this quotation
    const canApproveByRole = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    const isQuotationCreator = quotation.createdById === userId
    const isQuotationSalesperson = quotation.salespersonId === userId
    
    const canApprove = canApproveByRole || isQuotationCreator || isQuotationSalesperson
    
    if (!canApprove) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to approve this quotation. You must be an admin, project manager, or the quotation creator/salesperson.' 
      }, { status: 403 })
    }

    if (!quotation.requiresApproval) {
      return NextResponse.json({ error: 'This quotation does not require approval' }, { status: 400 })
    }

    if (!['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'].includes(quotation.status)) {
      return NextResponse.json({ error: 'Quotation is not in a state that can be approved/rejected' }, { status: 400 })
    }

    // Check if user has already approved/rejected this quotation
    if (quotation.QuotationApproval.length > 0) {
      return NextResponse.json({ error: 'You have already provided approval for this quotation' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Create approval record
      const approval = await tx.quotationApproval.create({
        data: {
          id: uuidv4(),
          quotationId: params.id,
          approverId: session.user?.id || '',
          status: action,
          comments: comments || '',
          approvalLevel: 1,
          approvedAt: new Date()
        }
      })

      // Update quotation status based on approval
      let newStatus = quotation.status
      if (action === 'APPROVED') {
        newStatus = 'APPROVED'
      } else if (action === 'REJECTED') {
        newStatus = 'REJECTED'
      }

      const updatedQuotation = await tx.quotation.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          updatedAt: new Date()
        }
      })

      // Determine approval context for activity log
      let approvalContext = ''
      if (isQuotationCreator && isQuotationSalesperson) {
        approvalContext = ' (self-approval as creator and salesperson)'
      } else if (isQuotationCreator) {
        approvalContext = ' (self-approval as creator)'
      } else if (isQuotationSalesperson) {
        approvalContext = ' (self-approval as salesperson)'
      } else {
        approvalContext = ` (approved by ${userRole})`
      }

      // Log activity
      await tx.quotationActivity.create({
        data: {
          id: uuidv4(),
          quotationId: params.id,
          action: action,
          description: `Quotation ${action.toLowerCase()} by ${session.user?.firstName} ${session.user?.lastName}${approvalContext}`,
          oldValue: quotation.status,
          newValue: newStatus,
          userId: session.user?.id || '',
          userEmail: session.user?.email || ''
        }
      })

      return { approval, updatedQuotation }
    })

    // TODO: Send notification emails to relevant parties
    // This would typically involve sending emails to the quotation creator, customer, etc.

    return NextResponse.json({
      message: `Quotation ${action.toLowerCase()} successfully`,
      approval: result.approval,
      quotation: result.updatedQuotation
    })

  } catch (error) {
    console.error('Error processing approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
