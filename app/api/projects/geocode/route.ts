
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * Server-side geocoding endpoint
 * Geocodes a project address and stores the result in the database
 * This avoids repeated client-side API calls
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { projectId, address } = body

    if (!projectId || !address) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, address" },
        { status: 400 }
      )
    }

    // Check if project already has coordinates
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { latitude: true, longitude: true },
    })

    if (existingProject?.latitude && existingProject?.longitude) {
      return NextResponse.json({
        success: true,
        cached: true,
        latitude: existingProject.latitude,
        longitude: existingProject.longitude,
        message: "Using existing coordinates from database",
      })
    }

    // Get Google Maps API key from server environment
    // GOOGLE_MAPS_SERVER_API_KEY should be configured with IP restrictions, not HTTP referer restrictions
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured on server" },
        { status: 500 }
      )
    }

    // Call Google Geocoding API
    const encodedAddress = encodeURIComponent(address)
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`

    const response = await fetch(geocodeUrl)
    
    if (!response.ok) {
      console.error('Geocoding API error:', response.status)
      return NextResponse.json(
        { error: "Failed to geocode address" },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (data.status === 'OVER_QUERY_LIMIT') {
      return NextResponse.json(
        { 
          error: "Google Maps API quota exceeded. Please try again later.",
          quotaExceeded: true,
        },
        { status: 429 }
      )
    }

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      const latitude = location.lat
      const longitude = location.lng

      // Store coordinates in database
      await prisma.project.update({
        where: { id: projectId },
        data: {
          latitude,
          longitude,
        },
      })

      console.log(`Geocoded and stored coordinates for project ${projectId}:`, { latitude, longitude })

      return NextResponse.json({
        success: true,
        cached: false,
        latitude,
        longitude,
        message: "Address geocoded and stored successfully",
      })
    } else {
      console.error('Geocoding failed:', data.status, data.error_message)
      return NextResponse.json(
        { 
          error: `Geocoding failed: ${data.status}`,
          details: data.error_message 
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("POST /api/projects/geocode error:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
