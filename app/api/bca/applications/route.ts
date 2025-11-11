
/**
 * BCA Workhead Applications API
 * Handles CRUD operations for BCA workhead applications
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { generateApplicationNumber } from "@/lib/bca-services/application-generator"
import { logBcaAction } from "@/lib/bca-services/audit-logger"
import { BcaApplicationType, BcaApplicationStatus } from "@prisma/client"

// Validation schema
const createApplicationSchema = z.object({
  workheadCode: z.string().min(1),
  workheadName: z.string().min(1),
  applicationType: z.enum(["NEW", "RENEWAL", "UPGRADE"]),
  notes: z.string().optional(),
})

// GET - List all applications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only SUPERADMIN can access
    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const applications = await prisma.bcaWorkheadApplication.findMany({
      where: status ? { status: status as BcaApplicationStatus } : {},
      include: {
        User_createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ProjectForms: {
          include: {
            Attachments: true,
          },
        },
        ComplianceChecks: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ applications }, { status: 200 })
  } catch (error) {
    console.error("[BCA Applications GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    )
  }
}

// POST - Create new application
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only SUPERADMIN can create
    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createApplicationSchema.parse(body)

    // Generate application number
    const applicationNumber = await generateApplicationNumber(
      validatedData.applicationType as BcaApplicationType
    )

    // Create application
    const application = await prisma.bcaWorkheadApplication.create({
      data: {
        applicationNumber,
        workheadCode: validatedData.workheadCode,
        workheadName: validatedData.workheadName,
        applicationType: validatedData.applicationType as BcaApplicationType,
        totalContractValue: 0,
        projectCount: 0,
        notes: validatedData.notes,
        createdById: session.user.id,
      },
      include: {
        User_createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Log the action
    await logBcaAction({
      action: "CREATE_APPLICATION",
      entityType: "BcaWorkheadApplication",
      entityId: application.id,
      newValues: application,
      userId: session.user.id,
      userEmail: session.user.email || "",
      applicationId: application.id,
    })

    return NextResponse.json({ application }, { status: 201 })
  } catch (error) {
    console.error("[BCA Applications POST]", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    )
  }
}
