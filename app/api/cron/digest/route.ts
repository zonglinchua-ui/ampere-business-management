
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateDigestData, formatDigestHTML, shouldSendDigest } from '@/lib/digest-service'
import { createSystemLog } from '@/lib/logger'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/digest
 * Cron job to send digests to Super Admins who have it enabled
 * 
 * This should be called hourly by a cron service
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (optional security measure)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Find all Super Admins with digest enabled
    const users = await prisma.user.findMany({
      where: {
        role: 'SUPERADMIN',
        isActive: true,
      },
      include: {
        user_preferences: true,
      },
    })

    const results = {
      checked: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    }

    for (const user of users) {
      results.checked++

      const preference = user.user_preferences

      // Skip if no preference or digest not enabled
      if (!preference || !preference.digestEnabled) {
        results.skipped++
        continue
      }

      // Check if digest should be sent
      if (!shouldSendDigest(preference, now)) {
        results.skipped++
        continue
      }

      try {
        // Generate digest
        const digestData = await generateDigestData(preference.digestFrequency as 'DAILY' | 'WEEKLY' | 'MONTHLY')
        const digestHTML = formatDigestHTML(digestData)

        // TODO: Send email using your email service
        // For now, we'll just log it
        console.log(`[Digest] Would send digest to ${user.email}`)
        console.log(`[Digest] Summary: ${digestData.summary.totalLogs} logs, ${digestData.summary.criticalErrors} critical errors`)

        // Update last sent time
        await prisma.user_preferences.update({
          where: { id: preference.id },
          data: { lastDigestSent: now },
        })

        // Log the digest
        await createSystemLog({
          type: 'NOTIFICATION',
          status: 'SUCCESS',
          userId: user.id,
          username: user.name || user.email || 'Unknown',
          role: user.role,
          action: 'SEND_DIGEST',
          message: `Sent ${preference.digestFrequency.toLowerCase()} digest: ${digestData.summary.totalLogs} logs, ${digestData.summary.criticalErrors} critical errors`,
          module: 'System Logs',
        })

        results.sent++
      } catch (error: any) {
        console.error(`[Digest] Failed to send digest to ${user.email}:`, error)
        results.failed++

        // Log the failure
        await createSystemLog({
          type: 'ERROR',
          status: 'FAILED',
          userId: user.id,
          username: user.name || user.email || 'Unknown',
          role: user.role,
          action: 'SEND_DIGEST',
          message: `Failed to send digest: ${error.message}`,
          module: 'System Logs',
          errorCode: 'DIGEST_SEND_ERROR',
        })
      }
    }

    return NextResponse.json({
      message: 'Digest cron job completed',
      timestamp: now.toISOString(),
      results,
    })
  } catch (error: any) {
    console.error('[Cron] Digest job failed:', error)
    return NextResponse.json(
      { error: 'Digest cron job failed', details: error.message },
      { status: 500 }
    )
  }
}
