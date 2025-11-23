'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X, Eye, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

interface InvoiceReminderAlertProps {
  projectId: string
}

interface Notification {
  id: string
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
}

export function InvoiceReminderAlert({ projectId }: InvoiceReminderAlertProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [projectId])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/projects/check-invoice-reminders')
      if (response.ok) {
        const data = await response.json()
        // Filter notifications for this specific project
        const projectNotifications = data.notifications?.filter(
          (n: any) => n.Project.id === projectId
        ) || []
        setNotifications(projectNotifications)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
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

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/projects/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds: [notificationId],
          action: 'read'
        })
      })

      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notificationId))
        toast.success('Marked as read (will reappear on next login)')
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark as read')
    }
  }

  if (loading || notifications.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 mb-6">
      {notifications.map((notification) => {
        const metadata = notification.metadata || {}
        const unclaimedAmount = metadata.unclaimedAmount || 0
        const progress = metadata.progress || 0
        const contractValue = metadata.contractValue || 0
        const earnedValue = metadata.earnedValue || 0
        const totalClaimed = metadata.totalClaimed || 0

        return (
          <Alert key={notification.id} variant="destructive" className="bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <AlertTitle className="text-amber-800 dark:text-amber-200 font-semibold">
                Invoice Reminder: Unclaimed Progress Payment
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300 mt-2">
                <div className="space-y-2">
                  <p>{notification.message}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                    <div>
                      <div className="font-medium">Progress</div>
                      <div>{progress}%</div>
                    </div>
                    <div>
                      <div className="font-medium">Earned Value</div>
                      <div>${earnedValue.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div className="font-medium">Already Claimed</div>
                      <div>${totalClaimed.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div className="font-medium">Unclaimed Amount</div>
                      <div className="text-amber-900 dark:text-amber-100 font-bold">
                        ${unclaimedAmount.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </div>
            <div className="flex items-start gap-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMarkAsRead(notification.id)}
                title="Mark as read"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(notification.id)}
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        )
      })}
    </div>
  )
}
