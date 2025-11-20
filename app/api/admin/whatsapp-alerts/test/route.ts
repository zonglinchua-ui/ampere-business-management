import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/whatsapp-service'
import prisma from '@/lib/db'

// POST /api/admin/whatsapp-alerts/test - Send test WhatsApp notification
export async function POST(request: NextRequest) {
  // Production guard: Disable test endpoints in production
  if (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_MODE === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    )
  }

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
    const { phoneNumber, message, alertType } = body

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      )
    }

    // Validate phone number format
    const phoneRegex = /^\+\d{1,4}\d{6,14}$/
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must include country code (e.g., +6591234567)' },
        { status: 400 }
      )
    }

    // Send test message
    const result = await sendWhatsAppMessage(phoneNumber, message)

    // Log the test notification
    await prisma.whatsAppNotificationLog.create({
      data: {
        alertType: alertType || 'TEST',
        recipientPhone: phoneNumber,
        recipientName: 'Test Recipient',
        recipientRole: 'SUPERADMIN',
        message,
        status: result.success ? 'SENT' : 'FAILED',
        errorMessage: result.error,
        sentAt: result.success ? new Date() : null,
        metadata: {
          test: true,
          sentBy: session.user.email
        }
      }
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification sent successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }
  } catch (error) {
    console.error('[WhatsApp Test] Error sending test notification:', error)
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    )
  }
}
