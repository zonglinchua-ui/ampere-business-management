
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { createSuccessResponse, createErrorResponse, createPaginatedResponse, parsePaginationParams, ensureArray } from "@/lib/api-response"
import { createAuditLog } from "@/lib/api-audit-context"

const createInvoiceSchema = z.object({
  description: z.string().optional().nullable(),
  amount: z.number().min(0, "Amount must be positive"),
  taxAmount: z.number().min(0).optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).default("DRAFT"),
  issueDate: z.string().optional(),
  dueDate: z.string(),
  customerId: z.string().min(1, "Customer is required"),
  projectId: z.string().min(1, "Project is required"), // Made required to match schema
  brandingPresetId: z.string().optional().nullable(),
  reminderCadence: z.enum(["GENTLE", "FIRM", "CUSTOM"]).optional(),
  reminderOffsets: z
    .array(z.number().int().nonnegative())
    .optional()
    .nullable(),
})

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear()
  const lastInvoice = await prisma.legacyInvoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}-`,
      },
    },
    orderBy: {
      invoiceNumber: "desc",
    },
  })

  let sequence = 1
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0')
    sequence = lastSequence + 1
  }

  return `INV-${year}-${sequence.toString().padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        createErrorResponse("Unauthorized", { code: "AUTH_REQUIRED" }),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const { page, pageSize, skip } = parsePaginationParams(searchParams)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const customerId = searchParams.get("customerId") || ""
    const projectId = searchParams.get("projectId") || ""

    const where = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { invoiceNumber: { contains: search, mode: "insensitive" as const } },
          { customer: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
      ...(status && { status: status as any }),
      ...(customerId && { customerId }),
      ...(projectId && { projectId }),
    }

    const [invoices, total] = await Promise.all([
      prisma.legacyInvoice.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              contactPerson: true,
            },
          },
          Project: {
            select: {
              id: true,
              name: true,
            },
          },
          BrandingPreset: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.legacyInvoice.count({ where }),
    ])

    // Legacy format for backward compatibility
    return NextResponse.json({
      invoices: ensureArray(invoices),
      pagination: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error("GET /api/invoices error:", error)
    return NextResponse.json(
      createErrorResponse("Internal server error", {
        details: process.env.NODE_ENV === "development" ? String(error) : undefined
      }),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createInvoiceSchema.parse(body)

    // Verify client exists
    const customer = await prisma.customer.findUnique({
      where: { id: validatedData.customerId, isActive: true },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 400 })
    }

    // Verify project exists if provided
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId, isActive: true },
      })

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 400 })
      }
    }

    // Calculate total amount
    const taxAmount = validatedData.taxAmount || 0
    const totalAmount = validatedData.amount + taxAmount

    const invoiceNumber = await generateInvoiceNumber()

    const invoice = await prisma.legacyInvoice.create({
      data: {
        id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        description: validatedData.description,
        amount: validatedData.amount,
        taxAmount: validatedData.taxAmount,
        status: validatedData.status,
        customerId: validatedData.customerId,
        projectId: validatedData.projectId,
        brandingPresetId: validatedData.brandingPresetId || undefined,
        reminderCadence: validatedData.reminderCadence,
        reminderOffsets: validatedData.reminderOffsets || undefined,
        invoiceNumber,
        totalAmount,
        issueDate: validatedData.issueDate ? new Date(validatedData.issueDate) : new Date(),
        dueDate: new Date(validatedData.dueDate),
        createdById: session.user.id,
        updatedAt: new Date(),
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
          },
        },
        BrandingPreset: true,
      },
    })

    // Create audit log for dashboard Recent Activities
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'CREATE',
      entityType: 'INVOICE',
      entityId: invoice.id,
      entityName: invoice.invoiceNumber,  // Add entity name for detailed display
      newValues: {
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.Customer?.name,
        project: invoice.Project?.name,
        amount: invoice.amount,
        status: invoice.status
      }
    })

    return NextResponse.json(
      createSuccessResponse(invoice, {
        message: `Invoice ${invoice.invoiceNumber} created successfully`
      }),
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse("Invalid input", {
          code: "VALIDATION_ERROR",
          details: error.issues
        }),
        { status: 400 }
      )
    }

    console.error("POST /api/invoices error:", error)
    return NextResponse.json(
      createErrorResponse("Internal server error", {
        details: process.env.NODE_ENV === "development" ? String(error) : undefined
      }),
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
