import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/admin/whatsapp-alerts/logs - Get notification logs with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const alertType = searchParams.get('alertType')
    const status = searchParams.get('status')
    const recipientPhone = searchParams.get('recipientPhone')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (alertType) {
      where.alertType = alertType
    }
    
    if (status) {
      where.status = status
    }
    
    if (recipientPhone) {
      where.recipientPhone = {
        contains: recipientPhone
      }
    }
    
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // Get logs and total count
    const [logs, total] = await Promise.all([
      prisma.whatsAppNotificationLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.whatsAppNotificationLog.count({ where })
    ])

    // Get statistics
    const stats = await prisma.whatsAppNotificationLog.groupBy({
      by: ['status'],
      _count: {
        id: true
      },
      where: startDate || endDate ? where : undefined
    })

    const statistics = {
      total,
      sent: stats.find(s => s.status === 'SENT')?._count.id || 0,
      failed: stats.find(s => s.status === 'FAILED')?._count.id || 0,
      queued: stats.find(s => s.status === 'QUEUED')?._count.id || 0,
      skipped: stats.find(s => s.status === 'SKIPPED')?._count.id || 0
    }

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      statistics
    })
  } catch (error) {
    console.error('[WhatsApp Notification Logs] Error fetching logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification logs' },
      { status: 500 }
    )
  }
}
