
/**
 * API endpoint to backfill missing customer and supplier numbers
 * Only accessible by SUPERADMIN
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { backfillAllContactNumbers } from "@/lib/backfill-contact-numbers"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only SUPERADMIN can run backfill
    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    console.log(`🔄 Backfill initiated by ${session.user.email}`)
    
    const result = await backfillAllContactNumbers()

    return NextResponse.json(result, { status: result.success ? 200 : 500 })

  } catch (error: any) {
    console.error("POST /api/backfill-numbers error:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error.message
      },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
