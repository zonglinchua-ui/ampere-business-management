
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/bca/project-forms/[id] - Get a specific project form
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const form = await prisma.bcaProjectForm.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
        Application: true,
        Attachments: true,
      },
    })

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    return NextResponse.json(form)
  } catch (error) {
    console.error("Error fetching project form:", error)
    return NextResponse.json(
      { error: "Failed to fetch project form" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/bca/project-forms/[id] - Update a project form
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      status,
      contractValue,
      completionPercentage,
      startDate,
      completionDate,
      isOngoing,
      clientName,
      clientRepresentative,
      clientSignature,
      remarks,
      cloudStoragePath,
    } = body

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (contractValue !== undefined) updateData.contractValue = contractValue
    if (completionPercentage !== undefined) updateData.completionPercentage = completionPercentage
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (completionDate !== undefined) updateData.completionDate = new Date(completionDate)
    if (isOngoing !== undefined) updateData.isOngoing = isOngoing
    if (clientName !== undefined) updateData.clientName = clientName
    if (clientRepresentative !== undefined) updateData.clientRepresentative = clientRepresentative
    if (clientSignature !== undefined) updateData.clientSignature = clientSignature
    if (remarks !== undefined) updateData.remarks = remarks
    if (cloudStoragePath !== undefined) updateData.cloudStoragePath = cloudStoragePath

    const form = await prisma.bcaProjectForm.update({
      where: { id: params.id },
      data: updateData,
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
        Application: true,
        Attachments: true,
      },
    })

    return NextResponse.json(form)
  } catch (error) {
    console.error("Error updating project form:", error)
    return NextResponse.json(
      { error: "Failed to update project form" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bca/project-forms/[id] - Delete a project form
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is SUPERADMIN
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Only SUPERADMIN can delete forms" },
        { status: 403 }
      )
    }

    await prisma.bcaProjectForm.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Form deleted successfully" })
  } catch (error) {
    console.error("Error deleting project form:", error)
    return NextResponse.json(
      { error: "Failed to delete project form" },
      { status: 500 }
    )
  }
}
