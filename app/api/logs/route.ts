
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createSystemLog, getIpAddress } from '@/lib/logger'
import crypto from 'crypto'

/**
 * GET /api/logs
 * Fetch system logs with filters (Super Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can view logs
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    
    // Parse filters
    const type = searchParams.get('type') as 'ERROR' | 'ACTIVITY' | 'NOTIFICATION' | null
    const status = searchParams.get('status') as 'SUCCESS' | 'FAILED' | 'WARNING' | 'CRITICAL' | null
    const module = searchParams.get('module')
    const userId = searchParams.get('userId')
    const keyword = searchParams.get('keyword')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const viewed = searchParams.get('viewed')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {
      archived: false, // Exclude archived logs by default
    }

    if (type) where.type = type
    if (status) where.status = status
    if (module) where.module = module
    if (userId) where.userId = userId
    if (viewed !== null && viewed !== undefined) where.viewed = viewed === 'true'

    if (keyword) {
      where.OR = [
        { message: { contains: keyword, mode: 'insensitive' } },
        { action: { contains: keyword, mode: 'insensitive' } },
        { errorCode: { contains: keyword, mode: 'insensitive' } },
        { username: { contains: keyword, mode: 'insensitive' } },
      ]
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.system_logs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.system_logs.count({ where }),
    ])

    // Get unviewed critical/error count
    const unviewedCritical = await prisma.system_logs.count({
      where: {
        viewed: false,
        OR: [
          { status: 'CRITICAL' },
          { status: 'FAILED', type: 'ERROR' },
        ],
      },
    })

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      unviewedCritical,
    })
  } catch (error: any) {
    console.error('[API] Failed to fetch logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logs', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/logs
 * Create a new system log
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    
    // Validate required fields
    if (!data.type || !data.action || !data.message || !data.module || !data.status) {
      console.error('[API] Missing required fields for log creation:', data)
      return NextResponse.json(
        { error: 'Missing required fields: type, action, message, module, status' },
        { status: 400 }
      )
    }

    const ipAddress = getIpAddress(req)

    const log = await prisma.system_logs.create({
      data: {
        id: data.id || crypto.randomUUID(),
        type: data.type,
        userId: data.userId || null,
        username: data.username || null,
        role: data.role || null,
        action: data.action,
        message: data.message,
        module: data.module,
        endpoint: data.endpoint || null,
        errorCode: data.errorCode || null,
        status: data.status,
        ipAddress: ipAddress || data.ipAddress || null,
        viewed: false,
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error: any) {
    console.error('[API] Failed to create log:', error)
    console.error('[API] Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to create log', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/logs
 * Clear logs (Super Admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can clear logs
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const olderThan = searchParams.get('olderThan') // ISO date string

    const where: any = {}
    if (olderThan) {
      where.createdAt = { lt: new Date(olderThan) }
    }

    const deleted = await prisma.system_logs.deleteMany({ where })

    // Log this action
    await createSystemLog({
      type: 'ACTIVITY',
      status: 'SUCCESS',
      userId: session.user.id,
      username: session.user.name || session.user.email || 'Unknown',
      role: session.user.role,
      action: 'CLEAR_LOGS',
      message: `Cleared ${deleted.count} log entries${olderThan ? ` older than ${olderThan}` : ''}`,
      module: 'System Logs',
      ipAddress: getIpAddress(req) || undefined,
    })

    return NextResponse.json({ 
      message: `Successfully cleared ${deleted.count} log entries`,
      count: deleted.count 
    })
  } catch (error: any) {
    console.error('[API] Failed to clear logs:', error)
    return NextResponse.json(
      { error: 'Failed to clear logs', details: error.message },
      { status: 500 }
    )
  }
}

