
import { useState, useEffect } from 'react'

export interface SystemLog {
  id: string
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
  viewed: boolean
  createdAt: string
}

export interface LogFilters {
  type?: string
  status?: string
  module?: string
  userId?: string
  keyword?: string
  startDate?: string
  endDate?: string
  viewed?: boolean
  page?: number
  limit?: number
}

/**
 * Hook to manage system logs
 */
export function useSystemLogs(initialFilters: LogFilters = {}) {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  })
  const [unviewedCritical, setUnviewedCritical] = useState(0)
  const [filters, setFilters] = useState<LogFilters>(initialFilters)

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value))
        }
      })

      const response = await fetch(`/api/logs?${queryParams}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }

      const data = await response.json()
      
      setLogs(data.logs || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 0 })
      setUnviewedCritical(data.unviewedCritical || 0)
    } catch (err: any) {
      setError(err.message)
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const markAsViewed = async (logId: string) => {
    try {
      await fetch(`/api/logs/${logId}`, {
        method: 'PATCH',
      })
      
      // Update local state
      setLogs(logs.map(log => 
        log.id === logId ? { ...log, viewed: true } : log
      ))
      setUnviewedCritical(Math.max(0, unviewedCritical - 1))
    } catch (err) {
      console.error('Failed to mark log as viewed:', err)
    }
  }

  const clearLogs = async (olderThan?: string) => {
    try {
      const url = olderThan ? `/api/logs?olderThan=${olderThan}` : '/api/logs'
      const response = await fetch(url, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to clear logs')
      }

      await fetchLogs()
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const exportLogs = async () => {
    try {
      const queryParams = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && key !== 'page' && key !== 'limit') {
          queryParams.append(key, String(value))
        }
      })

      const response = await fetch(`/api/logs/export?${queryParams}`)
      
      if (!response.ok) {
        throw new Error('Failed to export logs')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [filters])

  return {
    logs,
    loading,
    error,
    pagination,
    unviewedCritical,
    filters,
    setFilters,
    fetchLogs,
    markAsViewed,
    clearLogs,
    exportLogs,
  }
}

