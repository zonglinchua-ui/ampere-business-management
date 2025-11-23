
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { generateAndStoreQuotationPDF } from '@/lib/quotation-pdf-utils'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'
import { createAuditLog } from '@/lib/api-audit-context'

// Generate next quotation number with global running sequence
async function generateQuotationNumber(customerId: string): Promise<string> {
  try {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const prefix = `Q${year}-${month}-`

    const lastQuotation = await prisma.quotation.findFirst({
      where: {
        quotationNumber: {
          startsWith: 'Q'
        }
      },
      orderBy: {
        quotationNumber: 'desc'
      },
      select: {
        quotationNumber: true
      }
    })

    let nextNumber = 1

    if (lastQuotation?.quotationNumber) {
      const match = lastQuotation.quotationNumber.match(/Q\d{2}-\d{2}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    return `${prefix}${nextNumber.toString().padStart(5, '0')}`
  } catch (error) {
    console.error('Error generating quotation number:', error)
    const timestamp = Date.now().toString().slice(-6)
    return `Q-ERR-${timestamp}`
  }
}

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
    const canDuplicate = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canDuplicate) {
      return NextResponse.json(
        createErrorResponse('Insufficient permissions to duplicate quotations'),
        { status: 403 }
      )
    }

    // Fetch the original quotation with all details
    const originalQuotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        QuotationItem: {
          orderBy: {
            order: 'asc'
          }
        },
        Customer: true
      }
    })

    if (!originalQuotation) {
      return NextResponse.json(
        createErrorResponse('Quotation not found'),
        { status: 404 }
      )
    }

    // Generate new quotation number
    const newQuotationNumber = await generateQuotationNumber(originalQuotation.customerId)

    // Create duplicate quotation
    const duplicateQuotation = await prisma.$transaction(async (tx: any) => {
      // Create the new quotation
      const newQuotation = await tx.quotation.create({
        data: {
          id: uuidv4(),
          quotationNumber: newQuotationNumber,
          version: 1,
          title: `${originalQuotation.title} (Copy)`,
          description: originalQuotation.description,
          clientReference: originalQuotation.clientReference,
          customerId: originalQuotation.customerId,
          projectId: originalQuotation.projectId,
          tenderId: originalQuotation.tenderId,
          salespersonId: session.user?.id || originalQuotation.salespersonId,
          subtotal: originalQuotation.subtotal,
          taxAmount: originalQuotation.taxAmount,
          discountAmount: originalQuotation.discountAmount,
          totalAmount: originalQuotation.totalAmount,
          currency: originalQuotation.currency,
          status: 'DRAFT',
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          validityDays: originalQuotation.validityDays,
          paymentTerms: originalQuotation.paymentTerms as any,
          additionalTerms: originalQuotation.additionalTerms,
          terms: originalQuotation.terms,
          notes: originalQuotation.notes,
          templateType: originalQuotation.templateType,
          requiresApproval: originalQuotation.requiresApproval,
          approvalValue: originalQuotation.approvalValue,
          isVariationOrder: originalQuotation.isVariationOrder,
          variationOrderType: originalQuotation.variationOrderType,
          createdById: session.user?.id || '',
          updatedAt: new Date()
        }
      })

      // Duplicate line items
      if (originalQuotation.QuotationItem && originalQuotation.QuotationItem.length > 0) {
        const itemsData = originalQuotation.QuotationItem.map((item: any, index: number) => ({
          id: uuidv4(),
          quotationId: newQuotation.id,
          description: item.description,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          subtotal: item.subtotal,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
          totalPrice: item.totalPrice,
          notes: item.notes,
          order: index + 1
        }))

        await tx.quotationItem.createMany({
          data: itemsData
        })
      }

      // Create activity log
      await tx.quotationActivity.create({
        data: {
          id: uuidv4(),
          quotationId: newQuotation.id,
          action: 'CREATED',
          description: `Quotation ${newQuotationNumber} duplicated from ${originalQuotation.quotationNumber} by ${session.user?.firstName} ${session.user?.lastName}`,
          oldValue: originalQuotation.quotationNumber,
          newValue: newQuotationNumber,
          userId: session.user?.id || '',
          userEmail: session.user?.email || ''
        }
      })

      return tx.quotation.findUnique({
        where: { id: newQuotation.id },
        include: {
          Customer: true,
          QuotationItem: true
        }
      })
    })

    // Generate PDF in background
    if (duplicateQuotation) {
      const pdfData = {
        id: duplicateQuotation.id,
        quotationNumber: duplicateQuotation.quotationNumber,
        version: duplicateQuotation.version,
        title: duplicateQuotation.title,
        description: duplicateQuotation.description,
        clientReference: duplicateQuotation.clientReference,
        subtotal: Number(duplicateQuotation.subtotal),
        taxAmount: duplicateQuotation.taxAmount ? Number(duplicateQuotation.taxAmount) : null,
        discountAmount: duplicateQuotation.discountAmount ? Number(duplicateQuotation.discountAmount) : null,
        totalAmount: Number(duplicateQuotation.totalAmount),
        currency: duplicateQuotation.currency,
        validUntil: duplicateQuotation.validUntil,
        terms: duplicateQuotation.terms,
        notes: duplicateQuotation.notes,
        client: duplicateQuotation.Customer ? {
          name: duplicateQuotation.Customer.name,
          email: duplicateQuotation.Customer.email,
          phone: duplicateQuotation.Customer.phone,
          address: duplicateQuotation.Customer.address,
          city: duplicateQuotation.Customer.city,
          state: duplicateQuotation.Customer.state,
          postalCode: duplicateQuotation.Customer.postalCode,
          country: duplicateQuotation.Customer.country
        } : undefined,
        items: duplicateQuotation.QuotationItem?.map((item: any) => ({
          description: item.description,
          category: item.category,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice)
        })) || []
      }

      generateAndStoreQuotationPDF(pdfData, session.user?.id || '').catch(error => {
        console.error('Failed to generate quotation PDF:', error)
      })
    }

    // Create audit log for dashboard
    await createAuditLog({
      userId: session.user?.id || '',
      userEmail: session.user?.email || '',
      action: 'CREATE',
      entityType: 'QUOTATION',
      entityId: duplicateQuotation?.id || '',
      entityName: duplicateQuotation?.title || newQuotationNumber,
      newValues: {
        quotationNumber: newQuotationNumber,
        duplicatedFrom: originalQuotation.quotationNumber
      }
    })

    return NextResponse.json(
      createSuccessResponse({
        id: duplicateQuotation?.id,
        quotationNumber: newQuotationNumber,
        version: 1,
        title: duplicateQuotation?.title
      }, {
        message: `Quotation duplicated successfully as ${newQuotationNumber}`
      }),
      { status: 201 }
    )

  } catch (error) {
    console.error('Error duplicating quotation:', error)
    return NextResponse.json(
      createErrorResponse('Failed to duplicate quotation', {
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    )
  }
}
