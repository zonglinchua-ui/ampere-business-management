
'use client'

import { useState } from 'react'
import { Bell, X, AlertCircle, AlertTriangle, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLogNotifications } from '@/hooks/use-log-notifications'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export function NotificationBell() {
  const { notifications, connected, clearNotification, clearAllNotifications } = useLogNotifications()
  const [open, setOpen] = useState(false)

  const unreadCount = notifications.length

  const getIcon = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'FAILED':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <Activity className="h-4 w-4 text-blue-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'FAILED':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          {connected && (
            <span className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full border border-white" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">System Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllNotifications}
              className="h-8 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">No new notifications</p>
              <p className="text-xs text-gray-400 mt-1">
                You'll see critical errors and warnings here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {(Array.isArray(notifications) ? notifications : []).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${getStatusColor(notification.status)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getIcon(notification.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-xs font-medium text-gray-900">
                            {notification.module}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {notification.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 mb-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-2"
                      onClick={() => clearNotification(notification.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-3 border-t bg-gray-50">
            <Link href="/settings/system-logs">
              <Button variant="outline" size="sm" className="w-full">
                View All Logs
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

