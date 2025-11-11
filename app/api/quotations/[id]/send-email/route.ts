
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'
import { createAuditLog } from '@/lib/api-audit-context'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', { code: 'AUTH_REQUIRED' }),
        { status: 401 }
      )
    }

    const userRole = session.user?.role
    const canSendEmail = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canSendEmail) {
      return NextResponse.json(
        createErrorResponse('Insufficient permissions to send quotation emails'),
        { status: 403 }
      )
    }

    // Fetch the quotation
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        Customer: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!quotation) {
      return NextResponse.json(
        createErrorResponse('Quotation not found'),
        { status: 404 }
      )
    }

    // Check if quotation is approved
    if (!['APPROVED', 'SENT'].includes(quotation.status)) {
      return NextResponse.json(
        createErrorResponse('Can only send approved quotations'),
        { status: 400 }
      )
    }

    // Check if customer has email
    if (!quotation.Customer?.email) {
      return NextResponse.json(
        createErrorResponse('Customer email not found'),
        { status: 400 }
      )
    }

    // TODO: Implement actual email sending logic here
    // For now, we'll just log the activity and update the status
    
    // Log activity
    await prisma.quotationActivity.create({
      data: {
        id: uuidv4(),
        quotationId: params.id,
        action: 'EMAIL_SENT',
        description: `Quotation ${quotation.quotationNumber} sent to ${quotation.Customer.email} by ${session.user?.firstName} ${session.user?.lastName}`,
        oldValue: null,
        newValue: quotation.Customer.email,
        userId: session.user?.id || '',
        userEmail: session.user?.email || ''
      }
    })

    // Create audit log for dashboard
    await createAuditLog({
      userId: session.user?.id || '',
      userEmail: session.user?.email || '',
      action: 'UPDATE',
      entityType: 'QUOTATION',
      entityId: quotation.id,
      entityName: quotation.title || quotation.quotationNumber,
      newValues: {
        action: 'Email sent',
        recipient: quotation.Customer.email
      }
    })

    return NextResponse.json(
      createSuccessResponse({
        quotationNumber: quotation.quotationNumber,
        recipientEmail: quotation.Customer.email,
        recipientName: quotation.Customer.name
      }, {
        message: `Quotation ${quotation.quotationNumber} sent to ${quotation.Customer.email}`
      })
    )

  } catch (error) {
    console.error('Error sending quotation email:', error)
    return NextResponse.json(
      createErrorResponse('Failed to send quotation email', {
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    )
  }
}
