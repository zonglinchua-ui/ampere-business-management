
import { ImprovedXeroService } from './xero-service-improved'
import { prisma } from './db'
import { proactivelyRefreshXeroTokens } from './xero-token-refresh-service'

export interface SyncSchedule {
  id: string
  syncType: 'contacts' | 'invoices' | 'payments' | 'transactions' | 'full'
  direction: 'to_xero' | 'from_xero' | 'bidirectional'
  frequency: 'hourly' | 'daily' | 'weekly'
  isActive: boolean
  lastRun?: Date
  nextRun?: Date
}

export class XeroBackgroundSync {
  private static instance: XeroBackgroundSync
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map()

  private constructor() {}

  static getInstance(): XeroBackgroundSync {
    if (!XeroBackgroundSync.instance) {
      XeroBackgroundSync.instance = new XeroBackgroundSync()
    }
    return XeroBackgroundSync.instance
  }

  // Initialize background sync on server startup
  async initializeSchedules() {
    try {
      console.log('Initializing Xero background sync schedules...')
      
      // Check if we have any active schedules in the database
      const schedules = await this.getActiveSchedules()
      
      if (schedules.length === 0) {
        console.log('No active sync schedules found')
        return
      }

      for (const schedule of schedules) {
        await this.scheduleSync(schedule)
      }

      console.log(`Initialized ${schedules.length} sync schedules`)
    } catch (error) {
      console.error('Failed to initialize sync schedules:', error)
    }
  }

  // Schedule a sync operation
  async scheduleSync(schedule: SyncSchedule) {
    // Clear existing schedule if any
    if (this.syncIntervals.has(schedule.id)) {
      clearInterval(this.syncIntervals.get(schedule.id)!)
      this.syncIntervals.delete(schedule.id)
    }

    if (!schedule.isActive) {
      console.log(`Sync schedule ${schedule.id} is inactive`)
      return
    }

    const intervalMs = this.getIntervalMs(schedule.frequency)
    
    const interval = setInterval(async () => {
      await this.executeSyncSchedule(schedule)
    }, intervalMs)

    this.syncIntervals.set(schedule.id, interval)
    
    console.log(`Scheduled ${schedule.syncType} sync every ${schedule.frequency} (${intervalMs}ms)`)
  }

  // Execute a scheduled sync
  private async executeSyncSchedule(schedule: SyncSchedule) {
    try {
      console.log(`Executing scheduled sync: ${schedule.syncType} (${schedule.direction})`)
      
      // Proactively refresh tokens before sync to ensure they're fresh
      console.log('🔄 Proactively refreshing Xero tokens before sync...')
      await proactivelyRefreshXeroTokens()
      
      // Get stored tokens (now refreshed if needed)
      const tokens = await ImprovedXeroService.getStoredTokens()
      if (!tokens) {
        console.error('No Xero tokens found for scheduled sync')
        return
      }

      const xeroService = new ImprovedXeroService(tokens)

      // Note: Background sync currently only supports contacts sync
      // Direction-based sync not yet fully implemented
      let result
      if (schedule.syncType === 'full' || (schedule.syncType as string) === 'contacts' || (schedule.syncType as string) === 'all') {
        result = await xeroService.syncContacts()
      } else {
        result = { 
          success: false, 
          message: `Background sync for ${schedule.syncType} not yet implemented. Only contacts sync is currently supported.` 
        }
      }

      // Update schedule last run time
      await this.updateScheduleLastRun(schedule.id, result)
      
      if (result.success) {
        console.log(`Scheduled sync completed successfully: ${result.message}`)
      } else {
        console.error(`Scheduled sync failed: ${result.message}`)
      }

    } catch (error: any) {
      console.error(`Scheduled sync execution failed:`, error)
      await this.updateScheduleLastRun(schedule.id, { 
        success: false, 
        message: error.message || 'Unknown error' 
      })
    }
  }

  // Get interval in milliseconds
  private getIntervalMs(frequency: string): number {
    switch (frequency) {
      case 'hourly':
        return 60 * 60 * 1000 // 1 hour
      case 'daily':
        return 24 * 60 * 60 * 1000 // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000 // 7 days
      default:
        return 24 * 60 * 60 * 1000 // Default to daily
    }
  }

  // Get active schedules from database or config
  private async getActiveSchedules(): Promise<SyncSchedule[]> {
    // For now, return default schedules - in a real implementation,
    // you would store these in the database
    const defaultSchedules: SyncSchedule[] = [
      {
        id: 'contacts-bidirectional-daily',
        syncType: 'contacts',
        direction: 'bidirectional',
        frequency: 'daily',
        isActive: false, // Disabled by default - users can enable via UI
      },
      {
        id: 'invoices-bidirectional-daily',
        syncType: 'invoices', 
        direction: 'bidirectional',
        frequency: 'daily',
        isActive: false,
      },
      {
        id: 'payments-from-xero-hourly',
        syncType: 'payments',
        direction: 'from_xero',
        frequency: 'hourly',
        isActive: false,
      }
    ]

    return defaultSchedules.filter(schedule => schedule.isActive)
  }

  // Update schedule last run time
  private async updateScheduleLastRun(scheduleId: string, result: any) {
    try {
      // In a real implementation, you would update this in the database
      console.log(`Schedule ${scheduleId} last run:`, {
        success: result.success,
        message: result.message,
        syncedCount: result.syncedCount,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to update schedule last run:', error)
    }
  }

  // Create a new sync schedule
  async createSchedule(schedule: Omit<SyncSchedule, 'id'>): Promise<string> {
    const scheduleId = `${schedule.syncType}-${schedule.direction}-${schedule.frequency}-${Date.now()}`
    
    const newSchedule: SyncSchedule = {
      id: scheduleId,
      ...schedule
    }

    await this.scheduleSync(newSchedule)
    
    return scheduleId
  }

  // Enable/disable a sync schedule
  async toggleSchedule(scheduleId: string, isActive: boolean) {
    if (isActive) {
      // Enable schedule - would need to get from database in real implementation
      console.log(`Enabling schedule ${scheduleId}`)
    } else {
      // Disable schedule
      if (this.syncIntervals.has(scheduleId)) {
        clearInterval(this.syncIntervals.get(scheduleId)!)
        this.syncIntervals.delete(scheduleId)
        console.log(`Disabled schedule ${scheduleId}`)
      }
    }
  }

  // Stop all scheduled syncs
  async stopAllSchedules() {
    for (const [scheduleId, interval] of this.syncIntervals) {
      clearInterval(interval)
      console.log(`Stopped schedule ${scheduleId}`)
    }
    
    this.syncIntervals.clear()
    console.log('All sync schedules stopped')
  }

  // Get status of all schedules
  getScheduleStatus(): any[] {
    return Array.from(this.syncIntervals.keys()).map(scheduleId => ({
      id: scheduleId,
      active: true,
      // In real implementation, would include more details from database
    }))
  }
}

// Initialize background sync on module load
if (typeof window === 'undefined') { // Server-side only
  const backgroundSync = XeroBackgroundSync.getInstance()
  
  // Initialize schedules when the module loads
  backgroundSync.initializeSchedules().catch(error => {
    console.error('Failed to initialize background sync:', error)
  })

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down background sync...')
    await backgroundSync.stopAllSchedules()
  })

  process.on('SIGINT', async () => {
    console.log('Shutting down background sync...')
    await backgroundSync.stopAllSchedules()
    process.exit(0)
  })
}

export default XeroBackgroundSync
