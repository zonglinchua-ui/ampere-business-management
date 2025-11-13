
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/s3'
import { v4 as uuidv4 } from 'uuid'

// POST /api/projects/[id]/supplier-invoices/upload - Upload supplier invoice
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = params.id

    // Check if user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { managerId: session.user.id },
          { salespersonId: session.user.id },
          // Allow SUPERADMIN and FINANCE roles to access all projects
          session.user.role === 'SUPERADMIN' || session.user.role === 'FINANCE' ? {} : { id: 'never-match' }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const supplierId = formData.get('supplierId') as string
    const subtotal = formData.get('subtotal') as string
    const taxAmount = formData.get('taxAmount') as string
    const amount = formData.get('amount') as string
    const budgetCategoryId = formData.get('budgetCategoryId') as string
    const notes = formData.get('notes') as string
    const invoiceNumber = formData.get('invoiceNumber') as string
    const invoiceDate = formData.get('invoiceDate') as string
    const extractionConfidence = formData.get('extractionConfidence') as string
    const wasAutoExtracted = formData.get('wasAutoExtracted') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!supplierId || !subtotal) {
      return NextResponse.json({ error: 'Supplier and subtotal are required' }, { status: 400 })
    }

    // Validate supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Validate budget category if provided
    let validatedBudgetCategoryId: string | null = null
    if (budgetCategoryId && budgetCategoryId !== '') {
      // Check if it's a custom category
      const customCategory = await prisma.budgetCategory.findUnique({
        where: { id: budgetCategoryId }
      })
      
      if (customCategory) {
        validatedBudgetCategoryId = budgetCategoryId
      } else {
        // Check if it's a system category
        const systemCategories = [
          'GENERAL', 'MATERIALS', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR',
          'PERMITS', 'TRANSPORTATION', 'OVERHEAD', 'CONTINGENCY', 'OTHER'
        ]
        if (systemCategories.includes(budgetCategoryId)) {
          validatedBudgetCategoryId = budgetCategoryId
        }
      }
    }

    // Upload file to S3
    console.log('Starting file upload to S3...')
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    })
    
    let s3Key: string
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      console.log('Uploading file:', fileName, 'Size:', buffer.length, 'bytes')
      s3Key = await uploadFile(buffer, fileName)
      console.log('File uploaded successfully to S3:', s3Key)
    } catch (s3Error) {
      console.error('S3 upload failed:', s3Error)
      throw new Error(`Failed to upload file to S3: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}`)
    }

    // Use provided invoice number or generate one
    let finalInvoiceNumber = invoiceNumber
    if (!finalInvoiceNumber || finalInvoiceNumber.trim() === '') {
      const invoiceCount = await prisma.supplierInvoice.count()
      finalInvoiceNumber = `SI-${String(invoiceCount + 1).padStart(6, '0')}`
    }

    // Use provided invoice date or current date
    let finalInvoiceDate = new Date()
    if (invoiceDate && invoiceDate.trim() !== '') {
      try {
        finalInvoiceDate = new Date(invoiceDate)
        if (isNaN(finalInvoiceDate.getTime())) {
          finalInvoiceDate = new Date()
        }
      } catch {
        finalInvoiceDate = new Date()
      }
    }

    // Calculate due date (30 days from invoice date)
    const dueDate = new Date(finalInvoiceDate)
    dueDate.setDate(dueDate.getDate() + 30)

    // Parse amounts
    const parsedSubtotal = parseFloat(subtotal)
    if (isNaN(parsedSubtotal) || parsedSubtotal <= 0) {
      return NextResponse.json({ error: 'Invalid subtotal' }, { status: 400 })
    }

    const parsedTaxAmount = taxAmount ? parseFloat(taxAmount) : 0
    if (isNaN(parsedTaxAmount) || parsedTaxAmount < 0) {
      return NextResponse.json({ error: 'Invalid tax amount' }, { status: 400 })
    }

    // Calculate total (subtotal + tax)
    const parsedTotalAmount = parsedSubtotal + parsedTaxAmount

    // Check if invoice number already exists for this supplier
    console.log('Checking for existing invoice with number:', finalInvoiceNumber, 'for supplier:', supplierId)
    const existingInvoice = await prisma.supplierInvoice.findFirst({
      where: {
        supplierId,
        invoiceNumber: finalInvoiceNumber
      }
    })

    if (existingInvoice) {
      console.error('Invoice number already exists:', finalInvoiceNumber)
      return NextResponse.json({ 
        error: 'Invoice number already exists for this supplier',
        details: `Invoice ${finalInvoiceNumber} already exists. Please use a different invoice number.`
      }, { status: 409 })
    }

    // Create supplier invoice record
    console.log('Creating supplier invoice record...')
    console.log('Invoice data:', {
      invoiceNumber: finalInvoiceNumber,
      supplierId,
      projectId,
      subtotal: parsedSubtotal,
      taxAmount: parsedTaxAmount,
      totalAmount: parsedTotalAmount
    })
    
    let supplierInvoice
    try {
      supplierInvoice = await prisma.supplierInvoice.create({
        data: {
          id: uuidv4(),
          invoiceNumber: finalInvoiceNumber,
          supplierInvoiceRef: file.name,
          supplierId,
          projectId,
          subtotal: parsedSubtotal,
          taxAmount: parsedTaxAmount,
          totalAmount: parsedTotalAmount,
          currency: 'SGD',
          status: 'DRAFT',
          invoiceDate: finalInvoiceDate,
          dueDate,
          receivedDate: new Date(),
          description: `Uploaded invoice: ${file.name}${wasAutoExtracted ? ' (AI-extracted)' : ''}`,
          notes: notes || null,
          documentPath: s3Key,
          createdById: session.user.id,
          updatedAt: new Date()
        }
      })
      console.log('Supplier invoice created successfully:', supplierInvoice.id)
    } catch (createError) {
      console.error('Failed to create supplier invoice:', createError)
      if (createError instanceof Error) {
        if (createError.message.includes('Unique constraint')) {
          return NextResponse.json({ 
            error: 'Invoice number already exists',
            details: `Invoice ${finalInvoiceNumber} already exists for this supplier.`
          }, { status: 409 })
        }
        throw createError
      }
      throw new Error('Failed to create supplier invoice: Unknown error')
    }

    // Create supplier invoice item with budget category if provided
    console.log('Creating supplier invoice item...')
    console.log('Invoice item data:', {
      supplierInvoiceId: supplierInvoice.id,
      category: 'SERVICES',
      quantity: 1,
      unitPrice: parsedSubtotal,
      budgetCategoryId: validatedBudgetCategoryId
    })
    
    try {
      await prisma.supplierInvoiceItem.create({
        data: {
          id: uuidv4(),
          supplierInvoiceId: supplierInvoice.id,
          description: `Invoice item: ${file.name}`,
          category: 'SERVICES',
          quantity: 1,
          unitPrice: parsedSubtotal,
          subtotal: parsedSubtotal,
          taxAmount: parsedTaxAmount,
          totalPrice: parsedTotalAmount,
          unit: 'pcs',
          notes: notes || null,
          budgetCategoryId: validatedBudgetCategoryId
        }
      })
      console.log('Supplier invoice item created successfully')
    } catch (itemError) {
      console.error('Failed to create supplier invoice item:', itemError)
      // Rollback: delete the created invoice
      await prisma.supplierInvoice.delete({ where: { id: supplierInvoice.id } }).catch(e => 
        console.error('Failed to rollback invoice:', e)
      )
      throw new Error(`Failed to create invoice item: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`)
    }

    // Update project budget if category is specified
    if (validatedBudgetCategoryId) {
      try {
        console.log('Updating project budget for category:', validatedBudgetCategoryId)
        await prisma.$transaction(async (tx) => {
          // Check if project budget for this category exists
          const existingBudget = await tx.projectBudget.findFirst({
            where: {
              projectId,
              OR: [
                { category: validatedBudgetCategoryId as any }, // System category
                { customCategoryId: validatedBudgetCategoryId } // Custom category
              ]
            }
          })

          if (existingBudget) {
            console.log('Found existing budget, updating...')
            // Update actual amount (use total amount including tax)
            await tx.projectBudget.update({
              where: { id: existingBudget.id },
              data: {
                actualAmount: {
                  increment: parsedTotalAmount
                }
              }
            })
          } else {
            console.log('No existing budget, creating new entry...')
            // Create new budget entry for this category
            await tx.projectBudget.create({
              data: {
                id: uuidv4(),
                projectId,
                category: validatedBudgetCategoryId && validatedBudgetCategoryId.length <= 20 ? validatedBudgetCategoryId as any : 'OTHER', // System category
                customCategoryId: validatedBudgetCategoryId && validatedBudgetCategoryId.length > 20 ? validatedBudgetCategoryId : null, // Custom category
                budgetedAmount: 0, // Will need to be updated manually
                actualAmount: parsedTotalAmount,
                createdById: session.user.id,
                updatedAt: new Date()
              }
            })
          }
        })
        console.log('Budget updated successfully')
      } catch (budgetError) {
        console.error('Error updating budget (continuing anyway):', budgetError)
        // Don't fail the whole upload if budget update fails
      }
    }

    // Create audit log
    try {
      console.log('Creating audit log...')
      await prisma.auditLog.create({
        data: {
          id: uuidv4(),
          action: 'CREATE',
          entityType: 'SUPPLIER_INVOICE',
          entityId: supplierInvoice.id,
          newValues: {
            invoiceNumber: supplierInvoice.invoiceNumber,
            subtotal: parsedSubtotal,
            taxAmount: parsedTaxAmount,
            totalAmount: parsedTotalAmount,
            supplier: supplier.name,
            project: project.name,
            budgetCategory: validatedBudgetCategoryId,
            documentPath: s3Key,
            wasAutoExtracted,
            extractionConfidence: extractionConfidence || null
          },
          userId: session.user.id,
          userEmail: session.user.email || 'unknown'
        }
      })
      console.log('Audit log created successfully')
    } catch (auditError) {
      console.error('Error creating audit log (continuing anyway):', auditError)
      // Don't fail the whole upload if audit log fails
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: supplierInvoice.id,
        invoiceNumber: supplierInvoice.invoiceNumber,
        subtotal: parsedSubtotal,
        taxAmount: parsedTaxAmount,
        totalAmount: parsedTotalAmount,
        budgetCategoryId: validatedBudgetCategoryId,
        documentPath: s3Key
      }
    })

  } catch (error) {
    console.error('Error uploading supplier invoice:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    
    return NextResponse.json({ 
      error: 'Failed to upload invoice',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
