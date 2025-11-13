import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { detectDuplicateContactsEnhanced, getDuplicateStatsEnhanced } from '@/lib/duplicate-contact-detector-enhanced'

/**
 * GET /api/xero/duplicate-contacts
 * Scan existing contacts for duplicates
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only SUPERADMIN and FINANCE can view duplicates
    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only SUPERADMIN and FINANCE can view duplicate contacts.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const threshold = parseFloat(searchParams.get('threshold') || '0.8')
    const statsOnly = searchParams.get('statsOnly') === 'true'

    console.log(`[Duplicate Contacts API] Scanning for duplicates with threshold ${threshold}...`)

    if (statsOnly) {
      // Return statistics only (faster)
      const stats = await getDuplicateStatsEnhanced()
      return NextResponse.json({
        success: true,
        stats,
      })
    }

    // Full scan with duplicate groups using AI-enhanced detection
    const duplicates = await detectDuplicateContactsEnhanced(threshold)

    return NextResponse.json({
      success: true,
      duplicates,
      total: duplicates.length,
      totalContacts: duplicates.reduce((sum, group) => sum + group.contacts.length, 0),
    })
  } catch (error: any) {
    console.error('[Duplicate Contacts API] Error scanning for duplicates:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to scan for duplicate contacts',
        message: error.message 
      },
      { status: 500 }
    )
  }
}

