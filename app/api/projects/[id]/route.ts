
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { createAuditLog } from "@/lib/api-audit-context"

const updateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").optional(),
  description: z.string().optional().nullable(),
  projectType: z.enum(["REGULAR", "MAINTENANCE"]).optional(),
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
  status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  estimatedBudget: z.number().optional().nullable(),
  contractValue: z.number().optional().nullable(),
  actualCost: z.number().optional().nullable(),
  progress: z.number().min(0).max(100).optional(),
  customerId: z.string().optional(),
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const projectData = await prisma.project.findUnique({
      where: {
        id: params.id,
        isActive: true,
      },
      include: {
        Customer: true,
        User_Project_managerIdToUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
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
        CustomerInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            issueDate: true,
            dueDate: true,
          },
        },
        LegacyInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            issueDate: true,
            dueDate: true,
          },
        },
        Document: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            size: true,
            category: true,
            createdAt: true,
            User: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
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

    if (!projectData) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Transform the data to match frontend expectations
    const project = {
      ...projectData,
      // Convert Decimal fields to numbers for JSON serialization
      contractValue: projectData.contractValue ? Number(projectData.contractValue) : null,
      estimatedBudget: projectData.estimatedBudget ? Number(projectData.estimatedBudget) : null,
      actualCost: projectData.actualCost ? Number(projectData.actualCost) : null,
      _count: {
        invoices: projectData._count.CustomerInvoice + projectData._count.LegacyInvoice,
        documents: projectData._count.Document,
      },
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = updateProjectSchema.parse(body)

    const existingProject = await prisma.project.findUnique({
      where: { id: params.id, isActive: true },
    })

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify client exists if customerId is being updated
    if (validatedData.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: validatedData.customerId, isActive: true },
      })

      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 400 })
      }
    }

    // Use client-provided coordinates if available, otherwise try server-side geocoding
    const updateData: any = {
      ...validatedData,
      startDate: validatedData.startDate ? new Date(validatedData.startDate) : validatedData.startDate,
      endDate: validatedData.endDate ? new Date(validatedData.endDate) : validatedData.endDate,
    }
    
    // Handle geocoding
    if (validatedData.latitude !== undefined && validatedData.longitude !== undefined) {
      // Client provided coordinates
      updateData.latitude = validatedData.latitude
      updateData.longitude = validatedData.longitude
      console.log("[PUT /api/projects/[id]] Using client-provided coordinates:", { latitude: validatedData.latitude, longitude: validatedData.longitude })
    } else if (validatedData.address) {
      // Try server-side geocoding
      console.log("[PUT /api/projects/[id]] No coordinates from client, attempting server-side geocoding:", validatedData.address)
      const geocodedLocation = await geocodeAddress(validatedData.address)
      if (geocodedLocation) {
        updateData.latitude = geocodedLocation.latitude
        updateData.longitude = geocodedLocation.longitude
        console.log("[PUT /api/projects/[id]] Server-side geocoding successful:", geocodedLocation)
      } else {
        console.log("[PUT /api/projects/[id]] Server-side geocoding failed or returned no results")
      }
    }

    const updatedProjectData = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
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

    // Transform the data to match frontend expectations
    const updatedProject = {
      ...updatedProjectData,
      _count: {
        invoices: updatedProjectData._count.CustomerInvoice + updatedProjectData._count.LegacyInvoice,
        documents: updatedProjectData._count.Document,
      },
    }

    return NextResponse.json(updatedProject)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("PUT /api/projects/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    
    // Allow partial updates with PATCH
    const validatedData = updateProjectSchema.partial().parse(body)

    const existingProject = await prisma.project.findUnique({
      where: { id: params.id, isActive: true },
    })

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify client exists if customerId is being updated
    if (validatedData.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: validatedData.customerId, isActive: true },
      })

      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 400 })
      }
    }

    // Automatic status management based on progress
    // If progress is manually updated, automatically update status
    if (validatedData.progress !== undefined) {
      const newProgress = validatedData.progress;
      
      // If progress is 100%, automatically set status to COMPLETED
      if (newProgress >= 100 && existingProject.status !== 'COMPLETED') {
        validatedData.status = 'COMPLETED';
        console.log(`✅ Auto-changing project status to COMPLETED (progress: ${newProgress}%)`);
      }
      // If progress > 0% and status is PLANNING, automatically set to IN_PROGRESS
      else if (newProgress > 0 && existingProject.status === 'PLANNING') {
        validatedData.status = 'IN_PROGRESS';
        console.log(`✅ Auto-changing project status to IN_PROGRESS (progress: ${newProgress}%)`);
      }
    }

    const updatedProjectData = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...validatedData,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
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
    // Create audit log for dashboard Recent Activities
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || "",
      action: "UPDATE",
      entityType: "PROJECT",
      entityId: params.id,
      entityName: updatedProjectData.name,  // Add entity name for detailed display
      oldValues: {
        name: existingProject.name,
        status: existingProject.status,
        progress: existingProject.progress
      },
      newValues: {
        name: updatedProjectData.name,
        status: updatedProjectData.status,
        progress: updatedProjectData.progress
      }
    })


    // Transform the data to match frontend expectations
    const updatedProject = {
      ...updatedProjectData,
      _count: {
        invoices: updatedProjectData._count.CustomerInvoice + updatedProjectData._count.LegacyInvoice,
        documents: updatedProjectData._count.Document,
      },
    }

    return NextResponse.json(updatedProject)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("PATCH /api/projects/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existingProject = await prisma.project.findUnique({
      where: { id: params.id, isActive: true },
    })

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Soft delete
    await prisma.project.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ message: "Project deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
