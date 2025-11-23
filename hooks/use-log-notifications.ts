
import { useState, useEffect, useRef } from 'react'
import { SystemLog } from './use-system-logs'

/**
 * Hook to listen for real-time log notifications via SSE
 */
export function useLogNotifications() {
  const [notifications, setNotifications] = useState<SystemLog[]>([])
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Connect to SSE
    const eventSource = new EventSource('/api/logs/stream')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnected(true)
      console.log('[SSE] Connected to log notifications')
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'connected') {
          setConnected(true)
        } else if (data.type === 'log') {
          const log = data.data as SystemLog
          
          // Add to notifications
          setNotifications(prev => [log, ...prev].slice(0, 10))
          
          // Show browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            const title = log.status === 'CRITICAL' ? '🔴 Critical Error' : '⚠️ Error Occurred'
            const notification = new Notification(title, {
              body: `${log.module}: ${log.message.substring(0, 100)}`,
              icon: '/icon.png',
              tag: log.id,
            })

            notification.onclick = () => {
              window.focus()
              // Navigate to system logs
              window.location.href = '/settings/system-logs'
            }
          }

          // Play sound for critical errors
          if (log.status === 'CRITICAL') {
            const audio = new Audio('/notification.mp3')
            audio.play().catch(err => console.log('Audio play failed:', err))
          }
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err)
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
      console.error('[SSE] Connection error, reconnecting...')
      eventSource.close()
      
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          const newEventSource = new EventSource('/api/logs/stream')
          eventSourceRef.current = newEventSource
        }
      }, 5000)
    }

    // Cleanup
    return () => {
      eventSource.close()
    }
  }, [])

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  return {
    notifications,
    connected,
    clearNotification,
    clearAllNotifications,
  }
}

