
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canUseAI = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canUseAI) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Fetch entities that documents can be assigned to
    const [projects, clients, vendors, tenders, quotations, clientInvoices, vendorInvoices, purchaseOrders] = await Promise.all([
      // Projects
      prisma.project.findMany({
        select: {
          id: true,
          name: true,
          projectNumber: true,
          status: true
        },
        where: {
          isActive: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 50
      }),
      
      // Clients
      prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          contactPerson: true
        },
        where: {
          isActive: true
        },
        orderBy: {
          name: 'asc'
        },
        take: 50
      }),
      
      // Vendors
      prisma.supplier.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        },
        take: 50
      }),
      
      // Tenders
      prisma.tender.findMany({
        select: {
          id: true,
          title: true,
          tenderNumber: true,
          status: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 50
      }),
      
      // Quotations
      prisma.quotation.findMany({
        select: {
          id: true,
          title: true,
          quotationNumber: true,
          status: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 50
      }),
      
      // Customer Invoices
      prisma.customerInvoice.findMany({
        select: {
          id: true,
          invoiceNumber: true,
          status: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 25
      }),
      
      // Vendor Invoices
      prisma.supplierInvoice.findMany({
        select: {
          id: true,
          invoiceNumber: true,
          status: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 25
      }),
      
      // Purchase Orders
      prisma.purchaseOrder.findMany({
        select: {
          id: true,
          poNumber: true,
          status: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 25
      })
    ])

    // Format entities for frontend
    const entities = [
      // Projects
      ...projects.map((project: any) => ({
        id: project.id,
        name: project.name,
        type: 'project' as const,
        subtitle: `${project.projectNumber} • ${project.status}`
      })),
      
      // Clients
      ...clients.map((client: any) => ({
        id: client.id,
        name: client.name,
        type: 'client' as const,
        subtitle: client.contactPerson || undefined
      })),
      
      // Vendors
      ...vendors.map((vendor: any) => ({
        id: vendor.id,
        name: vendor.name,
        type: 'vendor' as const
      })),
      
      // Tenders
      ...tenders.map((tender: any) => ({
        id: tender.id,
        name: tender.title,
        type: 'tender' as const,
        subtitle: `${tender.tenderNumber} • ${tender.status}`
      })),
      
      // Quotations
      ...quotations.map((quotation: any) => ({
        id: quotation.id,
        name: quotation.title,
        type: 'quotation' as const,
        subtitle: `${quotation.quotationNumber} • ${quotation.status}`
      })),
      
      // Customer Invoices
      ...clientInvoices.map((invoice: any) => ({
        id: invoice.id,
        name: `Customer Invoice ${invoice.invoiceNumber}`,
        type: 'invoice' as const,
        subtitle: invoice.status
      })),
      
      // Vendor Invoices
      ...vendorInvoices.map((invoice: any) => ({
        id: invoice.id,
        name: `Vendor Invoice ${invoice.invoiceNumber}`,
        type: 'invoice' as const,
        subtitle: invoice.status
      })),
      
      // Purchase Orders
      ...purchaseOrders.map((po: any) => ({
        id: po.id,
        name: `Purchase Order ${po.poNumber}`,
        type: 'purchase_order' as const,
        subtitle: po.status
      }))
    ]

    return NextResponse.json(entities)

  } catch (error) {
    console.error('Entities fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    )
  }
}
