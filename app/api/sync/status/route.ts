
/**
 * SSE Endpoint for Realtime Sync Progress
 * Streams sync progress updates to connected clients
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncProgressManager } from '@/lib/sync-progress'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET handler for SSE connection
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Sync status stream connected' })}\n\n`)
      )

      // Send current progress immediately
      const allProgress = syncProgressManager.getAllProgress()
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'initial', progress: allProgress })}\n\n`)
      )

      // Subscribe to progress updates
      const unsubscribe = syncProgressManager.subscribe((progress) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'progress', progress })}\n\n`)
          )
        } catch (error) {
          console.error('Error sending SSE update:', error)
        }
      })

      // Send heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`)
          )
        } catch (error) {
          console.error('Error sending heartbeat:', error)
          clearInterval(heartbeat)
        }
      }, 30000)

      // Clean up on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch (error) {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  })
}
