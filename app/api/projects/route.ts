
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateProjectNumber } from "@/lib/project-number"
import { z } from "zod"
import { 
  createPaginatedResponse, 
  createEmptyPaginatedResponse,
  LegacyFormats 
} from "@/lib/api-response"
import { createAuditLog } from "@/lib/api-audit-context"
import { createProjectFolders } from "@/lib/project-folder-service"

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional().nullable(),
  projectType: z.enum(["REGULAR", "MAINTENANCE"]).default("REGULAR"),
  workType: z.enum([
    "REINSTATEMENT",
    "MEP",
    "ELECTRICAL_ONLY",
    "ACMV_ONLY",
    "PLUMBING_SANITARY",
    "FIRE_PROTECTION",
    "CIVIL_STRUCTURAL",
    "INTERIOR_FITOUT",
    "EXTERNAL_WORKS",
    "GENERAL_CONSTRUCTION",
    "OTHER"
  ]).optional().nullable(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  estimatedBudget: z.number().optional().nullable(),
  contractValue: z.number().optional().nullable(),
  progress: z.number().min(0).max(100).default(0),
  customerId: z.string().min(1, "Customer is required"),
  managerId: z.string().optional().nullable(),
  salespersonId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
})

// Helper function to geocode address
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/geocode?address=${encodeURIComponent(address)}`
    )
    
    if (!response.ok) {
      console.error("[Geocoding] Failed to geocode address:", address)
      return null
    }

    const data = await response.json()
    
    if (data.latitude && data.longitude) {
      console.log("[Geocoding] Successfully geocoded address:", address, "->", data)
      return {
        latitude: data.latitude,
        longitude: data.longitude,
      }
    }

    return null
  } catch (error) {
    console.error("[Geocoding] Error geocoding address:", error)
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const projectType = searchParams.get("projectType") || ""
    const workType = searchParams.get("workType") || ""
    const customerId = searchParams.get("customerId") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const where = {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
          { Customer: { name: { contains: search, mode: "insensitive" as const } } },
          { projectNumber: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status: status as any }),
      ...(projectType && { projectType: projectType as any }),
      ...(workType && { workType: workType as any }),
      ...(customerId && { customerId }),
    }

    // Add timeout to prevent hanging queries
    const queryTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), 25000)
    )

    const dataPromise = Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              contactPerson: true,
            },
          },
          User_Project_managerIdToUser: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
          User_Project_salespersonIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              CustomerInvoice: true,
              LegacyInvoice: true,
              Document: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.project.count({ where }),
    ])

    const [projectsData, total] = await Promise.race([
      dataPromise,
      queryTimeout
    ]) as any

    // Transform the data to match frontend expectations
    const projects = (projectsData || []).map((project: any) => ({
      ...project,
      _count: {
        invoices: (project?._count?.CustomerInvoice || 0) + (project?._count?.LegacyInvoice || 0),
        documents: project?._count?.Document || 0,
      },
    }))

    // Create standardized paginated response
    const response = createPaginatedResponse(
      projects,
      { page, pageSize: limit, totalRecords: total || 0 }
    )
    
    // Convert to legacy projects format for backward compatibility
    return NextResponse.json(LegacyFormats.toProjectsFormat(response))
  } catch (error) {
    console.error("GET /api/projects error:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    
    // Return empty paginated response with 500 status to prevent .map() errors
    const emptyResponse = createEmptyPaginatedResponse(1, 10)
    return NextResponse.json(
      LegacyFormats.toProjectsFormat(emptyResponse),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    console.log("[POST /api/projects] Request body:", JSON.stringify(body, null, 2))
    
    const validatedData = createProjectSchema.parse(body)
    console.log("[POST /api/projects] Validated data:", JSON.stringify(validatedData, null, 2))

    // Verify client exists
    const customer = await prisma.customer.findUnique({
      where: { id: validatedData.customerId, isActive: true },
    })

    if (!customer) {
      console.error("[POST /api/projects] Customer not found:", validatedData.customerId)
      return NextResponse.json({ error: "Customer not found" }, { status: 400 })
    }

    // Generate project number
    const projectNumber = await generateProjectNumber(validatedData.projectType)
    console.log("[POST /api/projects] Generated project number:", projectNumber)

    // Use client-provided coordinates if available, otherwise try server-side geocoding
    let latitude = validatedData.latitude || null
    let longitude = validatedData.longitude || null
    
    // Only attempt server-side geocoding if client didn't provide coordinates
    if (!latitude && !longitude && validatedData.address) {
      console.log("[POST /api/projects] No coordinates from client, attempting server-side geocoding:", validatedData.address)
      const geocodedLocation = await geocodeAddress(validatedData.address)
      if (geocodedLocation) {
        latitude = geocodedLocation.latitude
        longitude = geocodedLocation.longitude
        console.log("[POST /api/projects] Server-side geocoding successful:", { latitude, longitude })
      } else {
        console.log("[POST /api/projects] Server-side geocoding failed or returned no results")
      }
    } else if (latitude && longitude) {
      console.log("[POST /api/projects] Using client-provided coordinates:", { latitude, longitude })
    }

    const projectData = await prisma.project.create({
      data: {
        id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: validatedData.name,
        description: validatedData.description,
        projectType: validatedData.projectType,
        workType: validatedData.workType || null,
        status: validatedData.status,
        priority: validatedData.priority,
        progress: validatedData.progress,
        projectNumber,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        estimatedBudget: validatedData.estimatedBudget,
        contractValue: validatedData.contractValue,
        customerId: validatedData.customerId,
        createdById: session.user.id,
        managerId: validatedData.managerId || session.user.id,
        salespersonId: validatedData.salespersonId || null,
        address: validatedData.address || null,
        city: validatedData.city || null,
        postalCode: validatedData.postalCode || null,
        country: validatedData.country || 'Singapore',
        latitude,
        longitude,
        updatedAt: new Date(),
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
          },
        },
        User_Project_managerIdToUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
        User_Project_salespersonIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            CustomerInvoice: true,
            LegacyInvoice: true,
            Document: true,
          },
        },
      },
    })

    console.log("[POST /api/projects] Project created successfully:", projectData.id)

    // Create NAS folder structure for the project (async, don't wait)
    createProjectFolders(projectData.projectNumber, projectData.name)
      .then(result => {
        if (result.success) {
          console.log(`[POST /api/projects] ✅ Project folders created: ${result.path}`)
        } else {
          console.warn(`[POST /api/projects] ⚠️ Project folder creation failed: ${result.error}`)
        }
      })
      .catch(error => {
        console.error('[POST /api/projects] ❌ Project folder creation error:', error)
      })

    // Create audit log for dashboard Recent Activities
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'CREATE',
      entityType: 'PROJECT',
      entityId: projectData.id,
      entityName: projectData.name,  // Add entity name for detailed display
      newValues: {
        name: projectData.name,
        projectNumber: projectData.projectNumber,
        customer: projectData.Customer?.name
      }
    })

    // Transform the data to match frontend expectations
    const project = {
      ...projectData,
      _count: {
        invoices: projectData._count.CustomerInvoice + projectData._count.LegacyInvoice,
        documents: projectData._count.Document,
      },
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[POST /api/projects] Validation error:", error.issues)
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("[POST /api/projects] Error:", error)
    console.error("[POST /api/projects] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("[POST /api/projects] Error message:", error instanceof Error ? error.message : "Unknown error")
    
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
