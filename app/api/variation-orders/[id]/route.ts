
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
// Auth check removed for now
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// GET /api/variation-orders/[id] - Get specific variation order
export async function GET(
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
            Customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        User_createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        User_approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        Quotation: {
          select: {
            id: true,
            quotationNumber: true,
            version: true,
            totalAmount: true,
            status: true,
            validUntil: true
          }
        }
      }
    })

    if (!variationOrder) {
      return NextResponse.json({ error: "Variation order not found" }, { status: 404 })
    }

    return NextResponse.json(variationOrder)
  } catch (error) {
    console.error("[Variation Order GET] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT /api/variation-orders/[id] - Update variation order
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Check if VO exists
    const existingVO = await prisma.variationOrder.findUnique({
      where: { id: params.id }
    })

    if (!existingVO) {
      return NextResponse.json({ error: "Variation order not found" }, { status: 404 })
    }

    // Only allow updates if in DRAFT status
    if (existingVO.status !== 'DRAFT') {
      return NextResponse.json(
        { error: "Can only update variation orders in DRAFT status" },
        { status: 400 }
      )
    }

    const variationOrder = await prisma.variationOrder.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        type: body.type,
        amount: body.amount,
        updatedAt: new Date()
      },
      include: {
        User_createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    console.log(`[Variation Order] Updated VO ${variationOrder.variationNumber}`)

    return NextResponse.json(variationOrder)
  } catch (error) {
    console.error("[Variation Order PUT] Error:", error)
    return NextResponse.json(
      { error: "Failed to update variation order" },
      { status: 500 }
    )
  }
}

// DELETE /api/variation-orders/[id] - Soft delete variation order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if VO exists
    const existingVO = await prisma.variationOrder.findUnique({
      where: { id: params.id }
    })

    if (!existingVO) {
      return NextResponse.json({ error: "Variation order not found" }, { status: 404 })
    }

    // Only allow deletion if in DRAFT status
    if (existingVO.status !== 'DRAFT') {
      return NextResponse.json(
        { error: "Can only delete variation orders in DRAFT status" },
        { status: 400 }
      )
    }

    await prisma.variationOrder.update({
      where: { id: params.id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    console.log(`[Variation Order] Deleted VO ${existingVO.variationNumber}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Variation Order DELETE] Error:", error)
    return NextResponse.json(
      { error: "Failed to delete variation order" },
      { status: 500 }
    )
  }
}
