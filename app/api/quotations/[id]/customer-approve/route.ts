
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Customer Approve] Starting request for quotation:', params.id)
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error('[Customer Approve] Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Customer Approve] User:', session.user.email)

    const { id } = params
    const body = await request.json()
    const { isApproved } = body

    console.log('[Customer Approve] Request body:', { id, isApproved })

    // Get the quotation
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        quotationNumber: true,
        isVariationOrder: true,
        isCustomerApproved: true,
      },
    })

    console.log('[Customer Approve] Found quotation:', quotation)

    if (!quotation) {
      console.error('[Customer Approve] Quotation not found:', id)
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    if (!quotation.isVariationOrder) {
      console.error('[Customer Approve] Not a variation order:', id)
      return NextResponse.json(
        { error: 'Only variation orders can be customer approved' },
        { status: 400 }
      )
    }

    console.log('[Customer Approve] Updating customer approval status to:', isApproved)

    // Update customer approval status
    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: {
        isCustomerApproved: isApproved,
        customerApprovedAt: isApproved ? new Date() : null,
        customerApprovedById: isApproved ? session.user.id : null,
        updatedAt: new Date(),
      },
      include: {
        User_Quotation_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        User_Quotation_customerApprovedByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    console.log('[Customer Approve] Updated quotation:', {
      id: updatedQuotation.id,
      quotationNumber: updatedQuotation.quotationNumber,
      isCustomerApproved: updatedQuotation.isCustomerApproved,
      customerApprovedAt: updatedQuotation.customerApprovedAt,
    })

    // Log the activity
    await prisma.quotationActivity.create({
      data: {
        id: `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quotationId: id,
        action: isApproved ? 'CUSTOMER_APPROVED' : 'CUSTOMER_APPROVAL_REVOKED',
        description: isApproved
          ? 'Customer approved this variation order'
          : 'Customer approval revoked for this variation order',
        userId: session.user.id,
        userEmail: session.user.email || '',
        createdAt: new Date(),
      },
    })

    console.log('[Customer Approve] Activity logged successfully')

    return NextResponse.json({
      success: true,
      data: updatedQuotation,
    })
  } catch (error: any) {
    console.error('[Customer Approve] Error:', error)
    console.error('[Customer Approve] Error message:', error?.message)
    console.error('[Customer Approve] Error stack:', error?.stack)
    return NextResponse.json(
      { error: error?.message || 'Failed to update customer approval status' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
