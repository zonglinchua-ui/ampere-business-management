
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all active projects - we'll filter on the client side
    // This allows us to show stats about projects with/without coordinates
    const projects = await prisma.project.findMany({
      where: {
        isActive: true,
        status: {
          in: ['PLANNING', 'IN_PROGRESS'], // Only show ongoing projects
        },
      },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        progress: true,
        status: true,
        Customer: {
          select: {
            id: true,
            name: true,
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform the data to match the expected format
    const transformedProjects = projects.map((project: any) => ({
      id: project.id,
      projectNumber: project.projectNumber,
      name: project.name,
      address: project.address || undefined,
      latitude: project.latitude || undefined,
      longitude: project.longitude || undefined,
      progress: project.progress,
      status: project.status,
      customer: project.Customer ? {
        name: project.Customer.name,
      } : undefined,
      manager: project.User_Project_managerIdToUser ? {
        firstName: project.User_Project_managerIdToUser.firstName || undefined,
        lastName: project.User_Project_managerIdToUser.lastName || undefined,
        name: project.User_Project_managerIdToUser.name || undefined,
      } : undefined,
    }))

    // Filter for projects with coordinates
    const projectsWithCoordinates = transformedProjects.filter(
      p => p.latitude != null && p.longitude != null
    )

    // Count projects without coordinates but with addresses
    const projectsNeedingGeocoding = transformedProjects.filter(
      p => (p.latitude == null || p.longitude == null) && p.address
    )

    console.log(`[Project Map API] Total projects: ${transformedProjects.length}, With coordinates: ${projectsWithCoordinates.length}, Need geocoding: ${projectsNeedingGeocoding.length}`)

    return NextResponse.json({
      success: true,
      projects: transformedProjects, // Return all projects
      projectsWithCoordinates, // Projects that can be displayed on map
      count: transformedProjects.length,
      stats: {
        total: transformedProjects.length,
        withCoordinates: projectsWithCoordinates.length,
        needingGeocoding: projectsNeedingGeocoding.length,
      }
    })
  } catch (error) {
    console.error("GET /api/projects/map error:", error)
    return NextResponse.json(
      { 
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
