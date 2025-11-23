
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
// Auth check removed for now
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// POST /api/variation-orders/[id]/submit - Submit variation order for review
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
      where: { id: params.id }
    })

    if (!variationOrder) {
      return NextResponse.json({ error: "Variation order not found" }, { status: 404 })
    }

    if (variationOrder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: "Can only submit variation orders in DRAFT status" },
        { status: 400 }
      )
    }

    const updated = await prisma.variationOrder.update({
      where: { id: params.id },
      data: {
        status: 'SUBMITTED',
        submittedDate: new Date(),
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

    console.log(`[Variation Order] Submitted VO ${updated.variationNumber}`)

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[Variation Order Submit] Error:", error)
    return NextResponse.json(
      { error: "Failed to submit variation order" },
      { status: 500 }
    )
  }
}
