
/**
 * API Route: POST /api/xero/sync/contacts-backfill
 * 
 * Initiates a complete contacts backfill from Xero in a background process
 * Returns immediately with a job ID for progress tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroContactBackfillService } from '@/lib/xero-contact-backfill-service'

// Store background jobs in global (shared across API routes in same process)
// In production, use Redis or database for multi-instance deployments
declare global {
  var xeroBackfillJobs: Map<string, any> | undefined
}

const backgroundJobs = global.xeroBackfillJobs || new Map<string, any>()
if (!global.xeroBackfillJobs) {
  global.xeroBackfillJobs = backgroundJobs
}

/**
 * POST: Start contacts backfill job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role
    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only SUPERADMIN and FINANCE can sync with Xero.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const {
      pageSize = 100,
      includeArchived = true,
      where,
      ifModifiedSince
    } = body

    // Generate job ID
    const jobId = `backfill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Initialize job tracking
    backgroundJobs.set(jobId, {
      jobId,
      status: 'starting',
      startedAt: new Date(),
      progress: null,
      error: null
    })

    // Start backfill in background (don't await)
    runBackfillJob(jobId, session.user.id, {
      pageSize,
      includeArchived,
      where,
      ifModifiedSince: ifModifiedSince ? new Date(ifModifiedSince) : undefined
    }).catch(error => {
      console.error(`❌ Background job ${jobId} failed:`, error)
      const job = backgroundJobs.get(jobId)
      if (job) {
        job.status = 'failed'
        job.error = error.message
        job.completedAt = new Date()
      }
    })

    // Return immediately with job ID
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Contacts backfill started in background',
      statusUrl: `/api/xero/sync/contacts-backfill/${jobId}`
    })

  } catch (error: any) {
    console.error('❌ Failed to start backfill job:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start backfill' },
      { status: 500 }
    )
  }
}

/**
 * GET: Get status of all jobs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobs = Array.from(backgroundJobs.values())
    return NextResponse.json({
      success: true,
      jobs
    })

  } catch (error: any) {
    console.error('❌ Failed to get job status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get job status' },
      { status: 500 }
    )
  }
}

/**
 * Background job runner
 */
async function runBackfillJob(
  jobId: string,
  userId: string,
  options: any
): Promise<void> {
  const job = backgroundJobs.get(jobId)
  if (!job) return

  try {
    job.status = 'running'
    console.log(`🚀 Starting background job ${jobId}`)

    const service = new XeroContactBackfillService(userId)
    const initialized = await service.initialize()

    if (!initialized) {
      throw new Error('Failed to initialize Xero connection')
    }

    // Run backfill with progress updates
    const result = await service.pullAllContacts(options)

    // Update job status
    job.status = result.status
    job.progress = result
    job.completedAt = new Date()
    job.error = result.status === 'failed' ? result.message : null

    console.log(`✅ Background job ${jobId} completed:`, result)

  } catch (error: any) {
    console.error(`❌ Background job ${jobId} failed:`, error)
    job.status = 'failed'
    job.error = error.message
    job.completedAt = new Date()
  }
}
