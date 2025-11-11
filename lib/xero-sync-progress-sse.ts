
/**
 * Server-Sent Events (SSE) for Real-Time Sync Progress
 * Enables real-time progress updates during Xero sync operations
 */

import { syncProgressManager, SyncProgress, SyncEntity } from './sync-progress'

export class XeroSyncProgressSSE {
  private static clients: Map<string, { res: any; controller: AbortController }> = new Map()

  /**
   * Register a new SSE client for progress updates
   */
  static registerClient(clientId: string, response: any): AbortController {
    const controller = new AbortController()
    
    // Store client connection
    this.clients.set(clientId, { res: response, controller })

    // Send initial connection message
    this.sendToClient(clientId, {
      type: 'connected',
      message: 'Real-time progress updates connected',
      timestamp: new Date().toISOString()
    })

    console.log(`[SSE] Client ${clientId} connected. Total clients: ${this.clients.size}`)

    return controller
  }

  /**
   * Unregister an SSE client
   */
  static unregisterClient(clientId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      client.controller.abort()
      this.clients.delete(clientId)
      console.log(`[SSE] Client ${clientId} disconnected. Remaining clients: ${this.clients.size}`)
    }
  }

  /**
   * Send data to a specific client
   */
  static sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId)
    if (client && client.res && !client.res.writableEnded) {
      try {
        client.res.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch (error) {
        console.error(`[SSE] Failed to send to client ${clientId}:`, error)
        this.unregisterClient(clientId)
      }
    }
  }

  /**
   * Broadcast progress update to all connected clients
   */
  static broadcastProgress(progress: SyncProgress) {
    const message = {
      type: 'progress',
      data: progress,
      timestamp: new Date().toISOString()
    }

    this.clients.forEach((_, clientId) => {
      this.sendToClient(clientId, message)
    })
  }

  /**
   * Broadcast sync start event
   */
  static broadcastSyncStart(entity: SyncEntity, total: number) {
    const message = {
      type: 'sync_start',
      entity,
      total,
      timestamp: new Date().toISOString()
    }

    this.clients.forEach((_, clientId) => {
      this.sendToClient(clientId, message)
    })
  }

  /**
   * Broadcast sync complete event
   */
  static broadcastSyncComplete(entity: SyncEntity, summary: any) {
    const message = {
      type: 'sync_complete',
      entity,
      summary,
      timestamp: new Date().toISOString()
    }

    this.clients.forEach((_, clientId) => {
      this.sendToClient(clientId, message)
    })
  }

  /**
   * Broadcast sync error event
   */
  static broadcastSyncError(entity: SyncEntity, error: string) {
    const message = {
      type: 'sync_error',
      entity,
      error,
      timestamp: new Date().toISOString()
    }

    this.clients.forEach((_, clientId) => {
      this.sendToClient(clientId, message)
    })
  }

  /**
   * Get number of connected clients
   */
  static getClientCount(): number {
    return this.clients.size
  }
}

// Subscribe to sync progress manager events and broadcast to SSE clients
syncProgressManager.on('progress', (progress: SyncProgress) => {
  XeroSyncProgressSSE.broadcastProgress(progress)
})
