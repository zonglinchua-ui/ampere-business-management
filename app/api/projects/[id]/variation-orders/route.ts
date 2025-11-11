
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
// Auth check removed for now
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// GET /api/projects/[id]/variation-orders - List all variation orders for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const projectId = params.id

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Fetch all variation orders for the project
    const variationOrders = await prisma.variationOrder.findMany({
      where: {
        projectId,
        isActive: true
      },
      include: {
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
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate total impact
    const approvedVOs = variationOrders.filter(vo => vo.status === 'APPROVED')
    const totalImpact = approvedVOs.reduce((sum, vo) => {
      const amount = parseFloat(vo.approvedAmount?.toString() || vo.amount.toString())
      return vo.type === 'ADDITION' ? sum + amount : sum - amount
    }, 0)

    return NextResponse.json({
      variationOrders,
      summary: {
        total: variationOrders.length,
        approved: approvedVOs.length,
        pending: variationOrders.filter(vo => vo.status === 'SUBMITTED' || vo.status === 'UNDER_REVIEW').length,
        totalImpact
      }
    })
  } catch (error) {
    console.error("[Variation Orders GET] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/variation-orders - Create new variation order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const projectId = params.id
    const body = await request.json()

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Generate variation number
    const lastVO = await prisma.variationOrder.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    const nextNumber = lastVO 
      ? parseInt(lastVO.variationNumber.split('-').pop() || '0') + 1
      : 1

    const variationNumber = `${project.projectNumber}-VO-${nextNumber.toString().padStart(3, '0')}`

    // Create variation order
    const variationOrder = await prisma.variationOrder.create({
      data: {
        id: `vo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        variationNumber,
        projectId,
        title: body.title,
        description: body.description,
        type: body.type || 'ADDITION',
        status: 'DRAFT',
        amount: body.amount,
        createdById: session.user.id,
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

    console.log(`[Variation Order] Created VO ${variationNumber} for project ${project.projectNumber}`)

    return NextResponse.json(variationOrder, { status: 201 })
  } catch (error) {
    console.error("[Variation Orders POST] Error:", error)
    return NextResponse.json(
      { error: "Failed to create variation order" },
      { status: 500 }
    )
  }
}
