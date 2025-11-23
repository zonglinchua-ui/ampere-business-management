
/**
 * SSE Endpoint for Real-Time Sync Progress
 * GET /api/xero/sync/progress - Subscribe to real-time progress updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { XeroSyncProgressSSE } from '@/lib/xero-sync-progress-sse'
import { syncProgressManager } from '@/lib/sync-progress'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/xero/sync/progress
 * Server-Sent Events endpoint for real-time sync progress
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!['SUPERADMIN', 'FINANCE'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Generate unique client ID
    const clientId = crypto.randomUUID()

    // Create readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Set up SSE headers
        const encoder = new TextEncoder()

        // Send initial connection message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'connected',
          message: 'Real-time progress updates connected',
          clientId,
          timestamp: new Date().toISOString()
        })}\n\n`))

        // Send current progress state
        const allProgress = syncProgressManager.getAllProgress()
        if (allProgress.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'initial_state',
            progress: allProgress,
            timestamp: new Date().toISOString()
          })}\n\n`))
        }

        // Subscribe to progress updates
        const unsubscribe = syncProgressManager.subscribe((progress) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              data: progress,
              timestamp: new Date().toISOString()
            })}\n\n`))
          } catch (error) {
            console.error('[SSE] Error sending progress:', error)
            unsubscribe()
            controller.close()
          }
        })

        // Set up heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`))
          } catch (error) {
            console.error('[SSE] Heartbeat failed:', error)
            clearInterval(heartbeat)
            unsubscribe()
            controller.close()
          }
        }, 30000) // Every 30 seconds

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          console.log(`[SSE] Client ${clientId} disconnected`)
          clearInterval(heartbeat)
          unsubscribe()
          controller.close()
        })
      }
    })

    // Return SSE response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    })

  } catch (error: any) {
    console.error('[SSE] Error setting up progress stream:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
