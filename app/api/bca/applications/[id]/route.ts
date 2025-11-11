
/**
 * BCA Workhead Application Detail API
 * Handles individual application operations
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { logBcaAction } from "@/lib/bca-services/audit-logger"
import { BcaApplicationStatus } from "@prisma/client"

const updateApplicationSchema = z.object({
  status: z.enum(["DRAFT", "READY", "SUBMITTED", "APPROVED", "REJECTED", "EXPIRED"]).optional(),
  submissionDate: z.string().optional(),
  approvalDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
})

// GET - Get application by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const application = await prisma.bcaWorkheadApplication.findUnique({
      where: { id: params.id },
      include: {
        User_createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        User_submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        User_approvedBy: {
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
        ComplianceChecks: {
          orderBy: {
            checkedAt: "desc",
          },
        },
        ExportPackages: {
          orderBy: {
            generatedAt: "desc",
          },
        },
        AuditLogs: {
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
      },
    })

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    return NextResponse.json({ application }, { status: 200 })
  } catch (error) {
    console.error("[BCA Application GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch application" },
      { status: 500 }
    )
  }
}

// PUT - Update application
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateApplicationSchema.parse(body)

    // Get existing application
    const existingApplication = await prisma.bcaWorkheadApplication.findUnique({
      where: { id: params.id },
    })

    if (!existingApplication) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      ...validatedData,
    }

    // Handle status changes
    if (validatedData.status) {
      if (validatedData.status === "SUBMITTED" && !existingApplication.submittedById) {
        updateData.submittedById = session.user.id
        updateData.submissionDate = new Date()
      }
      if (validatedData.status === "APPROVED" && !existingApplication.approvedById) {
        updateData.approvedById = session.user.id
        updateData.approvalDate = new Date()
      }
    }

    // Update application
    const application = await prisma.bcaWorkheadApplication.update({
      where: { id: params.id },
      data: updateData,
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
      action: "UPDATE_APPLICATION",
      entityType: "BcaWorkheadApplication",
      entityId: application.id,
      oldValues: existingApplication,
      newValues: application,
      userId: session.user.id,
      userEmail: session.user.email || "",
      applicationId: application.id,
    })

    return NextResponse.json({ application }, { status: 200 })
  } catch (error) {
    console.error("[BCA Application PUT]", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update application" },
      { status: 500 }
    )
  }
}

// DELETE - Delete application
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if application exists
    const application = await prisma.bcaWorkheadApplication.findUnique({
      where: { id: params.id },
    })

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Only allow deletion of DRAFT applications
    if (application.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT applications can be deleted" },
        { status: 400 }
      )
    }

    // Delete application (cascade will handle related records)
    await prisma.bcaWorkheadApplication.delete({
      where: { id: params.id },
    })

    // Log the action
    await logBcaAction({
      action: "DELETE_APPLICATION",
      entityType: "BcaWorkheadApplication",
      entityId: params.id,
      oldValues: application,
      userId: session.user.id,
      userEmail: session.user.email || "",
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[BCA Application DELETE]", error)
    return NextResponse.json(
      { error: "Failed to delete application" },
      { status: 500 }
    )
  }
}
