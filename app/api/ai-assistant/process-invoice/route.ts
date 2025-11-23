/**
 * API Endpoint: Process Invoice and Link to Project
 * 
 * POST /api/ai-assistant/process-invoice
 * 
 * Extracts data from an invoice document and links it to a project
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFileBuffer } from '@/lib/s3'
import { extractInvoiceData } from '@/lib/ai-document-extraction'
import { createAuditLog } from '@/lib/api-audit-context'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session?.user?.role
    const canProcess = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canProcess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { documentId, extractedData, projectId, createRecord } = body

    // Step 1: If no extracted data provided, extract from document
    let invoiceData = extractedData
    
    if (!invoiceData && documentId) {
      console.log(`[Process Invoice] Extracting data from document: ${documentId}`)
      
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      })

      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      // Get file from S3 and extract data
      const fileBuffer = await getFileBuffer(document.cloudStoragePath)
      invoiceData = await extractInvoiceData(fileBuffer, document.filename, document.mimetype)
      
      console.log(`[Process Invoice] Extraction complete. Confidence: ${invoiceData.confidence}`)
      
      // Try to find matching project
      let suggestedProject = null
      if (invoiceData.projectReference) {
        suggestedProject = await prisma.project.findFirst({
          where: {
            OR: [
              { projectNumber: { contains: invoiceData.projectReference, mode: 'insensitive' } },
              { name: { contains: invoiceData.projectReference, mode: 'insensitive' } },
              {
                PurchaseOrder: {
                  some: {
                    poNumber: { contains: invoiceData.projectReference, mode: 'insensitive' }
                  }
                }
              }
            ],
            isActive: true
          },
          include: {
            Customer: true,
            PurchaseOrder: {
              where: {
                poNumber: { contains: invoiceData.projectReference, mode: 'insensitive' }
              },
              take: 1
            }
          }
        })
      }

      // Return extracted data for review
      return NextResponse.json({
        success: true,
        extractedData: invoiceData,
        suggestedProject: suggestedProject ? {
          id: suggestedProject.id,
          projectNumber: suggestedProject.projectNumber,
          name: suggestedProject.name,
          customer: suggestedProject.Customer?.name
        } : null,
        message: 'Invoice data extracted successfully. Please review and confirm.'
      })
    }

    // Step 2: If createRecord flag is true, create the supplier invoice record
    if (createRecord && invoiceData) {
      console.log(`[Process Invoice] Creating supplier invoice record: ${invoiceData.invoiceNumber}`)
      
      // Verify project exists
      if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { Customer: true }
      })

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      // Find or create supplier
      let supplier = await prisma.supplier.findFirst({
        where: {
          name: {
            contains: invoiceData.vendor.name,
            mode: 'insensitive'
          }
        }
      })

      if (!supplier) {
        console.log(`[Process Invoice] Creating new supplier: ${invoiceData.vendor.name}`)
        
        // Generate supplier number
        const lastSupplier = await prisma.supplier.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { id: true }
        })
        const supplierCount = await prisma.supplier.count()
        const supplierNumber = `SUP-${String(supplierCount + 1).padStart(5, '0')}`
        
        supplier = await prisma.supplier.create({
          data: {
            id: uuidv4(),
            name: invoiceData.vendor.name,
            email: invoiceData.vendor.email || null,
            phone: invoiceData.vendor.phone || null,
            address: invoiceData.vendor.address || null,
            supplierType: 'SUPPLIER',
            paymentTerms: 'NET_30',
            createdById: session.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      }

      // Create supplier invoice record
      const supplierInvoice = await prisma.supplierInvoice.create({
        data: {
          id: uuidv4(),
          invoiceNumber: invoiceData.invoiceNumber,
          supplierInvoiceRef: invoiceData.invoiceNumber,
          supplierId: supplier.id,
          projectId: project.id,
          subtotal: invoiceData.subtotal || invoiceData.totalAmount,
          taxAmount: invoiceData.taxAmount || 0,
          totalAmount: invoiceData.totalAmount,
          currency: 'SGD',
          status: 'PENDING_PROJECT_APPROVAL',
          invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : new Date(),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          receivedDate: new Date(),
          description: invoiceData.description || `Invoice from ${invoiceData.vendor.name}`,
          notes: invoiceData.paymentTerms || null,
          documentPath: documentId ? `Document ID: ${documentId}` : null,
          createdById: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          Supplier: true,
          Project: true
        }
      })

      console.log(`[Process Invoice] Supplier invoice record created: ${supplierInvoice.invoiceNumber}`)

      // Create invoice items if line items exist
      if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
        for (let i = 0; i < invoiceData.lineItems.length; i++) {
          const item = invoiceData.lineItems[i]
          await prisma.supplierInvoiceItem.create({
            data: {
              id: uuidv4(),
              supplierInvoiceId: supplierInvoice.id,
              description: item.description,
              category: 'SERVICES',
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              subtotal: item.amount || 0,
              taxAmount: 0,
              totalPrice: item.amount || 0,
              unit: 'pcs',
              order: i
            }
          })
        }
      }

      // Link document to project and supplier invoice
      if (documentId) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            projectId: project.id,
            supplierInvoiceId: supplierInvoice.id,
            category: 'INVOICE',
            description: `Invoice ${invoiceData.invoiceNumber} from ${invoiceData.vendor.name}`
          }
        })
        console.log(`[Process Invoice] Document linked to project and supplier invoice`)
      }

      // Create audit log
      await createAuditLog({
        userId: session.user.id,
        userEmail: session.user.email || '',
        action: 'CREATE',
        entityType: 'SUPPLIER_INVOICE',
        entityId: supplierInvoice.id,
        entityName: supplierInvoice.invoiceNumber,
        newValues: {
          invoiceNumber: supplierInvoice.invoiceNumber,
          project: project.projectNumber,
          supplier: supplier.name,
          totalAmount: supplierInvoice.totalAmount,
          source: 'AI_ASSISTANT_INVOICE_PROCESSING'
        }
      })

      return NextResponse.json({
        success: true,
        supplierInvoice: {
          id: supplierInvoice.id,
          invoiceNumber: supplierInvoice.invoiceNumber,
          project: {
            projectNumber: project.projectNumber,
            name: project.name
          },
          supplier: supplier.name,
          totalAmount: supplierInvoice.totalAmount,
          status: supplierInvoice.status
        },
        message: `Invoice ${invoiceData.invoiceNumber} processed and linked to project ${project.projectNumber}`
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  } catch (error: any) {
    console.error('[Process Invoice] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process invoice',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
