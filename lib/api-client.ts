
/**
 * Global API Client with Error Interception & Retry Logic
 * 
 * This module provides a unified fetch wrapper with:
 * - Automatic error logging to /api/logs
 * - Retry logic with exponential backoff
 * - Offline queue management with localStorage
 * - User context extraction from session
 */

import { getSession } from 'next-auth/react'

interface ApiClientOptions extends RequestInit {
  retries?: number
  retryDelay?: number
  skipLogging?: boolean
}

interface LogPayload {
  type: 'ERROR' | 'ACTIVITY' | 'NOTIFICATION'
  userId?: string
  username?: string
  role?: string
  action: string
  message: string
  module: string
  endpoint?: string
  errorCode?: string
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'CRITICAL'
  ipAddress?: string
  createdAt: string
}

/**
 * Save failed log to localStorage queue
 */
function savePendingLog(log: LogPayload): void {
  try {
    const queue = JSON.parse(localStorage.getItem('pendingLogs') || '[]')
    queue.push(log)
    localStorage.setItem('pendingLogs', JSON.stringify(queue))
    console.log('[API Client] Log queued for retry:', log.action)
  } catch (error) {
    console.error('[API Client] Failed to queue log:', error)
  }
}

/**
 * Remove successfully sent log from queue
 */
function removePendingLog(log: LogPayload): void {
  try {
    const queue = JSON.parse(localStorage.getItem('pendingLogs') || '[]')
    const updated = queue.filter((l: LogPayload) => l.createdAt !== log.createdAt)
    localStorage.setItem('pendingLogs', JSON.stringify(updated))
  } catch (error) {
    console.error('[API Client] Failed to remove log from queue:', error)
  }
}

/**
 * Send log with retry logic
 */
async function sendLogWithRetry(
  logPayload: LogPayload,
  retries: number = 3,
  delay: number = 2000
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload),
      })

      if (res.ok) {
        removePendingLog(logPayload)
        console.log('[API Client] Log sent successfully:', logPayload.action)
        return
      } else {
        console.warn(`[API Client] Log send attempt ${i + 1} failed with status ${res.status}`)
      }
    } catch (err) {
      console.warn(`[API Client] Log send attempt ${i + 1} failed:`, err)
    }

    // Wait before retry (exponential backoff)
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)))
    }
  }

  console.error('[API Client] All retry attempts failed, log remains in queue')
}

/**
 * Extract module name from endpoint
 */
function getModuleFromEndpoint(endpoint: string): string {
  const match = endpoint.match(/\/api\/([^\/]+)/)
  if (match) {
    const module = match[1]
    return module.charAt(0).toUpperCase() + module.slice(1)
  }
  return 'Unknown'
}

/**
 * Get user context from current session
 */
async function getUserContext(): Promise<{
  userId?: string
  username?: string
  role?: string
}> {
  try {
    const session = await getSession()
    if (session?.user) {
      return {
        userId: session.user.id,
        username: session.user.name || session.user.email || 'Unknown',
        role: session.user.role,
      }
    }
  } catch (error) {
    console.warn('[API Client] Failed to get session:', error)
  }
  return {}
}

/**
 * Enhanced fetch with error interception
 */
export async function apiClient<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const {
    retries = 3,
    retryDelay = 1000,
    skipLogging = false,
    ...fetchOptions
  } = options

  try {
    const response = await fetch(url, fetchOptions)

    // Success case
    if (response.ok) {
      return await response.json()
    }

    // Error case - log it
    if (!skipLogging) {
      const user = await getUserContext()
      const errorData = await response.json().catch(() => ({}))

      const logPayload: LogPayload = {
        type: 'ERROR',
        userId: user.userId,
        username: user.username,
        role: user.role,
        action: `${fetchOptions.method || 'GET'} ${url}`,
        message: errorData.error || errorData.message || `HTTP ${response.status} error`,
        module: getModuleFromEndpoint(url),
        endpoint: url,
        errorCode: String(response.status),
        status: response.status >= 500 ? 'CRITICAL' : 'FAILED',
        createdAt: new Date().toISOString(),
      }

      // Save to queue first (in case logging fails)
      savePendingLog(logPayload)

      // Try to send immediately
      sendLogWithRetry(logPayload, retries, retryDelay).catch(() => {
        console.warn('[API Client] Log will be retried later')
      })
    }

    // Throw error for caller to handle
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  } catch (error: any) {
    // Network or other errors
    if (!skipLogging && error.message !== 'API Error') {
      const user = await getUserContext()

      const logPayload: LogPayload = {
        type: 'ERROR',
        userId: user.userId,
        username: user.username,
        role: user.role,
        action: `${fetchOptions.method || 'GET'} ${url}`,
        message: error.message || 'Network error',
        module: getModuleFromEndpoint(url),
        endpoint: url,
        status: 'CRITICAL',
        createdAt: new Date().toISOString(),
      }

      savePendingLog(logPayload)
      sendLogWithRetry(logPayload, retries, retryDelay).catch(() => {
        console.warn('[API Client] Log will be retried later')
      })
    }

    throw error
  }
}

/**
 * Process pending logs queue when network is available
 */
export async function processPendingLogs(): Promise<void> {
  try {
    const queue = JSON.parse(localStorage.getItem('pendingLogs') || '[]')
    
    if (queue.length === 0) {
      return
    }

    console.log(`[API Client] Processing ${queue.length} pending logs...`)

    for (const log of queue) {
      await sendLogWithRetry(log, 3, 1000)
    }

    console.log('[API Client] All pending logs processed')
  } catch (error) {
    console.error('[API Client] Failed to process pending logs:', error)
  }
}

/**
 * Initialize offline queue processor
 */
export function initializeApiClient(): void {
  // Process pending logs on page load
  if (typeof window !== 'undefined') {
    processPendingLogs()

    // Process when network comes back online
    window.addEventListener('online', () => {
      console.log('[API Client] Network restored, processing pending logs...')
      processPendingLogs()
    })

    // Periodic check (every 5 minutes)
    setInterval(() => {
      processPendingLogs()
    }, 5 * 60 * 1000)
  }
}

// Convenience methods
export const api = {
  get: <T = any>(url: string, options?: ApiClientOptions) =>
    apiClient<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, data?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(data),
    }),

  put: <T = any>(url: string, data?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(data),
    }),

  patch: <T = any>(url: string, data?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(data),
    }),

  delete: <T = any>(url: string, options?: ApiClientOptions) =>
    apiClient<T>(url, { ...options, method: 'DELETE' }),
}
