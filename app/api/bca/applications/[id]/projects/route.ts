
/**
 * BCA Application Projects API
 * Handles adding/removing projects from applications
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { generateFormData } from "@/lib/bca-services/form-generator"
import { logBcaAction } from "@/lib/bca-services/audit-logger"

const addProjectSchema = z.object({
  projectId: z.string().min(1),
  formType: z.enum(["D1_COMPLETED", "D2_ONGOING"]),
  remarks: z.string().optional(),
})

// POST - Add project to application
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = addProjectSchema.parse(body)

    // Check if application exists
    const application = await prisma.bcaWorkheadApplication.findUnique({
      where: { id: params.id },
      include: { ProjectForms: true },
    })

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Check if project is already added
    const existingForm = application.ProjectForms.find(
      (f: any) => f.projectId === validatedData.projectId
    )
    if (existingForm) {
      return NextResponse.json(
        { error: "Project already added to application" },
        { status: 400 }
      )
    }

    // Get project data
    const project = await prisma.project.findUnique({
      where: { id: validatedData.projectId },
      include: {
        Customer: true,
        Document: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Generate form data
    const formData = await generateFormData(validatedData.projectId)

    // Create form number
    const formCount = application.ProjectForms.length + 1
    const formNumber = `${application.applicationNumber}-${validatedData.formType === "D1_COMPLETED" ? "D1" : "D2"}-${formCount.toString().padStart(2, "0")}`

    // Create project form
    const projectForm = await prisma.bcaProjectForm.create({
      data: {
        applicationId: params.id,
        projectId: validatedData.projectId,
        formType: validatedData.formType as any,
        formNumber,
        isOngoing: validatedData.formType === "D2_ONGOING",
        contractValue: formData.projectInfo.contractSum,
        completionPercentage: formData.projectInfo.completionPercentage,
        startDate: formData.projectInfo.startDate,
        completionDate: formData.projectInfo.completionDate,
        clientName: formData.projectInfo.clientName,
        remarks: validatedData.remarks,
        generatedData: formData as any,
        status: "INCOMPLETE",
      },
      include: {
        Attachments: true,
      },
    })

    // Update application totals
    const totalContractValue = application.ProjectForms.reduce(
      (sum, f) => sum + Number(f.contractValue),
      Number(projectForm.contractValue)
    )

    await prisma.bcaWorkheadApplication.update({
      where: { id: params.id },
      data: {
        projectCount: application.ProjectForms.length + 1,
        totalContractValue,
      },
    })

    // Log the action
    await logBcaAction({
      action: "ADD_PROJECT_TO_APPLICATION",
      entityType: "BcaProjectForm",
      entityId: projectForm.id,
      newValues: { projectForm, project: project.name },
      userId: session.user.id,
      userEmail: session.user.email || "",
      applicationId: params.id,
    })

    return NextResponse.json({ projectForm }, { status: 201 })
  } catch (error) {
    console.error("[BCA Add Project]", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to add project" },
      { status: 500 }
    )
  }
}
