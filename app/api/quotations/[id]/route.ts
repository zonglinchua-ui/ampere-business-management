
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { updateQuotationPDF, deleteQuotationPDFs } from '@/lib/quotation-pdf-utils'
import { archiveDeletedQuotation, logArchival } from '@/lib/nas-archival-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quotation = await prisma.quotation.findUnique({
      where: { 
        id: params.id 
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            customerNumber: true,
            email: true,
            phone: true,
            customerType: true,
            address: true,
            city: true,
            state: true,
            country: true,
            postalCode: true
          }
        },
        Tender: {
          select: {
            id: true,
            tenderNumber: true,
            title: true
          }
        },
        User_Quotation_salespersonIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        User_Quotation_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        QuotationItem: {
          orderBy: {
            order: 'asc'
          }
        },
        QuotationApproval: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        QuotationActivity: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Format the response to match what the frontend expects
    const formattedQuotation = {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      version: quotation.version,
      title: quotation.title,
      description: quotation.description,
      clientReference: quotation.clientReference,
      customerId: quotation.customerId,
      tenderId: quotation.tenderId,
      salespersonId: quotation.salespersonId,
      subtotal: quotation.subtotal,
      taxAmount: quotation.taxAmount,
      discountAmount: quotation.discountAmount,
      totalAmount: quotation.totalAmount,
      currency: quotation.currency,
      status: quotation.status,
      validUntil: quotation.validUntil?.toISOString(),
      validityDays: quotation.validityDays,
      paymentTerms: quotation.paymentTerms,
      additionalTerms: quotation.additionalTerms,
      terms: quotation.terms,
      notes: quotation.notes,
      templateType: quotation.templateType,
      requiresApproval: quotation.requiresApproval,
      approvalValue: quotation.approvalValue,
      createdAt: quotation.createdAt.toISOString(),
      updatedAt: quotation.updatedAt.toISOString(),
      client: quotation.Customer ? {
        id: quotation.Customer.id,
        name: quotation.Customer.name,
        customerNumber: quotation.Customer.customerNumber,
        email: quotation.Customer.email,
        phone: quotation.Customer.phone,
        customerType: quotation.Customer.customerType,
        address: quotation.Customer.address,
        city: quotation.Customer.city,
        state: quotation.Customer.state,
        country: quotation.Customer.country,
        postalCode: quotation.Customer.postalCode
      } : null,
      tender: quotation.Tender ? {
        id: quotation.Tender.id,
        tenderNumber: quotation.Tender.tenderNumber,
        title: quotation.Tender.title
      } : null,
      salesperson: quotation.User_Quotation_salespersonIdToUser ? {
        id: quotation.User_Quotation_salespersonIdToUser.id,
        firstName: quotation.User_Quotation_salespersonIdToUser.firstName,
        lastName: quotation.User_Quotation_salespersonIdToUser.lastName,
        email: quotation.User_Quotation_salespersonIdToUser.email
      } : null,
      createdBy: quotation.User_Quotation_createdByIdToUser ? {
        id: quotation.User_Quotation_createdByIdToUser.id,
        firstName: quotation.User_Quotation_createdByIdToUser.firstName,
        lastName: quotation.User_Quotation_createdByIdToUser.lastName,
        email: quotation.User_Quotation_createdByIdToUser.email
      } : null,
      items: quotation.QuotationItem ? quotation.QuotationItem.map((item: any) => ({
        id: item.id,
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
        order: item.order
      })) : [],
      // Add lineItems as alias for items to match frontend expectations
      lineItems: quotation.QuotationItem ? quotation.QuotationItem.map((item: any) => ({
        id: item.id,
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
        order: item.order
      })) : [],
      approvals: quotation.QuotationApproval ? quotation.QuotationApproval.map((approval: any) => ({
        id: approval.id,
        status: approval.status,
        comments: approval.comments,
        approvalLevel: approval.approvalLevel,
        approvedAt: approval.approvedAt?.toISOString(),
        createdAt: approval.createdAt.toISOString(),
        approver: approval.User ? {
          id: approval.User.id,
          firstName: approval.User.firstName,
          lastName: approval.User.lastName,
          email: approval.User.email
        } : null
      })) : []
    }

    return NextResponse.json(formattedQuotation)
  } catch (error) {
    console.error('Error fetching quotation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = `PUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  console.log(`[${requestId}] ========== PUT /api/quotations/${params.id} START ==========`)
  
  try {
    const session = await getServerSession(authOptions)
    console.log(`[${requestId}] Session check:`, session ? `User: ${session.user?.email}` : 'No session')
    
    if (!session) {
      console.log(`[${requestId}] UNAUTHORIZED: No session found`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id
    console.log(`[${requestId}] User: ${userId}, Role: ${userRole}`)
    
    let data: any
    try {
      const rawBody = await request.text()
      console.log(`[${requestId}] Raw request body length:`, rawBody.length)
      console.log(`[${requestId}] Raw body preview:`, rawBody.substring(0, 500))
      data = JSON.parse(rawBody)
      console.log(`[${requestId}] Parsed request data keys:`, Object.keys(data))
      console.log(`[${requestId}] Request data:`, JSON.stringify({
        ...data,
        lineItems: data.lineItems ? `${data.lineItems.length} items` : 'none'
      }, null, 2))
    } catch (error) {
      console.error(`[${requestId}] ERROR parsing request body:`, error)
      return NextResponse.json({ error: 'Invalid request body - not valid JSON' }, { status: 400 })
    }

    // Validate required fields
    if (!params.id) {
      console.log(`[${requestId}] VALIDATION ERROR: No quotation ID provided`)
      return NextResponse.json({ error: 'Quotation ID is required' }, { status: 400 })
    }

    // Check if this is a status-only update
    const isStatusOnlyUpdate = Object.keys(data).length === 1 && 'status' in data
    console.log(`[${requestId}] Is status-only update:`, isStatusOnlyUpdate)
    
    // Validate payload structure (skip full validation for status-only updates)
    const validationErrors: string[] = []
    
    if (!isStatusOnlyUpdate) {
      // Only validate these fields for full updates
      if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
        validationErrors.push('title is required and must be a non-empty string')
      }
      
      if (!data.customerId || typeof data.customerId !== 'string') {
        validationErrors.push('customerId is required and must be a string')
      }
      
      if (!data.validUntil) {
        validationErrors.push('validUntil is required')
      }
      
      if (data.subtotal === undefined || data.subtotal === null) {
        validationErrors.push('subtotal is required')
      }
      
      if (data.totalAmount === undefined || data.totalAmount === null) {
        validationErrors.push('totalAmount is required')
      }
    }
    
    // Validate lineItems structure regardless of update type
    if (data.lineItems && !Array.isArray(data.lineItems)) {
      validationErrors.push('lineItems must be an array')
    }
    
    if (validationErrors.length > 0) {
      console.log(`[${requestId}] VALIDATION ERRORS:`, validationErrors)
      return NextResponse.json({ 
        error: 'Invalid request data', 
        validationErrors 
      }, { status: 400 })
    }

    // Check if quotation exists and user can edit it
    let existingQuotation: any
    try {
      console.log(`[${requestId}] Fetching existing quotation from database...`)
      existingQuotation = await prisma.quotation.findUnique({
        where: { id: params.id }
      })
      console.log(`[${requestId}] Existing quotation:`, existingQuotation ? 
        `Found (status: ${existingQuotation.status}, createdBy: ${existingQuotation.createdById})` : 
        'Not found')
    } catch (error) {
      console.error(`[${requestId}] DATABASE ERROR fetching quotation:`, error)
      return NextResponse.json({ error: 'Database connection error' }, { status: 503 })
    }

    if (!existingQuotation) {
      console.log(`[${requestId}] NOT FOUND: Quotation ${params.id} does not exist`)
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Determine what the user can do
    const canEditByRole = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    const isQuotationCreator = existingQuotation.createdById === userId
    const isQuotationSalesperson = existingQuotation.salespersonId === userId
    
    console.log(`[${requestId}] Permission check:`, {
      canEditByRole,
      isQuotationCreator,
      isQuotationSalesperson,
      quotationStatus: existingQuotation.status
    })
    
    // Check permissions based on what's being updated
    if (isStatusOnlyUpdate) {
      // For status updates, allow creators/salespersons for workflow transitions
      const canUpdateStatus = canEditByRole || isQuotationCreator || isQuotationSalesperson
      if (!canUpdateStatus) {
        console.log(`[${requestId}] FORBIDDEN: User cannot update status`)
        return NextResponse.json({ 
          error: 'Insufficient permissions. You must be an admin, project manager, or the quotation creator/salesperson.' 
        }, { status: 403 })
      }
    } else {
      // For full updates, allow if:
      // 1. User has admin/PM role, OR
      // 2. User is creator/salesperson AND quotation is still DRAFT
      const canEdit = canEditByRole || 
                     ((isQuotationCreator || isQuotationSalesperson) && existingQuotation.status === 'DRAFT')
      
      if (!canEdit) {
        console.log(`[${requestId}] FORBIDDEN: User cannot edit this quotation`)
        return NextResponse.json({ 
          error: 'Insufficient permissions. Only admins/PMs can edit all quotations. Others can only edit their own draft quotations.' 
        }, { status: 403 })
      }
      
      // If non-admin is trying to edit a non-draft quotation
      if (!canEditByRole && existingQuotation.status !== 'DRAFT') {
        console.log(`[${requestId}] FORBIDDEN: Can only edit draft quotations`)
        return NextResponse.json({ 
          error: 'Can only edit draft quotations. This quotation has status: ' + existingQuotation.status 
        }, { status: 403 })
      }
    }

    let updatedQuotation
    try {
      console.log(`[${requestId}] Starting database transaction...`)
      updatedQuotation = await prisma.$transaction(async (tx: any) => {
        // Prepare update data - only include provided fields
        const updateData: any = {
          updatedAt: new Date()
        }
        
        console.log(`[${requestId}] Building update data...`)
        
        // Add fields that are provided in the request
        if (data.title !== undefined) updateData.title = data.title
        if (data.description !== undefined) updateData.description = data.description
        if (data.clientReference !== undefined) updateData.clientReference = data.clientReference
        if (data.customerId !== undefined) updateData.customerId = data.customerId
        if (data.projectId !== undefined) updateData.projectId = data.projectId
        if (data.tenderId !== undefined) updateData.tenderId = data.tenderId
        if (data.salespersonId !== undefined) updateData.salespersonId = data.salespersonId
        if (data.status !== undefined) updateData.status = data.status
        if (data.validUntil !== undefined) updateData.validUntil = new Date(data.validUntil)
        if (data.validityDays !== undefined) updateData.validityDays = data.validityDays
        if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms
        if (data.additionalTerms !== undefined) updateData.additionalTerms = data.additionalTerms
        if (data.terms !== undefined) updateData.terms = data.terms
        if (data.notes !== undefined) updateData.notes = data.notes
        if (data.subtotal !== undefined) updateData.subtotal = data.subtotal
        if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount
        if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount
        if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount
        if (data.currency !== undefined) updateData.currency = data.currency
        if (data.templateType !== undefined) updateData.templateType = data.templateType
        if (data.isVariationOrder !== undefined) updateData.isVariationOrder = data.isVariationOrder
        if (data.variationOrderType !== undefined) updateData.variationOrderType = data.variationOrderType

        console.log(`[${requestId}] Update data fields:`, Object.keys(updateData))

        // Update quotation
        console.log(`[${requestId}] Updating quotation record...`)
        const quotation = await tx.quotation.update({
          where: { id: params.id },
          data: updateData
        })
        console.log(`[${requestId}] Quotation record updated successfully`)

        // Handle line items update if provided
        if (data.lineItems) {
          console.log(`[${requestId}] Processing ${data.lineItems.length} line items...`)
          
          // Delete existing line items
          console.log(`[${requestId}] Deleting existing line items...`)
          const deleteResult = await tx.quotationItem.deleteMany({
            where: { quotationId: params.id }
          })
          console.log(`[${requestId}] Deleted ${deleteResult.count} existing line items`)

          // Create new line items
          if (data.lineItems.length > 0) {
            console.log(`[${requestId}] Creating new line items...`)
            
            // Validate and prepare line items
            const itemsToCreate = data.lineItems.map((item: any, index: number) => {
              // Generate a unique ID if not provided
              const itemId = item.id || uuidv4()
              
              return {
                id: itemId,
                quotationId: params.id,
                description: item.description || '',
                category: item.category || 'MATERIALS',
                quantity: item.quantity || 0,
                unit: item.unit || 'pcs',
                unitPrice: item.unitPrice || 0,
                discount: item.discount || 0,
                taxRate: item.taxRate || 0,
                subtotal: item.subtotal || 0,
                discountAmount: item.discountAmount || 0,
                taxAmount: item.taxAmount || 0,
                totalPrice: item.totalPrice || 0,
                notes: item.notes || '',
                order: item.order || index + 1
              }
            })
            
            console.log(`[${requestId}] Line items to create:`, itemsToCreate.map((i: any) => ({
              id: i.id,
              description: i.description.substring(0, 30),
              category: i.category
            })))
            
            // Use createMany for batch insert
            const createResult = await tx.quotationItem.createMany({
              data: itemsToCreate,
              skipDuplicates: false
            })
            console.log(`[${requestId}] Created ${createResult.count} line items`)
          }
        }

        // Determine activity description and action
        let action = 'UPDATED'
        let description = 'Quotation updated'
        
        if (isStatusOnlyUpdate) {
          action = 'STATUS_CHANGED'
          let context = ''
          if (isQuotationCreator && isQuotationSalesperson) {
            context = ' (by creator and salesperson)'
          } else if (isQuotationCreator) {
            context = ' (by creator)'
          } else if (isQuotationSalesperson) {
            context = ' (by salesperson)'
          } else {
            context = ` (by ${userRole})`
          }
          description = `Status changed from ${existingQuotation.status} to ${data.status}${context}`
        }

        // Log activity
        console.log(`[${requestId}] Creating activity log entry...`)
        await tx.quotationActivity.create({
          data: {
            id: uuidv4(),
            quotationId: params.id,
            action: action,
            description: `${description} by ${session.user?.firstName} ${session.user?.lastName}`,
            oldValue: isStatusOnlyUpdate ? existingQuotation.status : null,
            newValue: isStatusOnlyUpdate ? data.status : null,
            userId: session.user?.id || '',
            userEmail: session.user?.email || ''
          }
        })
        console.log(`[${requestId}] Activity log created`)

        console.log(`[${requestId}] Transaction completed successfully`)
        return quotation
      }, {
        timeout: 10000, // 10 second timeout for the transaction
        maxWait: 5000, // Maximum time to wait for transaction to start
      })
    } catch (error: any) {
      console.error(`[${requestId}] TRANSACTION ERROR:`, error)
      console.error(`[${requestId}] Error code:`, error.code)
      console.error(`[${requestId}] Error message:`, error.message)
      console.error(`[${requestId}] Error stack:`, error.stack)
      
      if (error.code === 'P2034') {
        return NextResponse.json({ error: 'Transaction timeout. Please try again.' }, { status: 504 })
      }
      if (error.code === 'P2024') {
        return NextResponse.json({ error: 'Database connection timeout' }, { status: 504 })
      }
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Duplicate entry conflict' }, { status: 409 })
      }
      if (error.code === 'P2003') {
        return NextResponse.json({ error: 'Foreign key constraint failed' }, { status: 400 })
      }
      throw error // Re-throw to be caught by outer catch block
    }

    console.log(`[${requestId}] Quotation updated successfully, ID: ${updatedQuotation.id}`)

    // If this is a significant update (not just status change), regenerate PDF
    if (!isStatusOnlyUpdate) {
      console.log(`[${requestId}] Scheduling PDF regeneration...`)
      try {
        // Fetch the updated quotation with all related data for PDF generation
        const quotationForPDF = await prisma.quotation.findUnique({
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
                country: true,
                postalCode: true
              }
            },
            QuotationItem: {
              orderBy: {
                order: 'asc'
              }
            }
          }
        })

        if (quotationForPDF) {
          const pdfData = {
            id: quotationForPDF.id,
            quotationNumber: quotationForPDF.quotationNumber,
            version: quotationForPDF.version,
            title: quotationForPDF.title,
            description: quotationForPDF.description,
            clientReference: quotationForPDF.clientReference,
            subtotal: Number(quotationForPDF.subtotal),
            taxAmount: quotationForPDF.taxAmount ? Number(quotationForPDF.taxAmount) : null,
            discountAmount: quotationForPDF.discountAmount ? Number(quotationForPDF.discountAmount) : null,
            totalAmount: Number(quotationForPDF.totalAmount),
            currency: quotationForPDF.currency,
            validUntil: quotationForPDF.validUntil,
            terms: quotationForPDF.terms,
            notes: quotationForPDF.notes,
            client: quotationForPDF.Customer ? {
              name: quotationForPDF.Customer.name,
              email: quotationForPDF.Customer.email,
              phone: quotationForPDF.Customer.phone,
              address: quotationForPDF.Customer.address,
              city: quotationForPDF.Customer.city,
              state: quotationForPDF.Customer.state,
              country: quotationForPDF.Customer.country,
              postalCode: quotationForPDF.Customer.postalCode
            } : undefined,
            items: quotationForPDF.QuotationItem?.map((item: any) => ({
              description: item.description,
              category: item.category,
              quantity: Number(item.quantity),
              unit: item.unit,
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.totalPrice)
            })) || []
          }

          console.log(`[${requestId}] PDF data prepared, triggering update in background`)
          // Update PDF in background (don't await to avoid blocking response)
          updateQuotationPDF(pdfData, session.user?.id || '').catch(error => {
            console.error(`[${requestId}] Failed to update quotation PDF:`, error)
            // Log the error but don't fail the quotation update
          })
        }
      } catch (error) {
        console.error(`[${requestId}] Error preparing PDF data for update:`, error)
        // Don't fail quotation update due to PDF generation issues
      }
    }

    console.log(`[${requestId}] ========== PUT /api/quotations/${params.id} SUCCESS ==========`)
    return NextResponse.json(updatedQuotation)
  } catch (error: any) {
    console.error(`[${requestId}] ========== PUT /api/quotations/${params.id} ERROR ==========`)
    console.error(`[${requestId}] Error:`, error)
    console.error(`[${requestId}] Error code:`, error.code)
    console.error(`[${requestId}] Error message:`, error.message)
    console.error(`[${requestId}] Error stack:`, error.stack)
    
    // Provide more specific error messages
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A quotation with this number already exists' }, { status: 409 })
    }
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'Invalid reference to customer, tender, or salesperson' }, { status: 400 })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Quotation not found or already deleted' }, { status: 404 })
    }
    if (error.message?.includes('timeout') || error.message?.includes('connection')) {
      return NextResponse.json({ 
        error: 'Database connection error. Please try again.', 
        details: error.message 
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code
    }, { status: 500 })
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

    const userRole = session.user?.role
    const canDelete = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if quotation exists
    const existingQuotation = await prisma.quotation.findUnique({
      where: { id: params.id }
    })

    if (!existingQuotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Only allow deleting DRAFT quotations
    if (existingQuotation.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Can only delete draft quotations' }, { status: 400 })
    }

    // Archive quotation PDFs to NAS DELETED folder (async, don't wait)
    archiveDeletedQuotation(existingQuotation.quotationNumber, params.id, existingQuotation.createdAt)
      .then(result => {
        if (result.success) {
          console.log(`[DELETE Quotation] ✅ Quotation archived to: ${result.archivedPath}`)
          // Log archival
          logArchival('QUOTATION', params.id, existingQuotation.quotationNumber, result.archivedPath || '', session.user.id)
        } else {
          console.warn(`[DELETE Quotation] ⚠️ Quotation archival failed: ${result.error}`)
        }
      })
      .catch(error => {
        console.error('[DELETE Quotation] ❌ Quotation archival error:', error)
      })

    await prisma.$transaction(async (tx: any) => {
      // Delete related records first
      await tx.quotationActivity.deleteMany({
        where: { quotationId: params.id }
      })
      
      await tx.quotationApproval.deleteMany({
        where: { quotationId: params.id }
      })
      
      await tx.quotationItem.deleteMany({
        where: { quotationId: params.id }
      })

      // Delete quotation
      await tx.quotation.delete({
        where: { id: params.id }
      })
    })

    // Clean up associated PDFs (don't wait for completion)
    deleteQuotationPDFs(params.id).catch(error => {
      console.error('Failed to clean up quotation PDFs:', error)
      // Don't fail the deletion if PDF cleanup fails
    })

    return NextResponse.json({ message: 'Quotation deleted successfully' })
  } catch (error) {
    console.error('Error deleting quotation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
