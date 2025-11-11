
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { canEditAnyInvoice } from "@/lib/permissions"

const updateInvoiceSchema = z.object({
  description: z.string().optional().nullable(),
  amount: z.number().min(0, "Amount must be positive").optional(),
  taxAmount: z.number().min(0).optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
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

    // Try fetching CustomerInvoice first
    let invoice = await prisma.customerInvoice.findUnique({
      where: { id: params.id },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            contactPerson: true,
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            description: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        CustomerInvoiceItem: {
          orderBy: {
            order: 'asc'
          }
        },
        Payment: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            currency: true,
            paymentDate: true,
            reference: true,
            status: true,
            paymentMethod: true,
            xeroPaymentId: true,
          },
          orderBy: {
            paymentDate: 'desc'
          }
        },
      },
    })

    // If not found, try LegacyInvoice
    if (!invoice) {
      const legacyInvoice = await prisma.legacyInvoice.findUnique({
        where: { id: params.id },
        include: {
          Customer: true,
          Project: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      if (!legacyInvoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
      }

      return NextResponse.json(legacyInvoice)
    }

    // Return CustomerInvoice with renamed fields for compatibility
    // Ensure items is always an array
    const items = Array.isArray(invoice.CustomerInvoiceItem) 
      ? invoice.CustomerInvoiceItem 
      : []
    
    const payments = Array.isArray(invoice.Payment)
      ? invoice.Payment
      : []

    return NextResponse.json({
      ...invoice,
      items,
      payments,
      // Ensure project fields are available for metadata
      projectId: invoice.projectId,
      projectName: invoice.Project?.name,
      // Ensure these fields are set for frontend compatibility
      CustomerInvoiceItem: undefined, // Remove to avoid confusion
      Payment: undefined // Remove to avoid confusion
    })
  } catch (error) {
    console.error("GET /api/invoices/[id] error:", error)
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = updateInvoiceSchema.parse(body)

    const existingInvoice = await prisma.legacyInvoice.findUnique({
      where: { id: params.id },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Calculate total amount if amount or tax is being updated
    let updateData: any = {
      ...validatedData,
      issueDate: validatedData.issueDate ? new Date(validatedData.issueDate) : undefined,
      dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
    }

    if (validatedData.amount !== undefined || validatedData.taxAmount !== undefined) {
      const amount = validatedData.amount ?? existingInvoice.amount
      const taxAmount = validatedData.taxAmount ?? existingInvoice.taxAmount ?? 0
      updateData.totalAmount = Number(amount) + Number(taxAmount)
    }

    const updatedInvoice = await prisma.legacyInvoice.update({
      where: { id: params.id },
      data: updateData,
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
      },
    })

    return NextResponse.json(updatedInvoice)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("PUT /api/invoices/[id] error:", error)
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

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to delete invoices
    const userRole = session.user?.role
    const canDelete = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canDelete) {
      return NextResponse.json(
        { error: "You don't have permission to delete invoices" },
        { status: 403 }
      )
    }

    // Try to find CustomerInvoice first (includes progress claim invoices)
    let customerInvoice = await prisma.customerInvoice.findUnique({
      where: { id: params.id },
      include: {
        CustomerInvoiceItem: true,
      }
    })

    if (customerInvoice) {
      // Check if invoice is synced to Xero
      if (customerInvoice.isXeroSynced || customerInvoice.xeroInvoiceId) {
        return NextResponse.json(
          { 
            error: "Cannot delete Xero-synced invoice",
            message: "This invoice has been synced to Xero. Please delete it from Xero or issue a credit note instead."
          },
          { status: 400 }
        )
      }

      // Check if invoice is in DRAFT status or user is SUPERADMIN
      const isSuperAdmin = canEditAnyInvoice(userRole as any)
      if (customerInvoice.status !== 'DRAFT' && !isSuperAdmin) {
        return NextResponse.json(
          { 
            error: "Cannot delete non-draft invoice",
            message: "Only SUPERADMIN can delete non-draft invoices. This invoice has status: " + customerInvoice.status + ". Please contact your administrator."
          },
          { status: 403 }
        )
      }

      // Delete related items first
      if (customerInvoice.CustomerInvoiceItem && customerInvoice.CustomerInvoiceItem.length > 0) {
        await prisma.customerInvoiceItem.deleteMany({
          where: { customerInvoiceId: params.id }
        })
      }

      // Delete the invoice
      await prisma.customerInvoice.delete({
        where: { id: params.id },
      })

      console.log(`✅ Deleted draft CustomerInvoice: ${customerInvoice.invoiceNumber}`)
      return NextResponse.json({ 
        success: true,
        message: "Draft invoice deleted successfully" 
      })
    }

    // Fallback: Try LegacyInvoice
    const existingInvoice = await prisma.legacyInvoice.findUnique({
      where: { id: params.id },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Delete legacy invoice (hard delete for legacy invoices)
    await prisma.legacyInvoice.delete({
      where: { id: params.id },
    })

    console.log(`✅ Deleted LegacyInvoice: ${existingInvoice.invoiceNumber}`)
    return NextResponse.json({ 
      success: true,
      message: "Invoice deleted successfully" 
    })
  } catch (error: any) {
    console.error("DELETE /api/invoices/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
