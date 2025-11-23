import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/admin/whatsapp-alerts/global-settings - Get global settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const userRole = session.user?.role
    if (!['SUPERADMIN'].includes(userRole || '')) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    // Get or create global settings
    let settings = await prisma.whatsAppGlobalSettings.findFirst()
    
    if (!settings) {
      settings = await prisma.whatsAppGlobalSettings.create({
        data: {
          defaultCountryCode: '+65',
          maxMessagesPerHour: 100,
          testMode: false,
          enabled: true
        }
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[WhatsApp Global Settings] Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch global settings' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/whatsapp-alerts/global-settings - Update global settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const userRole = session.user?.role
    if (!['SUPERADMIN'].includes(userRole || '')) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      quietHoursStart,
      quietHoursEnd,
      defaultCountryCode,
      maxMessagesPerHour,
      testMode,
      testPhoneNumber,
      wahaApiUrl,
      wahaApiKey,
      wahaSession,
      enabled
    } = body

    // Get existing settings
    let settings = await prisma.whatsAppGlobalSettings.findFirst()
    
    if (!settings) {
      // Create if doesn't exist
      settings = await prisma.whatsAppGlobalSettings.create({
        data: {
          quietHoursStart,
          quietHoursEnd,
          defaultCountryCode: defaultCountryCode || '+65',
          maxMessagesPerHour: maxMessagesPerHour || 100,
          testMode: testMode ?? false,
          testPhoneNumber,
          wahaApiUrl,
          wahaApiKey,
          wahaSession: wahaSession || 'default',
          enabled: enabled ?? true
        }
      })
    } else {
      // Update existing
      settings = await prisma.whatsAppGlobalSettings.update({
        where: {
          id: settings.id
        },
        data: {
          quietHoursStart,
          quietHoursEnd,
          defaultCountryCode,
          maxMessagesPerHour,
          testMode,
          testPhoneNumber,
          wahaApiUrl,
          wahaApiKey,
          wahaSession,
          enabled
        }
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[WhatsApp Global Settings] Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update global settings' },
      { status: 500 }
    )
  }
}
