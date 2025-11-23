
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { ensureSystemBudgetCategories } from '@/lib/ensure-system-categories'

// PATCH /api/supplier-invoices/items/[id]/category - Update budget category for supplier invoice item
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure system budget categories exist
    await ensureSystemBudgetCategories()
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      console.error('Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemId = params.id
    console.log('Processing category update for item:', itemId)

    let requestBody
    try {
      requestBody = await request.json()
    } catch (e) {
      console.error('Invalid JSON in request body:', e)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { budgetCategoryId } = requestBody
    console.log('Budget category ID:', budgetCategoryId)

    // Check if the item exists and user has permission
    const item = await prisma.supplierInvoiceItem.findFirst({
      where: { id: itemId },
      include: {
        SupplierInvoice: {
          include: {
            Project: true
          }
        }
      }
    })

    if (!item) {
      console.error('Item not found:', itemId)
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (!item.SupplierInvoice) {
      console.error('SupplierInvoice relation not loaded for item:', itemId)
      return NextResponse.json({ error: 'Invalid item data' }, { status: 500 })
    }

    console.log('Found item:', item.id, 'Invoice:', item.SupplierInvoice.id)

    // Check permissions - simplified for debugging
    const userRole = session.user.role
    console.log('User role:', userRole, 'User ID:', session.user.id)
    
    const canEdit = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER'].includes(userRole)
    
    if (!canEdit && item.SupplierInvoice.Project) {
      const project = item.SupplierInvoice.Project
      const canEditProject = project.managerId === session.user.id || project.createdById === session.user.id
      if (!canEditProject) {
        console.error('Insufficient permissions for user:', session.user.id)
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    // Validate budget category if provided
    let validatedBudgetCategoryId: string | null = null
    if (budgetCategoryId && budgetCategoryId !== '' && budgetCategoryId !== 'no-category') {
      console.log('Validating budget category:', budgetCategoryId)
      
      // Check if it's a system category first (simpler check)
      const systemCategories = [
        'GENERAL', 'MATERIALS', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR',
        'PERMITS', 'TRANSPORTATION', 'OVERHEAD', 'CONTINGENCY', 'OTHER'
      ]
      
      if (systemCategories.includes(budgetCategoryId)) {
        validatedBudgetCategoryId = budgetCategoryId
        console.log('Using system category:', validatedBudgetCategoryId)
      } else {
        // Check if it's a custom category
        try {
          const customCategory = await prisma.budgetCategory.findUnique({
            where: { id: budgetCategoryId }
          })
          
          if (customCategory) {
            validatedBudgetCategoryId = budgetCategoryId
            console.log('Using custom category:', validatedBudgetCategoryId)
          } else {
            console.error('Invalid budget category:', budgetCategoryId)
            return NextResponse.json({ error: 'Invalid budget category' }, { status: 400 })
          }
        } catch (dbError) {
          console.error('Database error checking custom category:', dbError)
          return NextResponse.json({ error: 'Database error validating category' }, { status: 500 })
        }
      }
    } else {
      console.log('No category specified or removing category')
    }

    // Update the item
    console.log('Updating item with category:', validatedBudgetCategoryId)
    const updatedItem = await prisma.supplierInvoiceItem.update({
      where: { id: itemId },
      data: {
        budgetCategoryId: validatedBudgetCategoryId
      },
      include: {
        BudgetCategory: true
      }
    })

    console.log('Successfully updated item')

    // Simplified audit log (skip complex budget transaction for now to isolate the issue)
    try {
      await prisma.auditLog.create({
        data: {
          id: uuidv4(),
          action: 'UPDATE',
          entityType: 'SUPPLIER_INVOICE',
          entityId: itemId,
          oldValues: { budgetCategoryId: item.budgetCategoryId },
          newValues: { budgetCategoryId: validatedBudgetCategoryId },
          userId: session.user.id,
          userEmail: session.user.email || 'unknown'
        }
      })
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the entire operation for audit log issues
    }

    return NextResponse.json({ 
      success: true, 
      item: updatedItem 
    })

  } catch (error) {
    console.error('=== CRITICAL ERROR updating supplier invoice item category ===')
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Item ID:', params.id)
    console.error('=== END CRITICAL ERROR ===')
    return NextResponse.json({ 
      error: 'Failed to update category', 
      details: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, { status: 500 })
  }
}
