
/**
 * BCA Workhead Data API
 * Manages BCA workhead requirements and company data
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logBcaAction } from "@/lib/bca-services/audit-logger"

// GET - Get all workhead data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workheads = await prisma.bcaWorkheadData.findMany({
      orderBy: { workheadName: "asc" },
    })

    return NextResponse.json({ workheads }, { status: 200 })
  } catch (error) {
    console.error("[BCA Workhead Data GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch workhead data" },
      { status: 500 }
    )
  }
}

// POST - Create new workhead data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Check if workhead code already exists
    const existing = await prisma.bcaWorkheadData.findUnique({
      where: { workheadCode: body.workheadCode },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Workhead code already exists" },
        { status: 400 }
      )
    }

    // Create new workhead data
    const workhead = await prisma.bcaWorkheadData.create({
      data: {
        workheadCode: body.workheadCode,
        workheadName: body.workheadName,
        description: body.description || null,
        minContractValue: body.minContractValue,
        minProjectCount: body.minProjectCount,
        eligibilityCriteria: {
          requirements: [],
        },
        sourceUrl: "",
        lastFetchDate: new Date(),
        isActive: true,
      },
    })

    // Log the action
    await logBcaAction({
      action: "CREATE_WORKHEAD_DATA",
      entityType: "BcaWorkheadData",
      entityId: workhead.id,
      newValues: workhead,
      userId: session.user.id,
      userEmail: session.user.email || "",
    })

    return NextResponse.json({ workhead }, { status: 201 })
  } catch (error) {
    console.error("[BCA Workhead Data POST]", error)
    return NextResponse.json(
      { error: "Failed to create workhead data" },
      { status: 500 }
    )
  }
}
