
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export async function GET(request: NextRequest) {
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

    // Get pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10000') // Default to large page size to fetch all
    const skip = (page - 1) * pageSize

    console.log(`[Payments API] Fetching page ${page} with pageSize ${pageSize}`)

    // Get total count
    const totalCount = await prisma.payment.count()

    // Fetch payments with pagination
    const payments = await prisma.payment.findMany({
      skip,
      take: pageSize,
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
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            customerNumber: true
          }
        },
        CustomerInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            projectId: true,
            Customer: {
              select: {
                id: true,
                name: true,
                email: true,
                customerNumber: true
              }
            },
            Project: {
              select: {
                id: true,
                name: true,
                projectNumber: true
              }
            }
          }
        },
        SupplierInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            supplierId: true,
            projectId: true,
            Supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                supplierNumber: true
              }
            },
            Project: {
              select: {
                id: true,
                name: true,
                projectNumber: true
              }
            }
          }
        }
      },
      orderBy: {
        paymentDate: 'desc'
      }
    })

    // Ensure payments is an array
    const safePayments = Array.isArray(payments) ? payments : []

    const formattedPayments = safePayments.map((payment: any) => {
      // Extract project information from either customer or supplier invoice
      let projectName = null
      let projectId = null
      
      if (payment?.CustomerInvoice?.Project) {
        projectName = payment.CustomerInvoice.Project.name
        projectId = payment.CustomerInvoice.Project.id
      } else if (payment?.SupplierInvoice?.Project) {
        projectName = payment.SupplierInvoice.Project.name
        projectId = payment.SupplierInvoice.Project.id
      }
      
      return {
        id: payment?.id || '',
        paymentNumber: payment?.paymentNumber || '',
        amount: Number(payment?.amount) || 0,
        currency: payment?.currency || 'SGD',
        paymentMethod: payment?.paymentMethod || 'Unknown',
        paymentDate: payment?.paymentDate?.toISOString() || new Date().toISOString(),
        reference: payment?.reference || '',
        notes: payment?.notes || '',
        status: payment?.status || 'PENDING',
        xeroPaymentId: payment?.xeroPaymentId || null,
        xeroPaymentType: payment?.xeroPaymentType || null,
        xeroInvoiceId: payment?.xeroInvoiceId || null,
        xeroContactId: payment?.xeroContactId || null,
        isXeroSynced: payment?.isXeroSynced || false,
        createdBy: payment?.User_Payment_createdByIdToUser ? {
          id: payment.User_Payment_createdByIdToUser.id,
          name: `${payment.User_Payment_createdByIdToUser.firstName || ''} ${payment.User_Payment_createdByIdToUser.lastName || ''}`.trim(),
          email: payment.User_Payment_createdByIdToUser.email || ''
        } : null,
        processedBy: payment?.User_Payment_processedByIdToUser ? {
          id: payment.User_Payment_processedByIdToUser.id,
          name: `${payment.User_Payment_processedByIdToUser.firstName || ''} ${payment.User_Payment_processedByIdToUser.lastName || ''}`.trim(),
          email: payment.User_Payment_processedByIdToUser.email || ''
        } : null,
        Customer: payment?.Customer || null,
        CustomerInvoice: payment?.CustomerInvoice || null,
        SupplierInvoice: payment?.SupplierInvoice || null,
        customerInvoiceId: payment?.customerInvoiceId || null,
        supplierInvoiceId: payment?.supplierInvoiceId || null,
        customerId: payment?.customerId || null,
        projectName: projectName,
        projectId: projectId,
        createdAt: payment?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: payment?.updatedAt?.toISOString() || new Date().toISOString()
      }
    })

    console.log(`[Finance Payments API] Fetched ${formattedPayments.length} of ${totalCount} total payments (page ${page})`)

    return NextResponse.json({
      payments: formattedPayments || [],
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    })

  } catch (error) {
    console.error('Error fetching payments:', error)
    // Return empty payments array with default pagination to prevent .map() errors
    return NextResponse.json({
      payments: [],
      pagination: {
        page: 1,
        pageSize: 100,
        totalCount: 0,
        totalPages: 0
      }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canCreatePayment = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canCreatePayment) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const data = await request.json()
    console.log('Received payment creation request:', data)

    // Generate payment number
    const currentYear = new Date().getFullYear()
    const yearPrefix = currentYear.toString()
    
    // Find the last payment number for this year
    const lastPayment = await prisma.payment.findFirst({
      where: {
        paymentNumber: {
          contains: yearPrefix
        }
      },
      orderBy: {
        paymentNumber: 'desc'
      }
    })

    let nextNumber = 1
    if (lastPayment) {
      // Extract number from payment format (e.g., PAY-001-20240915)
      const match = lastPayment.paymentNumber.match(/PAY-(\d+)-/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    const paymentNumber = `PAY-${nextNumber.toString().padStart(3, '0')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

    // Determine the invoice to link to based on payment type
    let customerInvoiceId = null
    let supplierInvoiceId = null

    if (data.type === 'CLIENT_PAYMENT') {
      // Link to client invoice if specified
      customerInvoiceId = data.invoiceId || null
    } else if (data.type === 'VENDOR_PAYMENT') {
      // Link to supplier invoice if specified  
      supplierInvoiceId = data.invoiceId || null
    }

    const payment = await prisma.payment.create({
      data: {
        id: `payment_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        paymentNumber,
        customerInvoiceId,
        supplierInvoiceId,
        amount: parseFloat(data.amount) || 0,
        currency: data.currency || 'SGD',
        paymentMethod: data.method || 'BANK_TRANSFER',
        paymentDate: new Date(data.paymentDate),
        reference: data.reference,
        notes: data.notes,
        status: data.isDraft ? 'PENDING' : 'PROCESSING',
        createdById: session.user?.id || '',
        processedById: data.isDraft ? null : session.user?.id,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      status: payment.status,
      amount: Number(payment.amount),
      createdAt: payment.createdAt.toISOString()
    })

  } catch (error) {
    console.error('Error creating payment:', error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
