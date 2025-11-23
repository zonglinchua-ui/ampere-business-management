
import { PrismaClient } from '@prisma/client'
import { generateServiceInvoicePDF } from './pdf-generator-service-invoice'
import { uploadFile } from './s3'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

export interface ServiceInvoicePDFData {
  id: string
  invoiceNo: string
  invoiceType: 'Client' | 'Vendor'
  status: string
  amount: number
  tax: number
  totalAmount: number
  date: Date | string
  dueDate?: Date | string | null
  
  job: {
    id: string
    scheduledDate: Date | string
    completedAt?: Date | string | null
    description?: string | null
  }
  
  contract: {
    contractNo: string
    title: string
    serviceType: string
    frequency: string
  }
  
  customer: {
    name: string
    customerNumber?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  }
  
  project?: {
    name: string
    projectNumber: string
    address?: string | null
  } | null
  
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    amount: number
  }>
  
  paymentTerms?: string
  notes?: string | null
}

/**
 * Generate and store service invoice PDF
 */
export async function generateAndStoreServiceInvoicePDF(
  invoiceData: ServiceInvoicePDFData,
  userId: string
): Promise<string> {
  try {
    // Generate PDF buffer
    const pdfBuffer = await generateServiceInvoicePDF(invoiceData)
    
    // Create filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const pdfFilename = `service-invoice-${invoiceData.invoiceNo}-${timestamp}.pdf`
    
    // Upload to S3
    const pdfCloudPath = await uploadFile(pdfBuffer, pdfFilename)
    
    // Store document record in database
    await prisma.document.create({
      data: {
        id: uuidv4(),
        filename: pdfFilename,
        originalName: `Service Invoice ${invoiceData.invoiceNo}.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        cloudStoragePath: pdfCloudPath,
        description: `Auto-generated service invoice for ${invoiceData.contract.title}`,
        category: 'INVOICE',
        uploadedById: userId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    // Update ServiceInvoice with file path
    await prisma.serviceInvoice.update({
      where: { id: invoiceData.id },
      data: {
        filePath: pdfCloudPath,
        updatedAt: new Date()
      }
    })
    
    return pdfCloudPath
  } catch (error) {
    console.error('Error generating and storing service invoice PDF:', error)
    throw error
  }
}

/**
 * Fetch service invoice data from database and prepare for PDF generation
 */
export async function prepareServiceInvoiceData(invoiceId: string): Promise<ServiceInvoicePDFData | null> {
  try {
    const invoice = await prisma.serviceInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        ServiceJob: {
          include: {
            ServiceContract: true,
            Customer: true,
            Project: true
          }
        }
      }
    })

    if (!invoice || !invoice.ServiceJob) {
      return null
    }

    const job = invoice.ServiceJob

    // Convert Decimal to number and calculate tax (9% GST for Singapore)
    const amountNumber = typeof invoice.amount === 'number' ? invoice.amount : Number(invoice.amount)
    const tax = amountNumber * 0.09
    const totalAmount = amountNumber + tax

    // Default line item if none specified
    const defaultLineItem = {
      description: `${job.ServiceContract.serviceType} - ${job.ServiceContract.title}`,
      quantity: 1,
      unitPrice: amountNumber,
      amount: amountNumber
    }

    // Set payment terms based on invoice type
    const paymentTerms = invoice.invoiceType === 'Client' 
      ? 'Net 30 days from invoice date'
      : 'Payment upon completion of service'

    // Set due date (30 days from invoice date for client invoices)
    const dueDate = invoice.invoiceType === 'Client'
      ? new Date(new Date(invoice.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000)
      : null

    const invoiceData: ServiceInvoicePDFData = {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceType: invoice.invoiceType as 'Client' | 'Vendor',
      status: invoice.status,
      amount: amountNumber,
      tax,
      totalAmount,
      date: invoice.createdAt,
      dueDate,
      job: {
        id: job.id,
        scheduledDate: job.scheduledDate,
        completedAt: job.completedAt,
        description: job.completionNotes
      },
      contract: {
        contractNo: job.ServiceContract.contractNo,
        title: job.ServiceContract.title,
        serviceType: job.ServiceContract.serviceType,
        frequency: job.ServiceContract.frequency
      },
      customer: {
        name: job.Customer.name,
        customerNumber: job.Customer.customerNumber,
        email: job.Customer.email,
        phone: job.Customer.phone,
        address: job.Customer.address,
        city: job.Customer.city,
        state: job.Customer.state,
        postalCode: job.Customer.postalCode,
        country: job.Customer.country
      },
      project: job.Project ? {
        name: job.Project.name,
        projectNumber: job.Project.projectNumber,
        address: job.Project.address
      } : null,
      lineItems: [defaultLineItem],
      paymentTerms,
      notes: job.completionNotes
    }

    return invoiceData
  } catch (error) {
    console.error('Error preparing service invoice data:', error)
    throw error
  }
}

/**
 * Generate invoice number for service invoices
 */
export function generateServiceInvoiceNumber(invoiceType: 'Client' | 'Vendor', sequenceNumber: number): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const prefix = invoiceType === 'Client' ? 'SVC-INV-C' : 'SVC-INV-V'
  
  return `${prefix}-${year}-${month}-${String(sequenceNumber).padStart(3, '0')}`
}
