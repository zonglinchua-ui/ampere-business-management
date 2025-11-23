
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
// Auth check removed for now
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// POST /api/variation-orders/[id]/reject - Reject variation order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { rejectionReason } = body

    if (!rejectionReason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      )
    }

    const variationOrder = await prisma.variationOrder.findUnique({
      where: { id: params.id }
    })

    if (!variationOrder) {
      return NextResponse.json({ error: "Variation order not found" }, { status: 404 })
    }

    if (variationOrder.status !== 'SUBMITTED' && variationOrder.status !== 'UNDER_REVIEW') {
      return NextResponse.json(
        { error: "Can only reject variation orders in SUBMITTED or UNDER_REVIEW status" },
        { status: 400 }
      )
    }

    const updated = await prisma.variationOrder.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        rejectedDate: new Date(),
        rejectionReason,
        updatedAt: new Date()
      },
      include: {
        Project: {
          select: {
            name: true,
            projectNumber: true
          }
        }
      }
    })

    console.log(`[Variation Order] Rejected VO ${updated.variationNumber}: ${rejectionReason}`)

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[Variation Order Reject] Error:", error)
    return NextResponse.json(
      { error: "Failed to reject variation order" },
      { status: 500 }
    )
  }
}
