
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generatePurchaseOrderPDF } from '@/lib/pdf-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch PO with all related data
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: {
        Supplier: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            country: true
          }
        },
        Customer: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            country: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        },
        PurchaseOrderItem: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 })
    }

    // Prepare data for PDF generation
    const pdfData = {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      type: purchaseOrder.type,
      subtotal: Number(purchaseOrder.subtotal),
      taxAmount: purchaseOrder.taxAmount ? Number(purchaseOrder.taxAmount) : null,

      totalAmount: Number(purchaseOrder.totalAmount),
      currency: purchaseOrder.currency,
      issueDate: purchaseOrder.issueDate,
      deliveryDate: purchaseOrder.deliveryDate,
      deliveryAddress: purchaseOrder.deliveryAddress,
      terms: purchaseOrder.terms,
      notes: purchaseOrder.notes,
      supplier: purchaseOrder.Supplier ? {
        name: purchaseOrder.Supplier.name,
        email: purchaseOrder.Supplier.email,
        phone: purchaseOrder.Supplier.phone,
        address: purchaseOrder.Supplier.address,
        city: purchaseOrder.Supplier.city,
        state: purchaseOrder.Supplier.state,
        postalCode: purchaseOrder.Supplier.postalCode,
        country: purchaseOrder.Supplier.country
      } : undefined,
      customer: purchaseOrder.Customer ? {
        name: purchaseOrder.Customer.name,
        email: purchaseOrder.Customer.email,
        phone: purchaseOrder.Customer.phone,
        address: purchaseOrder.Customer.address,
        city: purchaseOrder.Customer.city,
        state: purchaseOrder.Customer.state,
        postalCode: purchaseOrder.Customer.postalCode,
        country: purchaseOrder.Customer.country
      } : undefined,
      project: purchaseOrder.Project ? {
        id: purchaseOrder.Project.id,
        name: purchaseOrder.Project.name,
        projectNumber: purchaseOrder.Project.projectNumber || undefined
      } : undefined,
      items: purchaseOrder.PurchaseOrderItem?.map((item: any) => ({
        serialNumber: item.serialNumber,
        description: item.description,
        category: item.category,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        taxRate: Number(item.taxRate || 0),
        totalPrice: Number(item.totalPrice)
      })) || []
    }

    // Generate PDF buffer
    const pdfBuffer = await generatePurchaseOrderPDF(pdfData)
    
    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${purchaseOrder.poNumber}-preview.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ Error generating PO PDF preview:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
