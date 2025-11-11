
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/logs/stream
 * Server-Sent Events endpoint for real-time log notifications
 * Only sends critical errors and important notifications
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'SUPERADMIN') {
    return new Response('Unauthorized', { status: 401 })
  }

  // Set up SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      // Poll for new critical logs every 5 seconds
      const interval = setInterval(async () => {
        try {
          // Get unviewed critical/error logs from the last 10 seconds
          const recentLogs = await prisma.system_logs.findMany({
            where: {
              viewed: false,
              createdAt: {
                gte: new Date(Date.now() - 10000), // Last 10 seconds
              },
              OR: [
                { status: 'CRITICAL' },
                { status: 'FAILED', type: 'ERROR' },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })

          if (recentLogs.length > 0) {
            for (const log of recentLogs) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`)
              )
            }
          }
        } catch (error) {
          console.error('[SSE] Error polling logs:', error)
        }
      }, 5000)

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

