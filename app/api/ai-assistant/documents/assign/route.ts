
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export async function POST(request: NextRequest) {
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

    const { documentId, entityType, entityId } = await request.json()
    
    if (!documentId || !entityType || !entityId) {
      return NextResponse.json({ 
        error: 'Document ID, entity type, and entity ID are required' 
      }, { status: 400 })
    }

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Prepare update data based on entity type
    let updateData: any = {
      // Clear all existing assignments
      projectId: null,
      supplierId: null,
      tenderId: null,
      quotationId: null,
      customerInvoiceId: null,
      supplierInvoiceId: null,
      purchaseOrderId: null
    }

    // Set the appropriate field based on entity type
    switch (entityType) {
      case 'project':
        updateData.projectId = entityId
        break
      case 'vendor':
        updateData.supplierId = entityId
        break
      case 'tender':
        updateData.tenderId = entityId
        break
      case 'quotation':
        updateData.quotationId = entityId
        break
      case 'client_invoice':
        updateData.customerInvoiceId = entityId
        break
      case 'vendor_invoice':
        updateData.supplierInvoiceId = entityId
        break
      case 'purchase_order':
        updateData.purchaseOrderId = entityId
        break
      default:
        return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    // Update the document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      documentId: updatedDocument.id,
      assignedTo: {
        type: entityType,
        id: entityId
      }
    })

  } catch (error) {
    console.error('Document assignment error:', error)
    return NextResponse.json(
      { error: 'Failed to assign document' },
      { status: 500 }
    )
  }
}
