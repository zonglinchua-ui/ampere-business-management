
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/bca/project-forms - Get all project forms with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get("projectId")
    const applicationId = searchParams.get("applicationId")
    const formType = searchParams.get("formType")
    const status = searchParams.get("status")

    const where: any = {}
    if (projectId) where.projectId = projectId
    if (applicationId) where.applicationId = applicationId
    if (formType) where.formType = formType
    if (status) where.status = status

    const forms = await prisma.bcaProjectForm.findMany({
      where,
      include: {
        Project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            Customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        Application: {
          select: {
            id: true,
            applicationNumber: true,
            applicationType: true,
          },
        },
        Attachments: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(forms)
  } catch (error) {
    console.error("Error fetching project forms:", error)
    return NextResponse.json(
      { error: "Failed to fetch project forms" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bca/project-forms - Create a new project form
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      applicationId,
      projectId,
      formType,
      contractValue,
      startDate,
      completionDate,
      completionPercentage,
      isOngoing,
      clientName,
      clientRepresentative,
      remarks,
    } = body

    // Validate required fields
    if (!applicationId || !projectId || !formType) {
      return NextResponse.json(
        { error: "Missing required fields: applicationId, projectId, formType" },
        { status: 400 }
      )
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        Customer: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check if application exists
    const application = await prisma.bcaWorkheadApplication.findUnique({
      where: { id: applicationId },
    })

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Generate form number
    const year = new Date().getFullYear()
    const existingForms = await prisma.bcaProjectForm.count({
      where: {
        formNumber: {
          startsWith: `BCA-${formType}-${year}`,
        },
      },
    })
    const formNumber = `BCA-${formType}-${year}-${String(existingForms + 1).padStart(4, "0")}`

    // Generate form data
    const generatedData = {
      companyInfo: {
        name: "Ampere Engineering Pte Ltd",
        uen: "201021612W",
        address: "101 Upper Cross Street #04-05, People's Park Centre Singapore 058357",
        contactPerson: "Admin",
        email: "projects@ampere.com.sg",
        phone: "+65 66778457",
      },
      projectInfo: {
        id: project.id,
        name: project.name,
        projectNumber: project.projectNumber,
        clientName: project.Customer.name,
        contractValue: contractValue || project.contractValue,
        startDate: startDate || project.startDate,
        completionDate: completionDate || project.endDate,
        status: project.status,
        completionPercentage: completionPercentage || project.progress,
      },
      workDetails: {
        workType: project.projectType === "MAINTENANCE" ? "Maintenance" : "Construction",
        discipline: "Electrical & Mechanical Engineering",
        description: project.description || "",
      },
    }

    // Create the form
    const form = await prisma.bcaProjectForm.create({
      data: {
        applicationId,
        projectId,
        formType,
        formNumber,
        contractValue: contractValue || project.contractValue || 0,
        startDate: startDate ? new Date(startDate) : project.startDate,
        completionDate: completionDate ? new Date(completionDate) : project.endDate,
        completionPercentage: completionPercentage || project.progress || 0,
        isOngoing: isOngoing ?? true,
        clientName: clientName || project.Customer.name,
        clientRepresentative: clientRepresentative || project.Customer.contactPerson,
        remarks: remarks || "",
        status: "INCOMPLETE" as any,
        generatedData,
      },
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

    return NextResponse.json(form, { status: 201 })
  } catch (error) {
    console.error("Error creating project form:", error)
    return NextResponse.json(
      { error: "Failed to create project form" },
      { status: 500 }
    )
  }
}
