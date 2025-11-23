
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/logs/preferences
 * Get user's digest preferences
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can manage preferences
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    // Get or create preferences
    let preferences = await prisma.user_preferences.findUnique({
      where: { userId: session.user.id },
    })

    if (!preferences) {
      preferences = await prisma.user_preferences.create({
        data: {
          userId: session.user.id,
          digestEnabled: false,
          digestFrequency: 'WEEKLY',
          digestTime: '09:00',
          digestDays: ['Monday'],
        } as any,
      })
    }

    return NextResponse.json(preferences)
  } catch (error: any) {
    console.error('[API] Failed to fetch preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/logs/preferences
 * Update user's digest preferences
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can manage preferences
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const data = await req.json()

    // Validate digest frequency
    if (data.digestFrequency && !['DAILY', 'WEEKLY', 'MONTHLY'].includes(data.digestFrequency)) {
      return NextResponse.json(
        { error: 'Invalid digest frequency' },
        { status: 400 }
      )
    }

    // Validate digest time format (HH:MM)
    if (data.digestTime && !/^\d{2}:\d{2}$/.test(data.digestTime)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM' },
        { status: 400 }
      )
    }

    const preferences = await prisma.user_preferences.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...data,
      },
    })

    return NextResponse.json(preferences)
  } catch (error: any) {
    console.error('[API] Failed to update preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences', details: error.message },
      { status: 500 }
    )
  }
}
