
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateDigestData, formatDigestHTML, formatDigestText } from '@/lib/digest-service'

/**
 * POST /api/logs/digest
 * Generate and optionally send a digest preview (Super Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can generate digests
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const { frequency = 'WEEKLY', format = 'html' } = await req.json()

    // Validate frequency
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be DAILY, WEEKLY, or MONTHLY' },
        { status: 400 }
      )
    }

    // Generate digest data
    const digestData = await generateDigestData(frequency)

    // Format based on requested format
    const content = format === 'html' 
      ? formatDigestHTML(digestData)
      : formatDigestText(digestData)

    return NextResponse.json({
      data: digestData,
      content,
      format,
    })
  } catch (error: any) {
    console.error('[API] Failed to generate digest:', error)
    return NextResponse.json(
      { error: 'Failed to generate digest', details: error.message },
      { status: 500 }
    )
  }
}
