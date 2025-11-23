
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canAccessFinance = ["SUPERADMIN", "FINANCE"].includes(userRole || "")
    
    if (!canAccessFinance) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const paymentId = params.id

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        User_Payment_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        User_Payment_processedByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        CustomerInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            Customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        },
        SupplierInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            Supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const formattedPayment = {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      amount: Number(payment.amount),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString(),
      reference: payment.reference,
      notes: payment.notes,
      status: payment.status,
      isXeroSynced: payment.isXeroSynced,
      xeroPaymentId: payment.xeroPaymentId,
      lastXeroSync: payment.lastXeroSync?.toISOString() || null,
      createdBy: {
        id: payment.User_Payment_createdByIdToUser.id,
        name: `${payment.User_Payment_createdByIdToUser.firstName} ${payment.User_Payment_createdByIdToUser.lastName}`,
        email: payment.User_Payment_createdByIdToUser.email
      },
      processedBy: payment.User_Payment_processedByIdToUser ? {
        id: payment.User_Payment_processedByIdToUser.id,
        name: `${payment.User_Payment_processedByIdToUser.firstName} ${payment.User_Payment_processedByIdToUser.lastName}`,
        email: payment.User_Payment_processedByIdToUser.email
      } : null,
      clientInvoice: payment.CustomerInvoice,
      supplierInvoice: payment.SupplierInvoice,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString()
    }

    return NextResponse.json(formattedPayment)

  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canEditPayment = ["SUPERADMIN", "FINANCE"].includes(userRole || "")
    
    if (!canEditPayment) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const paymentId = params.id
    const data = await request.json()

    // Check if payment exists and is editable
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId }
    })

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Only allow editing of PENDING and PROCESSING status payments
    if (!['PENDING', 'PROCESSING'].includes(existingPayment.status)) {
      return NextResponse.json({ 
        error: 'Can only edit payments in PENDING or PROCESSING status' 
      }, { status: 400 })
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: data.amount ? parseFloat(data.amount) : undefined,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
        reference: data.reference,
        notes: data.notes,
        status: data.status,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      id: updatedPayment.id,
      paymentNumber: updatedPayment.paymentNumber,
      status: updatedPayment.status,
      amount: Number(updatedPayment.amount),
      updatedAt: updatedPayment.updatedAt.toISOString()
    })

  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canDeletePayment = ["SUPERADMIN"].includes(userRole || "")
    
    if (!canDeletePayment) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const paymentId = params.id

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId }
    })

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Only allow deletion of PENDING and FAILED payments
    if (!['PENDING', 'FAILED', 'CANCELLED'].includes(existingPayment.status)) {
      return NextResponse.json({ 
        error: 'Can only delete payments in PENDING, FAILED, or CANCELLED status' 
      }, { status: 400 })
    }

    await prisma.payment.delete({
      where: { id: paymentId }
    })

    return NextResponse.json({ 
      message: 'Payment deleted successfully',
      id: paymentId
    })

  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
