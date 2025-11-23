

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only SUPERADMIN can run this maintenance operation
    if (!session?.user?.id || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(`Document number generation requested by ${session.user.email}`)
    
    // Document numbers are now auto-generated during document creation
    // This endpoint is kept for backwards compatibility
    return NextResponse.json({ 
      success: true, 
      message: "Document numbers are auto-generated during creation" 
    })
  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json(
      { 
        error: "Request processing failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

