
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { generateAndStoreQuotationPDF } from '@/lib/quotation-pdf-utils'
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
    const canCreateVersion = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canCreateVersion) {
      return NextResponse.json(
        createErrorResponse('Insufficient permissions to create quotation versions'),
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

    // Only create versions from APPROVED or SENT quotations
    if (!['APPROVED', 'SENT'].includes(originalQuotation.status)) {
      return NextResponse.json(
        createErrorResponse('Can only create versions from approved or sent quotations'),
        { status: 400 }
      )
    }

    // Find the highest version number for this quotation
    const highestVersion = await prisma.quotation.findFirst({
      where: {
        quotationNumber: originalQuotation.quotationNumber
      },
      orderBy: {
        version: 'desc'
      },
      select: {
        version: true
      }
    })

    const newVersion = (highestVersion?.version || originalQuotation.version) + 1

    // Create new version
    const newVersionQuotation = await prisma.$transaction(async (tx) => {
      // Mark the original quotation as superseded
      await tx.quotation.update({
        where: { id: params.id },
        data: {
          status: 'SUPERSEDED'
        }
      })

      // Create the new version
      const newQuotation = await tx.quotation.create({
        data: {
          id: uuidv4(),
          quotationNumber: originalQuotation.quotationNumber,
          version: newVersion,
          title: originalQuotation.title,
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
          parentQuotationId: params.id,
          createdById: session.user?.id || '',
          updatedAt: new Date()
        }
      })

      // Copy line items
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

      // Create activity logs for both quotations
      await tx.quotationActivity.create({
        data: {
          id: uuidv4(),
          quotationId: params.id,
          action: 'SUPERSEDED',
          description: `Quotation superseded by version ${newVersion}`,
          oldValue: originalQuotation.status,
          newValue: 'SUPERSEDED',
          userId: session.user?.id || '',
          userEmail: session.user?.email || ''
        }
      })

      await tx.quotationActivity.create({
        data: {
          id: uuidv4(),
          quotationId: newQuotation.id,
          action: 'CREATED',
          description: `Version ${newVersion} created from version ${originalQuotation.version} by ${session.user?.firstName} ${session.user?.lastName}`,
          oldValue: `v${originalQuotation.version}`,
          newValue: `v${newVersion}`,
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
    if (newVersionQuotation) {
      const pdfData = {
        id: newVersionQuotation.id,
        quotationNumber: newVersionQuotation.quotationNumber,
        version: newVersionQuotation.version,
        title: newVersionQuotation.title,
        description: newVersionQuotation.description,
        clientReference: newVersionQuotation.clientReference,
        subtotal: Number(newVersionQuotation.subtotal),
        taxAmount: newVersionQuotation.taxAmount ? Number(newVersionQuotation.taxAmount) : null,
        discountAmount: newVersionQuotation.discountAmount ? Number(newVersionQuotation.discountAmount) : null,
        totalAmount: Number(newVersionQuotation.totalAmount),
        currency: newVersionQuotation.currency,
        validUntil: newVersionQuotation.validUntil,
        terms: newVersionQuotation.terms,
        notes: newVersionQuotation.notes,
        client: newVersionQuotation.Customer ? {
          name: newVersionQuotation.Customer.name,
          email: newVersionQuotation.Customer.email,
          phone: newVersionQuotation.Customer.phone,
          address: newVersionQuotation.Customer.address,
          city: newVersionQuotation.Customer.city,
          state: newVersionQuotation.Customer.state,
          postalCode: newVersionQuotation.Customer.postalCode,
          country: newVersionQuotation.Customer.country
        } : undefined,
        items: newVersionQuotation.QuotationItem?.map((item: any) => ({
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
      action: 'UPDATE',
      entityType: 'QUOTATION',
      entityId: newVersionQuotation?.id || '',
      entityName: `${originalQuotation.quotationNumber} v${newVersion}`,
      newValues: {
        version: newVersion,
        previousVersion: originalQuotation.version
      }
    })

    return NextResponse.json(
      createSuccessResponse({
        id: newVersionQuotation?.id,
        quotationNumber: originalQuotation.quotationNumber,
        version: newVersion,
        title: newVersionQuotation?.title
      }, {
        message: `Version ${newVersion} created successfully`
      }),
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating quotation version:', error)
    return NextResponse.json(
      createErrorResponse('Failed to create quotation version', {
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    )
  }
}
