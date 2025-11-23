
/**
 * Simple event emitter for cross-component communication
 * Used to notify components when Xero sync completes
 */

type EventCallback = (...args: any[]) => void

class EventEmitter {
  private events: Map<string, EventCallback[]> = new Map()

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(callback)

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`Error in event callback for "${event}":`, error)
        }
      })
    }
  }

  /**
   * Clear all event listeners
   */
  clear(): void {
    this.events.clear()
  }
}

// Export singleton instance
export const eventBus = new EventEmitter()

// Event names
export const XERO_SYNC_COMPLETED = 'xero:sync:completed'
export const XERO_SYNC_STARTED = 'xero:sync:started'
export const XERO_SYNC_ERROR = 'xero:sync:error'
