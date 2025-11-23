
/**
 * BCA Compliance Check API
 * Runs compliance validation for application
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { runComplianceChecks } from "@/lib/bca-services/compliance-checker"
import { logBcaAction } from "@/lib/bca-services/audit-logger"
import { prisma } from "@/lib/db"

// GET - Run compliance checks
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get application
    const application = await prisma.bcaWorkheadApplication.findUnique({
      where: { id: params.id },
    })

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Run compliance checks
    const results = await runComplianceChecks(params.id, application.workheadCode)

    // Calculate compliance score
    const totalChecks = results.length
    const passedChecks = results.filter((r: any) => r.status === "PASS").length
    const complianceScore = Math.round((passedChecks / totalChecks) * 100)

    // Update application with compliance score
    await prisma.bcaWorkheadApplication.update({
      where: { id: params.id },
      data: { complianceScore },
    })

    // Determine if ready for submission
    const hasFailures = results.some((r: any) => r.status === "FAIL")
    const isReady = !hasFailures && complianceScore >= 80

    // Log the action
    await logBcaAction({
      action: "RUN_COMPLIANCE_CHECK",
      entityType: "BcaWorkheadApplication",
      entityId: params.id,
      newValues: { complianceScore, results },
      userId: session.user.id,
      userEmail: session.user.email || "",
      applicationId: params.id,
    })

    return NextResponse.json({
      results,
      complianceScore,
      isReady,
      summary: {
        total: totalChecks,
        passed: passedChecks,
        failed: results.filter((r: any) => r.status === "FAIL").length,
        warnings: results.filter((r: any) => r.status === "WARNING").length,
      },
    }, { status: 200 })
  } catch (error) {
    console.error("[BCA Compliance Check]", error)
    return NextResponse.json(
      { error: "Failed to run compliance checks" },
      { status: 500 }
    )
  }
}
