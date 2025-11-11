
/**
 * API Route: GET /api/xero/sync/contacts-backfill/[jobId]
 * 
 * Get status and progress of a specific backfill job
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Access global job store (shared across API routes)
declare global {
  var xeroBackfillJobs: Map<string, any> | undefined
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = params.jobId

    // Get job from global store
    const backgroundJobs = global.xeroBackfillJobs
    if (!backgroundJobs) {
      return NextResponse.json(
        { error: 'No jobs found. Job store not initialized.' },
        { status: 404 }
      )
    }

    const job = backgroundJobs.get(jobId)
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      job
    })

  } catch (error: any) {
    console.error('❌ Failed to get job status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get job status' },
      { status: 500 }
    )
  }
}
