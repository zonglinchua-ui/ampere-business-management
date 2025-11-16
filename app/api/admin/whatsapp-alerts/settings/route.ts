import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/admin/whatsapp-alerts/settings - Get all alert settings
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

    const settings = await prisma.whatsAppAlertSettings.findMany({
      orderBy: {
        alertType: 'asc'
      }
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[WhatsApp Alerts Settings] Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert settings' },
      { status: 500 }
    )
  }
}

// POST /api/admin/whatsapp-alerts/settings - Create or update alert setting
export async function POST(request: NextRequest) {
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
      alertType,
      enabled,
      timingConfig,
      recipientConfig,
      thresholdConfig,
      messageTemplate
    } = body

    if (!alertType || !messageTemplate) {
      return NextResponse.json(
        { error: 'Alert type and message template are required' },
        { status: 400 }
      )
    }

    // Upsert the setting
    const setting = await prisma.whatsAppAlertSettings.upsert({
      where: {
        alertType
      },
      update: {
        enabled,
        timingConfig,
        recipientConfig,
        thresholdConfig,
        messageTemplate
      },
      create: {
        alertType,
        enabled: enabled ?? true,
        timingConfig,
        recipientConfig,
        thresholdConfig,
        messageTemplate
      }
    })

    return NextResponse.json({ setting })
  } catch (error) {
    console.error('[WhatsApp Alerts Settings] Error saving setting:', error)
    return NextResponse.json(
      { error: 'Failed to save alert setting' },
      { status: 500 }
    )
  }
}
