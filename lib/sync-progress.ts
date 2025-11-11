
/**
 * Sync Progress Tracking Service
 * Manages realtime sync progress for Xero integration
 */

import { EventEmitter } from 'events'

export type SyncEntity = 'customers' | 'suppliers' | 'invoices' | 'payments' | 'contacts'

export interface SyncProgress {
  entity: SyncEntity
  status: 'idle' | 'syncing' | 'completed' | 'error'
  current: number
  total: number
  percentage: number
  message?: string
  error?: string
  startedAt?: Date
  completedAt?: Date
  lastSyncAt?: Date
}

class SyncProgressManager extends EventEmitter {
  private progress: Map<string, SyncProgress> = new Map()
  private subscribers: Set<(data: SyncProgress) => void> = new Set()

  /**
   * Update sync progress for an entity
   */
  updateProgress(data: Partial<SyncProgress> & { entity: SyncEntity }) {
    const current = this.progress.get(data.entity) || {
      entity: data.entity,
      status: 'idle' as const,
      current: 0,
      total: 0,
      percentage: 0,
    }

    const updated: SyncProgress = {
      ...current,
      ...data,
      percentage: data.total && data.total > 0 
        ? Math.round((data.current! / data.total) * 100)
        : current.percentage,
    }

    this.progress.set(data.entity, updated)
    this.emit('progress', updated)
    
    // Notify all subscribers
    this.subscribers.forEach(callback => callback(updated))
  }

  /**
   * Start sync for an entity
   */
  startSync(entity: SyncEntity, total: number) {
    this.updateProgress({
      entity,
      status: 'syncing',
      current: 0,
      total,
      percentage: 0,
      startedAt: new Date(),
      message: `Syncing ${entity}...`,
    })
  }

  /**
   * Update sync progress
   */
  incrementProgress(entity: SyncEntity, current: number, message?: string) {
    const existing = this.progress.get(entity)
    if (existing) {
      this.updateProgress({
        entity,
        current,
        message: message || existing.message,
      })
    }
  }

  /**
   * Complete sync
   */
  completeSync(entity: SyncEntity, message?: string) {
    const existing = this.progress.get(entity)
    this.updateProgress({
      entity,
      status: 'completed',
      current: existing?.total || 0,
      percentage: 100,
      completedAt: new Date(),
      lastSyncAt: new Date(),
      message: message || `Sync completed`,
    })

    // Reset to idle after 3 seconds
    setTimeout(() => {
      this.updateProgress({
        entity,
        status: 'idle',
        lastSyncAt: new Date(),
      })
    }, 3000)
  }

  /**
   * Mark sync as failed
   */
  failSync(entity: SyncEntity, error: string) {
    this.updateProgress({
      entity,
      status: 'error',
      error,
      message: `Sync failed: ${error}`,
      completedAt: new Date(),
    })

    // Reset to idle after 5 seconds
    setTimeout(() => {
      this.updateProgress({
        entity,
        status: 'idle',
      })
    }, 5000)
  }

  /**
   * Get current progress for an entity
   */
  getProgress(entity: SyncEntity): SyncProgress | undefined {
    return this.progress.get(entity)
  }

  /**
   * Get all progress
   */
  getAllProgress(): SyncProgress[] {
    return Array.from(this.progress.values())
  }

  /**
   * Subscribe to progress updates
   */
  subscribe(callback: (data: SyncProgress) => void) {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Check if any sync is in progress
   */
  isSyncing(): boolean {
    return Array.from(this.progress.values()).some(p => p.status === 'syncing')
  }

  /**
   * Get overall sync status
   */
  getOverallStatus(): {
    status: 'idle' | 'syncing' | 'completed' | 'error'
    message: string
    lastSyncAt?: Date
  } {
    const allProgress = this.getAllProgress()
    
    if (allProgress.some(p => p.status === 'syncing')) {
      const syncing = allProgress.filter(p => p.status === 'syncing')
      const totalCurrent = syncing.reduce((sum, p) => sum + p.current, 0)
      const totalOverall = syncing.reduce((sum, p) => sum + p.total, 0)
      return {
        status: 'syncing',
        message: `Syncing (${totalCurrent}/${totalOverall})`,
      }
    }

    if (allProgress.some(p => p.status === 'error')) {
      return {
        status: 'error',
        message: 'Sync failed',
      }
    }

    const lastSync = allProgress
      .map(p => p.lastSyncAt)
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0]

    return {
      status: 'idle',
      message: lastSync ? `Last synced` : 'Not synced',
      lastSyncAt: lastSync,
    }
  }
}

// Singleton instance
export const syncProgressManager = new SyncProgressManager()
