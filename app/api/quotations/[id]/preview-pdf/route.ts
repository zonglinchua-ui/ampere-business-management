
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateQuotationPDF } from '@/lib/pdf-generator'


// Handle HEAD requests for availability check
export async function HEAD(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return new NextResponse(null, { status: 401 })
    }

    // Check if quotation exists
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!quotation) {
      return new NextResponse(null, { status: 404 })
    }

    return new NextResponse(null, { status: 200 })
  } catch (error) {
    console.error('Error checking quotation:', error)
    return new NextResponse(null, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch quotation with all related data
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
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
        QuotationItem: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Prepare data for PDF generation
    const pdfData = {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      version: quotation.version,
      title: quotation.title,
      description: quotation.description,
      clientReference: quotation.clientReference,
      subtotal: Number(quotation.subtotal),
      taxAmount: quotation.taxAmount ? Number(quotation.taxAmount) : null,
      discountAmount: quotation.discountAmount ? Number(quotation.discountAmount) : null,
      totalAmount: Number(quotation.totalAmount),
      currency: quotation.currency,
      validUntil: quotation.validUntil,
      terms: quotation.terms,
      notes: quotation.notes,
      client: quotation.Customer ? {
        name: quotation.Customer.name,
        email: quotation.Customer.email,
        phone: quotation.Customer.phone,
        address: quotation.Customer.address,
        city: quotation.Customer.city,
        state: quotation.Customer.state,
        postalCode: quotation.Customer.postalCode,
        country: quotation.Customer.country
      } : undefined,
      items: quotation.QuotationItem?.map((item: any) => ({
        description: item.description,
        category: item.category,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        notes: item.notes
      })) || []
    }

    // Generate PDF buffer
    const pdfBuffer = await generateQuotationPDF(pdfData)
    
    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${quotation.quotationNumber}-preview.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error generating quotation PDF preview:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
