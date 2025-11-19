
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { logActivity, logError, getIpAddress } from "@/lib/logger"

const updateCustomerSchema = z.object({
  // Basic Information
  name: z.string().min(1, "Company name is required").optional(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  
  // Contact Details
  emailAddress: z.string().email().optional().or(z.literal("")).nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  skypeUserName: z.string().optional().nullable(),
  
  // Legacy Address Fields (for backward compatibility)
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional(),
  postalCode: z.string().optional().nullable(),
  
  // Mailing Address (Xero)
  mailingAttention: z.string().optional().nullable(),
  mailingLine1: z.string().optional().nullable(),
  mailingLine2: z.string().optional().nullable(),
  mailingLine3: z.string().optional().nullable(),
  mailingLine4: z.string().optional().nullable(),
  mailingCity: z.string().optional().nullable(),
  mailingRegion: z.string().optional().nullable(),
  mailingPostalCode: z.string().optional().nullable(),
  mailingCountry: z.string().optional().nullable(),
  
  // Street Address (Xero)
  streetAttention: z.string().optional().nullable(),
  streetLine1: z.string().optional().nullable(),
  streetLine2: z.string().optional().nullable(),
  streetLine3: z.string().optional().nullable(),
  streetLine4: z.string().optional().nullable(),
  streetCity: z.string().optional().nullable(),
  streetRegion: z.string().optional().nullable(),
  streetPostalCode: z.string().optional().nullable(),
  streetCountry: z.string().optional().nullable(),
  
  // Company & Financial Information
  companyReg: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customerType: z.enum(["ENTERPRISE", "SME", "GOVERNMENT", "INDIVIDUAL"]).optional(),
  
  // Bank Information
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  bankSwiftCode: z.string().optional().nullable(),
  bankAddress: z.string().optional().nullable(),
  
  // Xero-specific Fields
  defaultCurrency: z.string().optional().nullable(),
  salesDefaultAccountCode: z.string().optional().nullable(),
  purchasesDefaultAccountCode: z.string().optional().nullable(),
  xeroNetworkKey: z.string().optional().nullable(),
  xeroContactId: z.string().optional().nullable(),
  xeroUpdatedDateUtc: z.string().optional().nullable(),
  isSupplier: z.boolean().optional().nullable(),
  isCustomer: z.boolean().optional().nullable(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const customer = await prisma.customer.findUnique({
      where: {
        id: params.id,
      },
      include: {
        Project: {
          select: {
            id: true,
            name: true,
            status: true,
            progress: true,
            startDate: true,
            endDate: true,
          },
        },
        CustomerInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            issueDate: true,
            dueDate: true,
          },
        },
        _count: {
          select: {
            Project: true,
            CustomerInvoice: true,
            LegacyInvoice: true,
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Return 410 Gone if customer is soft-deleted
    if (customer.isDeleted) {
      return NextResponse.json({ 
        error: "Customer has been deleted",
        deletedAt: customer.deletedAt,
        deletedBy: customer.deletedBy
      }, { status: 410 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error("GET /api/customers/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      await logError({
        action: 'Update Customer',
        message: 'Unauthorized access attempt',
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        errorCode: '401',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = updateCustomerSchema.parse(body)

    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
    })

    if (!existingCustomer) {
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: session.user.role,
        action: 'Update Customer',
        message: `Customer not found: ${params.id}`,
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        errorCode: '404',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Prevent updates to soft-deleted customers
    if (existingCustomer.isDeleted) {
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: session.user.role,
        action: 'Update Customer',
        message: `Cannot update deleted customer: ${params.id}`,
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        errorCode: '410',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json({ 
        error: "Customer has been deleted and cannot be updated",
        deletedAt: existingCustomer.deletedAt,
        deletedBy: existingCustomer.deletedBy
      }, { status: 410 })
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        _count: {
          select: {
            Project: true,
            CustomerInvoice: true,
            LegacyInvoice: true,
          },
        },
      },
    })

    // Log successful update
    await logActivity({
      userId: session.user.id,
      username: session.user.name || undefined,
      role: session.user.role,
      action: 'Update Customer',
      message: `Updated customer: ${existingCustomer.name}`,
      module: 'Customers',
      endpoint: `/api/customers/${params.id}`,
      ipAddress: getIpAddress(req),
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("PUT /api/customers/[id] validation error:", {
        customerId: params.id,
        issues: error.issues,
        formattedIssues: error.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }))
      })
      await logError({
        action: 'Update Customer',
        message: `Validation error: ${JSON.stringify(error.issues)}`,
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        errorCode: '400',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json(
        { 
          error: "Invalid input", 
          details: error.issues,
          message: error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')
        },
        { status: 400 }
      )
    }

    console.error("PUT /api/customers/[id] error:", error)
    await logError({
      action: 'Update Customer',
      message: error instanceof Error ? error.message : String(error),
      module: 'Customers',
      endpoint: `/api/customers/${params.id}`,
      errorCode: '500',
      ipAddress: getIpAddress(req),
      isCritical: true,
    })
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Require authentication
    if (!session) {
      await logError({
        action: 'Delete Customer',
        message: 'Unauthorized access attempt',
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        errorCode: '401',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Require SUPERADMIN role
    if (session.user.role !== 'SUPERADMIN') {
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: session.user.role,
        action: 'Delete Customer',
        message: `Forbidden: User ${session.user.email} attempted to delete customer without SUPERADMIN role`,
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        errorCode: '403',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json(
        { error: "Forbidden: Only Super Admins can delete contacts" },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await req.json().catch(() => ({}))
    const { hard = false, reason = '' } = body as { hard?: boolean; reason?: string }

    // Find existing customer (including soft-deleted)
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
    })

    if (!existingCustomer) {
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: session.user.role,
        action: 'Delete Customer',
        message: `Customer not found: ${params.id}`,
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        errorCode: '404',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Check if already deleted
    if (existingCustomer.isDeleted) {
      return NextResponse.json({ 
        error: "Customer is already deleted",
        deletedAt: existingCustomer.deletedAt,
        deletedBy: existingCustomer.deletedBy
      }, { status: 410 })
    }

    // Soft delete (default behavior)
    if (!hard) {
      await prisma.customer.update({
        where: { id: params.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: session.user.id,
          isActive: false, // Also set isActive to false for backward compatibility
        },
      })

      // Log successful soft deletion
      await logActivity({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: session.user.role,
        action: 'Soft Delete Customer',
        message: `Soft deleted customer: ${existingCustomer.name}. Reason: ${reason || 'No reason provided'}`,
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        ipAddress: getIpAddress(req),
      })

      return NextResponse.json({ 
        status: "soft-deleted",
        message: "Customer soft-deleted successfully. This does not affect Xero."
      })
    }

    // Hard delete path - check for dependencies first
    const [
      invoiceCount,
      legacyInvoiceCount,
      paymentCount,
      projectCount,
      quotationCount,
      taskCount,
      tenderCount,
      serviceContractCount,
      transactionCount
    ] = await Promise.all([
      prisma.customerInvoice.count({ where: { customerId: params.id } }),
      prisma.legacyInvoice.count({ where: { customerId: params.id } }),
      prisma.payment.count({ where: { customerId: params.id } }),
      prisma.project.count({ where: { customerId: params.id } }),
      prisma.quotation.count({ where: { customerId: params.id } }),
      prisma.task.count({ where: { customerId: params.id } }),
      prisma.tender.count({ where: { customerId: params.id } }),
      prisma.serviceContract.count({ where: { customerId: params.id } }),
      prisma.projectTransaction.count({ where: { customerId: params.id } }),
    ])

    const totalRefs = invoiceCount + legacyInvoiceCount + paymentCount + 
                      projectCount + quotationCount + taskCount + 
                      tenderCount + serviceContractCount + transactionCount

    if (totalRefs > 0) {
      const refs = {
        invoices: invoiceCount,
        legacyInvoices: legacyInvoiceCount,
        payments: paymentCount,
        projects: projectCount,
        quotations: quotationCount,
        tasks: taskCount,
        tenders: tenderCount,
        serviceContracts: serviceContractCount,
        transactions: transactionCount,
        total: totalRefs
      }

      // Log blocked hard delete attempt
      await logError({
        userId: session.user.id,
        username: session.user.name || undefined,
        role: session.user.role,
        action: 'Hard Delete Customer Blocked',
        message: `Hard delete blocked for customer: ${existingCustomer.name}. Has ${totalRefs} linked records.`,
        module: 'Customers',
        endpoint: `/api/customers/${params.id}`,
        errorCode: '409',
        ipAddress: getIpAddress(req),
      })

      return NextResponse.json({
        error: "Customer has linked records and cannot be hard deleted",
        details: refs,
        suggestion: "Use soft delete instead, or remove all linked records first."
      }, { status: 409 })
    }

    // No dependencies - proceed with hard delete
    await prisma.customer.delete({
      where: { id: params.id },
    })

    // Log successful hard deletion
    await logActivity({
      userId: session.user.id,
      username: session.user.name || undefined,
      role: session.user.role,
      action: 'Hard Delete Customer',
      message: `Hard deleted customer: ${existingCustomer.name}. Reason: ${reason || 'No reason provided'}`,
      module: 'Customers',
      endpoint: `/api/customers/${params.id}`,
      ipAddress: getIpAddress(req),
    })

    return NextResponse.json({ 
      status: "hard-deleted",
      message: "Customer permanently deleted"
    })

  } catch (error) {
    console.error("DELETE /api/customers/[id] error:", error)
    await logError({
      action: 'Delete Customer',
      message: error instanceof Error ? error.message : String(error),
      module: 'Customers',
      endpoint: `/api/customers/${params.id}`,
      errorCode: '500',
      ipAddress: getIpAddress(req),
      isCritical: true,
    })
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
