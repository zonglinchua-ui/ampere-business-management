
import { v4 as uuidv4 } from 'uuid'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prepareServiceInvoiceData, generateAndStoreServiceInvoicePDF } from '@/lib/servicing-invoice-pdf-utils'

// Helper function to generate invoice numbers
async function generateInvoiceNumber(type: 'CUSTOMER' | 'SUPPLIER'): Promise<string> {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  
  const prefix = type === 'CUSTOMER' ? 'INV' : 'SINV'
  
  const count = type === 'CUSTOMER' 
    ? await prisma.customerInvoice.count({
        where: {
          invoiceNumber: {
            startsWith: `${prefix}-${year}-${month}-`
          }
        }
      })
    : await prisma.supplierInvoice.count({
        where: {
          invoiceNumber: {
            startsWith: `${prefix}-${year}-${month}-`
          }
        }
      })
  
  return `${prefix}-${year}-${month}-${String(count + 1).padStart(3, '0')}`
}

// POST /api/servicing/jobs/[id]/invoices - Create draft invoice (client/vendor)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const userId = session.user?.id
    const canCreate = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canCreate) {
      return NextResponse.json({ error: 'Insufficient permissions to create invoices' }, { status: 403 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.invoiceType || !data.amount) {
      return NextResponse.json({ error: 'Missing required fields: invoiceType, amount' }, { status: 400 })
    }

    if (!['Client', 'Vendor'].includes(data.invoiceType)) {
      return NextResponse.json({ error: 'Invalid invoice type. Must be Client or Vendor' }, { status: 400 })
    }

    // Get the job to validate it exists
    const job = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        Project: true,
        ServiceContract: true,
        AssignedSupplier: true
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Service job not found' }, { status: 404 })
    }

    if (!job.ServiceContract) {
      return NextResponse.json({ error: 'Service contract not found for this job' }, { status: 404 })
    }

    // Generate invoice number for ServiceInvoice
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const invoicePrefix = data.invoiceType === 'Client' ? 'SVC-INV-C' : 'SVC-INV-V'
    
    const existingInvoices = await prisma.serviceInvoice.count({
      where: {
        invoiceNo: {
          startsWith: `${invoicePrefix}-${year}-${month}-`
        }
      }
    })
    
    const serviceInvoiceNo = `${invoicePrefix}-${year}-${month}-${String(existingInvoices + 1).padStart(3, '0')}`

    // Generate file path following NAS structure
    const clientCode = job.Customer.customerNumber || job.Customer.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const contractCode = job.ServiceContract.contractNo || 'CONTRACT'
    const projectCode = job.Project?.projectNumber || `ServiceContract_${contractCode}`
    const filePath = `/NAS/Ampere/Clients/${clientCode}/Projects/${projectCode}/Servicing/Invoices/${serviceInvoiceNo}.pdf`

    // Calculate amounts
    const subtotal = parseFloat(data.amount)
    const taxRate = 0.09 // 9% GST
    const taxAmount = subtotal * taxRate
    const totalAmount = subtotal + taxAmount

    // Create ServiceInvoice record
    const serviceInvoice = await prisma.serviceInvoice.create({
      data: {
        id: uuidv4(),
        jobId: params.id,
        invoiceNo: serviceInvoiceNo,
        invoiceType: data.invoiceType,
        amount: totalAmount,
        status: data.status || 'Draft',
        xeroId: data.xeroId || null,
        filePath,
        updatedAt: new Date()
      }
    })

    // Create corresponding CustomerInvoice or SupplierInvoice for finance module integration
    let financeInvoiceId: string | null = null
    let warningMessage: string | null = null

    if (data.invoiceType === 'Client') {
      // Create CustomerInvoice - can be linked to project and/or quotation from contract
      const customerInvoiceNumber = await generateInvoiceNumber('CUSTOMER')
      
      const customerInvoice = await prisma.customerInvoice.create({
        data: {
          id: uuidv4(),
          invoiceNumber: customerInvoiceNumber,
          projectId: job.Project?.id || null, // Optional - link if available
          customerId: job.Customer.id,
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalAmount: totalAmount,
          currency: 'SGD',
          status: 'DRAFT',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          description: `Service Invoice - ${job.ServiceContract.title || job.ServiceContract.serviceType}`,
          notes: `Auto-generated from Service Job ${params.id}. Service Contract: ${job.ServiceContract.contractNo}. Service Invoice: ${serviceInvoiceNo}${job.Project ? ` | Project: ${job.Project.projectNumber}` : ''}`,
          isXeroSynced: false,
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create invoice item
      await prisma.customerInvoiceItem.create({
        data: {
          id: uuidv4(),
          customerInvoiceId: customerInvoice.id,
          description: job.ServiceContract.title || `${job.ServiceContract.serviceType} Service`,
          category: 'SERVICES',
          quantity: 1,
          unitPrice: subtotal,
          taxRate: taxRate * 100,
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalPrice: totalAmount,
          unit: 'service',
          accountCode: '200',
          taxType: 'OUTPUT2',
          order: 1
        }
      })

      financeInvoiceId = customerInvoice.id
    } else if (data.invoiceType === 'Vendor') {
      // Create SupplierInvoice - can exist with or without project
      if (!job.AssignedSupplier) {
        return NextResponse.json({ 
          error: 'Cannot create vendor invoice: No supplier assigned to this job' 
        }, { status: 400 })
      }

      const supplierInvoiceNumber = await generateInvoiceNumber('SUPPLIER')
      
      const supplierInvoice = await prisma.supplierInvoice.create({
        data: {
          id: uuidv4(),
          invoiceNumber: supplierInvoiceNumber,
          supplierInvoiceRef: serviceInvoiceNo,
          supplierId: job.AssignedSupplier.id,
          projectId: job.Project?.id || null, // Optional - link if available
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalAmount: totalAmount,
          currency: 'SGD',
          status: 'DRAFT',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          description: `Vendor Service Invoice - ${job.ServiceContract.title || job.ServiceContract.serviceType}`,
          notes: `Auto-generated from Service Job ${params.id}. Service Contract: ${job.ServiceContract.contractNo}. Service Invoice: ${serviceInvoiceNo}${job.Project ? ` | Project: ${job.Project.projectNumber}` : ''}`,
          isXeroSynced: false,
          projectApprovalRequired: job.Project ? true : false, // Only require project approval if linked to project
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create invoice item
      await prisma.supplierInvoiceItem.create({
        data: {
          id: uuidv4(),
          supplierInvoiceId: supplierInvoice.id,
          description: job.ServiceContract.title || `${job.ServiceContract.serviceType} Service`,
          category: 'SERVICES',
          quantity: 1,
          unitPrice: subtotal,
          taxRate: taxRate * 100,
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalPrice: totalAmount,
          unit: 'service'
        }
      })

      financeInvoiceId = supplierInvoice.id
      
      if (!job.Project) {
        warningMessage = 'Note: This vendor invoice is not linked to a project. Please link the service contract to a project if project tracking is needed.'
      }
    }

    // Auto-generate PDF if requested (default: true)
    if (data.generatePdf !== false) {
      try {
        const invoiceData = await prepareServiceInvoiceData(serviceInvoice.id)
        if (invoiceData && userId) {
          await generateAndStoreServiceInvoicePDF(invoiceData, userId)
        }
      } catch (pdfError) {
        console.error('Error auto-generating invoice PDF:', pdfError)
        // Don't fail the invoice creation if PDF generation fails
      }
    }

    return NextResponse.json({
      serviceInvoice,
      financeInvoiceId,
      message: data.invoiceType === 'Client' 
        ? 'Client invoice created and added to unsynced invoices in finance module'
        : 'Vendor invoice created and added to unsynced invoices in finance module',
      warning: warningMessage
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating service invoice:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/servicing/jobs/[id]/invoices - List invoices for a job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canView = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions to view invoices' }, { status: 403 })
    }

    // Verify job exists
    const jobExists = await prisma.serviceJob.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!jobExists) {
      return NextResponse.json({ error: 'Service job not found' }, { status: 404 })
    }

    const invoices = await prisma.serviceInvoice.findMany({
      where: { jobId: params.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(invoices)

  } catch (error) {
    console.error('Error fetching service invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
