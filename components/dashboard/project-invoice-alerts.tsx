
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, X, Eye, ExternalLink, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Notification {
  id: string
  projectId: string
  message: string
  metadata?: {
    unclaimedAmount?: number
    earnedValue?: number
    totalClaimed?: number
    progress?: number
    contractValue?: number
    customerName?: string
  }
  createdAt: string
  Project: {
    id: string
    name: string
    projectNumber: string
    progress: number
    contractValue: number | null
    Customer: {
      name: string
    }
  }
}

export function ProjectInvoiceAlerts() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAndFetchNotifications()
  }, [])

  const checkAndFetchNotifications = async () => {
    try {
      setLoading(true)
      
      // First, trigger the check to create new reminders (if any)
      // This POST endpoint creates notifications if projects have unclaimed amounts
      try {
        await fetch('/api/projects/check-invoice-reminders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {
        console.error('Error creating reminders:', error)
        // Continue even if POST fails
      }
      
      // Then fetch all unread notifications
      const response = await fetch('/api/projects/check-invoice-reminders')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/projects/check-invoice-reminders')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const handleDismiss = async (notificationId: string) => {
    try {
      const response = await fetch('/api/projects/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds: [notificationId],
          action: 'dismiss'
        })
      })

      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notificationId))
        toast.success('Reminder dismissed (will reappear on next login)')
      }
    } catch (error) {
      console.error('Error dismissing notification:', error)
      toast.error('Failed to dismiss reminder')
    }
  }

  const handleDismissAll = async () => {
    try {
      const notificationIds = notifications.map(n => n.id)
      const response = await fetch('/api/projects/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds,
          action: 'dismiss'
        })
      })

      if (response.ok) {
        setNotifications([])
        toast.success('All reminders dismissed (will reappear on next login)')
      }
    } catch (error) {
      console.error('Error dismissing all notifications:', error)
      toast.error('Failed to dismiss reminders')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Invoice Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (notifications.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
              Invoice Reminders
              <Badge variant="destructive" className="ml-2">
                {notifications.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Projects with unclaimed progress payments
            </CardDescription>
          </div>
          {notifications.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissAll}
              className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
            >
              Dismiss All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.map((notification) => {
            const metadata = notification.metadata || {}
            const unclaimedAmount = metadata.unclaimedAmount || 0
            const progress = metadata.progress || 0
            const totalClaimed = metadata.totalClaimed || 0
            const earnedValue = metadata.earnedValue || 0

            return (
              <div
                key={notification.id}
                className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {notification.Project.name}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {notification.Project.projectNumber}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Customer: {notification.Project.Customer.name}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Progress</div>
                        <div className="font-semibold">{progress}%</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Earned Value</div>
                        <div className="font-semibold">
                          ${earnedValue.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Claimed</div>
                        <div className="font-semibold">
                          ${totalClaimed.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Unclaimed</div>
                        <div className="font-bold text-amber-600 dark:text-amber-400">
                          ${unclaimedAmount.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Link href={`/projects/${notification.Project.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="View project"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(notification.id)}
                      title="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
