
import { NextRequest, NextResponse } from 'next/server'
import { XeroBackgroundSync } from '@/lib/xero-background-sync'
import { ImprovedXeroService } from '@/lib/xero-service-improved'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET - Get background sync status and schedules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only FINANCE and SUPERADMIN can manage background sync
    const canApprove = ["SUPERADMIN", "FINANCE"].includes((session.user as any).role || "")
    if (!canApprove) {
      return NextResponse.json({ 
        error: 'Access denied - insufficient permissions for background sync management' 
      }, { status: 403 })
    }

    const backgroundSync = XeroBackgroundSync.getInstance()
    const schedules = backgroundSync.getScheduleStatus()

    return NextResponse.json({
      success: true,
      message: 'Background sync status retrieved',
      schedules,
      totalActive: schedules.filter(s => s.active).length
    })

  } catch (error: any) {
    console.error('Background sync status error:', error)
    return NextResponse.json({
      success: false,
      error: `Failed to get background sync status: ${error?.message || 'Unknown error'}`
    }, { status: 500 })
  }
}

// POST - Manage background sync schedules
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const canApprove = ["SUPERADMIN", "FINANCE"].includes((session.user as any).role || "")
    if (!canApprove) {
      return NextResponse.json({ 
        success: false,
        message: 'Access denied - insufficient permissions for background sync management' 
      }, { status: 403 })
    }

    const { action, scheduleId, schedule } = await request.json()
    const backgroundSync = XeroBackgroundSync.getInstance()

    switch (action) {
      case 'create_schedule':
        if (!schedule) {
          return NextResponse.json({
            success: false,
            message: 'Schedule configuration required'
          }, { status: 400 })
        }

        const newScheduleId = await backgroundSync.createSchedule({
          syncType: schedule.syncType,
          direction: schedule.direction,
          frequency: schedule.frequency,
          isActive: schedule.isActive || false
        })

        return NextResponse.json({
          success: true,
          message: 'Background sync schedule created',
          scheduleId: newScheduleId
        })

      case 'toggle_schedule':
        if (!scheduleId) {
          return NextResponse.json({
            success: false,
            message: 'Schedule ID required'
          }, { status: 400 })
        }

        await backgroundSync.toggleSchedule(scheduleId, schedule.isActive)

        return NextResponse.json({
          success: true,
          message: `Schedule ${schedule.isActive ? 'enabled' : 'disabled'}`
        })

      case 'stop_all':
        await backgroundSync.stopAllSchedules()

        return NextResponse.json({
          success: true,
          message: 'All background sync schedules stopped'
        })

      case 'initialize':
        await backgroundSync.initializeSchedules()

        return NextResponse.json({
          success: true,
          message: 'Background sync schedules initialized'
        })

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified'
        }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Background sync management error:', error)
    return NextResponse.json({
      success: false,
      message: `Background sync operation failed: ${error?.message || 'Unknown error'}`
    }, { status: 500 })
  }
}
