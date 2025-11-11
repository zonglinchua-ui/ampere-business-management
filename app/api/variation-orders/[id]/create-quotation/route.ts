
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
// Auth check removed for now
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// POST /api/variation-orders/[id]/create-quotation - Create quotation from variation order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const variationOrder = await prisma.variationOrder.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          select: {
            id: true,
            projectNumber: true,
            name: true,
            customerId: true
          }
        }
      }
    })

    if (!variationOrder) {
      return NextResponse.json({ error: "Variation order not found" }, { status: 404 })
    }

    // Generate quotation number
    const lastQuotation = await prisma.quotation.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    const lastNumber = lastQuotation
      ? parseInt(lastQuotation.quotationNumber.split('-')[1]) || 0
      : 0

    const quotationNumber = `Q${(new Date().getFullYear() % 100).toString().padStart(2, '0')}-${(lastNumber + 1).toString().padStart(3, '0')}`

    // Create quotation
    const quotation = await prisma.quotation.create({
      data: {
        id: `quot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quotationNumber,
        version: 1,
        title: `${variationOrder.title} - Variation Order ${variationOrder.variationNumber}`,
        description: variationOrder.description,
        customerId: variationOrder.Project.customerId,
        projectId: variationOrder.projectId,
        salespersonId: session.user.id,
        subtotal: variationOrder.amount,
        totalAmount: variationOrder.amount,
        currency: 'SGD',
        status: 'DRAFT',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdById: session.user.id,
        updatedAt: new Date()
      }
    })

    // Link quotation to variation order
    await prisma.variationOrder.update({
      where: { id: params.id },
      data: {
        quotationId: quotation.id,
        updatedAt: new Date()
      }
    })

    console.log(`[Variation Order] Created quotation ${quotationNumber} from VO ${variationOrder.variationNumber}`)

    return NextResponse.json(quotation, { status: 201 })
  } catch (error) {
    console.error("[Variation Order Create Quotation] Error:", error)
    return NextResponse.json(
      { error: "Failed to create quotation" },
      { status: 500 }
    )
  }
}
