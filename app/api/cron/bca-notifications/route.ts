
/**
 * BCA Notifications Cron Job
 * Runs daily to check for expiring workheads and send notifications
 */

import { NextRequest, NextResponse } from "next/server"
import { checkAndSendExpiryNotifications } from "@/lib/bca-services/notification-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET - Run notification checks
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if provided
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    await checkAndSendExpiryNotifications()

    return NextResponse.json({
      success: true,
      message: "BCA expiry notifications checked and sent",
      timestamp: new Date().toISOString(),
    }, { status: 200 })
  } catch (error) {
    console.error("[BCA Cron Notifications]", error)
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 }
    )
  }
}
