import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { detectDuplicateContacts, getDuplicateStats } from '@/lib/duplicate-contact-detector'

// GET /api/contacts/duplicates - Detect duplicate contacts
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const threshold = parseFloat(searchParams.get('threshold') || '0.8')
    const statsOnly = searchParams.get('statsOnly') === 'true'

    if (statsOnly) {
      const stats = await getDuplicateStats()
      return NextResponse.json(stats)
    }

    const duplicates = await detectDuplicateContacts(threshold)

    return NextResponse.json({
      duplicates,
      total: duplicates.length,
      threshold,
    })
  } catch (error) {
    console.error('[Duplicates API] Error detecting duplicates:', error)
    return NextResponse.json(
      { error: 'Failed to detect duplicates' },
      { status: 500 }
    )
  }
}

