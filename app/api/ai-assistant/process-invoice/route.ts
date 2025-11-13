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
              { poNumber: { contains: invoiceData.projectReference, mode: 'insensitive' } },
              { name: { contains: invoiceData.projectReference, mode: 'insensitive' } }
            ],
            isActive: true
          },
          include: {
            Customer: true
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

    // Step 2: If createRecord flag is true, create the invoice record
    if (createRecord && invoiceData) {
      console.log(`[Process Invoice] Creating invoice record: ${invoiceData.invoiceNumber}`)
      
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

      // Find or create vendor
      let vendor = await prisma.vendor.findFirst({
        where: {
          name: {
            contains: invoiceData.vendor.name,
            mode: 'insensitive'
          }
        }
      })

      if (!vendor) {
        console.log(`[Process Invoice] Creating new vendor: ${invoiceData.vendor.name}`)
        vendor = await prisma.vendor.create({
          data: {
            vendorNumber: `V-${Date.now()}`,
            name: invoiceData.vendor.name,
            email: invoiceData.vendor.email || '',
            phone: invoiceData.vendor.phone || '',
            address: invoiceData.vendor.address || '',
            type: 'Supplier',
            status: 'Active'
          }
        })
      }

      // Create expense record for the invoice
      const expense = await prisma.expense.create({
        data: {
          expenseNumber: `EXP-${Date.now()}`,
          projectId: project.id,
          vendorId: vendor.id,
          description: `Invoice ${invoiceData.invoiceNumber} from ${invoiceData.vendor.name}`,
          category: 'MATERIALS', // Default category
          amount: invoiceData.totalAmount,
          expenseDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : new Date(),
          paymentStatus: 'PENDING',
          paymentDueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          notes: invoiceData.paymentTerms || '',
          receiptPath: documentId ? `Document ID: ${documentId}` : undefined
        }
      })

      console.log(`[Process Invoice] Expense record created: ${expense.expenseNumber}`)

      // Link document to project and expense
      if (documentId) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            projectId: project.id,
            category: 'INVOICE',
            description: `Invoice ${invoiceData.invoiceNumber} from ${invoiceData.vendor.name}`
          }
        })
        console.log(`[Process Invoice] Document linked to project`)
      }

      // Create audit log
      await createAuditLog({
        userId: session.user.id,
        userEmail: session.user.email || '',
        action: 'CREATE',
        entityType: 'EXPENSE',
        entityId: expense.id,
        entityName: expense.description,
        newValues: {
          expenseNumber: expense.expenseNumber,
          project: project.projectNumber,
          vendor: vendor.name,
          invoiceNumber: invoiceData.invoiceNumber,
          amount: expense.amount,
          source: 'AI_ASSISTANT_INVOICE_PROCESSING'
        }
      })

      return NextResponse.json({
        success: true,
        expense: {
          id: expense.id,
          expenseNumber: expense.expenseNumber,
          project: {
            projectNumber: project.projectNumber,
            name: project.name
          },
          vendor: vendor.name,
          invoiceNumber: invoiceData.invoiceNumber,
          amount: expense.amount,
          paymentStatus: expense.paymentStatus
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
