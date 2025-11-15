import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/admin/whatsapp-alerts/settings/[alertType] - Get specific alert setting
export async function GET(
  request: NextRequest,
  { params }: { params: { alertType: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const setting = await prisma.whatsAppAlertSettings.findUnique({
      where: {
        alertType: params.alertType
      }
    })

    if (!setting) {
      return NextResponse.json(
        { error: 'Alert setting not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ setting })
  } catch (error) {
    console.error('[WhatsApp Alerts Settings] Error fetching setting:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert setting' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/whatsapp-alerts/settings/[alertType] - Delete alert setting
export async function DELETE(
  request: NextRequest,
  { params }: { params: { alertType: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    await prisma.whatsAppAlertSettings.delete({
      where: {
        alertType: params.alertType
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WhatsApp Alerts Settings] Error deleting setting:', error)
    return NextResponse.json(
      { error: 'Failed to delete alert setting' },
      { status: 500 }
    )
  }
}
