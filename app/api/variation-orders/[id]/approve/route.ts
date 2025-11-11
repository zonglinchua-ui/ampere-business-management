
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { PrismaClient } from "@prisma/client"
import { generateAndStoreVariationOrderPDF } from "@/lib/variation-order-pdf-utils"

const prisma = new PrismaClient()

// POST /api/variation-orders/[id]/approve - Approve variation order
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
    const { approvedAmount } = body

    const variationOrder = await prisma.variationOrder.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          include: {
            Customer: {
              select: {
                name: true,
                email: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                postalCode: true,
                country: true
              }
            }
          }
        }
      }
    })

    if (!variationOrder) {
      return NextResponse.json({ error: "Variation order not found" }, { status: 404 })
    }

    if (variationOrder.status !== 'SUBMITTED' && variationOrder.status !== 'UNDER_REVIEW') {
      return NextResponse.json(
        { error: "Can only approve variation orders in SUBMITTED or UNDER_REVIEW status" },
        { status: 400 }
      )
    }

    // Update variation order to approved
    const updated = await prisma.variationOrder.update({
      where: { id: params.id },
      data: {
        status: 'APPROVED',
        approvedAmount: approvedAmount || variationOrder.amount,
        approvedDate: new Date(),
        approvedById: session.user.id,
        updatedAt: new Date()
      },
      include: {
        Project: {
          select: {
            id: true,
            projectNumber: true,
            name: true,
            contractValue: true
          }
        },
        User_approvedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Update project contract value
    const currentContractValue = parseFloat(variationOrder.Project.contractValue?.toString() || '0')
    const impact = parseFloat((approvedAmount || variationOrder.amount).toString())
    
    const newContractValue = updated.type === 'ADDITION' 
      ? currentContractValue + impact
      : currentContractValue - impact

    await prisma.project.update({
      where: { id: variationOrder.projectId },
      data: {
        contractValue: newContractValue,
        updatedAt: new Date()
      }
    })

    console.log(`[Variation Order] Approved VO ${updated.variationNumber}, contract value updated: ${currentContractValue} -> ${newContractValue}`)

    // Generate PDF document for the approved VO
    try {
      await generateAndStoreVariationOrderPDF(
        {
          id: updated.id,
          variationNumber: updated.variationNumber,
          projectNumber: variationOrder.Project.projectNumber,
          title: updated.title,
          description: updated.description,
          type: updated.type,
          amount: parseFloat((updated.approvedAmount || updated.amount).toString()),
          currency: 'SGD',
          submittedDate: updated.submittedDate,
          client: variationOrder.Project.Customer,
          project: {
            name: variationOrder.Project.name,
            projectNumber: variationOrder.Project.projectNumber
          }
        },
        session.user.id
      )
      console.log(`[Variation Order] Generated PDF for VO ${updated.variationNumber}`)
    } catch (pdfError) {
      console.error(`[Variation Order] Failed to generate PDF:`, pdfError)
      // Don't fail the approval if PDF generation fails
    }

    return NextResponse.json({
      ...updated,
      contractValueImpact: {
        previous: currentContractValue,
        impact: updated.type === 'ADDITION' ? impact : -impact,
        new: newContractValue
      }
    })
  } catch (error) {
    console.error("[Variation Order Approve] Error:", error)
    return NextResponse.json(
      { error: "Failed to approve variation order" },
      { status: 500 }
    )
  }
}
