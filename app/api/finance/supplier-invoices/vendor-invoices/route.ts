

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export async function GET() {
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

    const vendorInvoices = await prisma.supplierInvoice.findMany({
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        },
        PurchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            currency: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Ensure vendorInvoices is an array
    const safeVendorInvoices = Array.isArray(vendorInvoices) ? vendorInvoices : []

    const formattedInvoices = safeVendorInvoices.map((invoice: any) => {
      const now = new Date()
      const dueDate = invoice?.dueDate
      const isOverdue = dueDate && invoice?.status !== 'PAID' && now > dueDate
      const daysPastDue = isOverdue && dueDate ? 
        Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

      return {
        id: invoice?.id || '',
        invoiceNumber: invoice?.invoiceNumber || '',
        vendor: {
          id: invoice?.Supplier?.id || '',
          name: invoice?.Supplier?.name || 'Unknown Vendor',
          email: invoice?.Supplier?.email || ''
        },
        project: invoice?.Project || null,
        purchaseOrder: invoice?.PurchaseOrder || null,
        amount: Number(invoice?.totalAmount) || 0,
        currency: invoice?.currency || 'SGD',
        dueDate: invoice?.dueDate?.toISOString() || null,
        receivedDate: invoice?.receivedDate?.toISOString() || invoice?.createdAt?.toISOString() || new Date().toISOString(),
        status: invoice?.status || 'PENDING',
        description: invoice?.description || '',
        notes: invoice?.notes || '',
        isOverdue: Boolean(isOverdue),
        daysPastDue: daysPastDue > 0 ? daysPastDue : undefined
      }
    })

    return NextResponse.json(formattedInvoices || [])

  } catch (error) {
    console.error('Error fetching vendor invoices:', error)
    // Return empty array instead of error object to prevent .map() errors
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canCreateVendorInvoice = ["SUPERADMIN", "FINANCE"].includes(userRole || "")
    
    if (!canCreateVendorInvoice) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const data = await request.json()
    console.log('Received vendor invoice creation request:', data)

    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const yearPrefix = currentYear.toString()
    
    const lastInvoice = await prisma.supplierInvoice.findFirst({
      where: {
        invoiceNumber: {
          contains: yearPrefix
        }
      },
      orderBy: {
        invoiceNumber: 'desc'
      }
    })

    let nextNumber = 1
    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(/VINV-(\d+)-/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    const invoiceNumber = `VINV-${nextNumber.toString().padStart(3, '0')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

    const vendorInvoice = await prisma.supplierInvoice.create({
      data: {
        id: `vinvoice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        invoiceNumber,
        supplierId: data.supplierId,
        projectId: data.projectId || null,
        purchaseOrderId: data.purchaseOrderId || null,
        subtotal: parseFloat(data.amount) || 0,
        totalAmount: parseFloat(data.amount) || 0,
        currency: data.currency || 'SGD',
        status: data.status || 'DRAFT',
        invoiceDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
        description: data.description,
        notes: data.notes,
        supplierInvoiceRef: data.vendorInvoiceNumber,
        createdById: session.user?.id || '',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      id: vendorInvoice.id,
      invoiceNumber: vendorInvoice.invoiceNumber,
      status: vendorInvoice.status,
      amount: Number(vendorInvoice.totalAmount),
      createdAt: vendorInvoice.createdAt.toISOString()
    })

  } catch (error) {
    console.error('Error creating vendor invoice:', error)
    
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
