'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Bell, CheckCircle, XCircle, Clock, Settings, Users, FileText, TestTube } from 'lucide-react'

interface AlertSetting {
  id: string
  alertType: string
  enabled: boolean
  timingConfig: any
  recipientConfig: any
  thresholdConfig: any
  messageTemplate: string
}

interface Statistics {
  total: number
  sent: number
  failed: number
  queued: number
  skipped: number
}

export default function WhatsAppAlertsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [alertSettings, setAlertSettings] = useState<AlertSetting[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch alert settings
      const settingsRes = await fetch('/api/admin/whatsapp-alerts/settings')
      if (!settingsRes.ok) throw new Error('Failed to fetch settings')
      const settingsData = await settingsRes.json()
      setAlertSettings(settingsData.settings || [])

      // Fetch today's statistics
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const logsRes = await fetch(`/api/admin/whatsapp-alerts/logs?startDate=${today.toISOString()}&limit=1`)
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        setStatistics(logsData.statistics)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async () => {
    try {
      setInitializing(true)
      setError(null)
      
      const res = await fetch('/api/admin/whatsapp-alerts/initialize', {
        method: 'POST'
      })
      
      if (!res.ok) throw new Error('Failed to initialize alerts')
      
      const data = await res.json()
      setSuccess(`Initialized ${data.created} alert types. Skipped ${data.skipped} existing alerts.`)
      
      // Refresh data
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setInitializing(false)
    }
  }

  const handleToggleAlert = async (alertType: string, enabled: boolean) => {
    try {
      const alert = alertSettings.find(a => a.alertType === alertType)
      if (!alert) return

      const res = await fetch('/api/admin/whatsapp-alerts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...alert,
          enabled
        })
      })

      if (!res.ok) throw new Error('Failed to update alert')

      // Update local state
      setAlertSettings(prev =>
        prev.map(a => a.alertType === alertType ? { ...a, enabled } : a)
      )
      
      setSuccess(`Alert ${enabled ? 'enabled' : 'disabled'} successfully`)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getAlertDisplayName = (alertType: string) => {
    return alertType
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  const getAlertIcon = (alertType: string) => {
    if (alertType.includes('DEADLINE')) return '⏰'
    if (alertType.includes('INVOICE') || alertType.includes('PAYMENT')) return '💰'
    if (alertType.includes('PROJECT')) return '📊'
    if (alertType.includes('DOCUMENT')) return '📄'
    if (alertType.includes('PO') || alertType.includes('PURCHASE')) return '🛒'
    if (alertType.includes('QUOTATION')) return '📋'
    if (alertType.includes('BUDGET')) return '⚠️'
    return '🔔'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Alerts Settings</h1>
          <p className="text-muted-foreground">Configure and manage WhatsApp notification alerts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/settings/whatsapp-alerts/logs')}>
            <FileText className="h-4 w-4 mr-2" />
            View Logs
          </Button>
          <Button variant="outline" onClick={() => router.push('/settings/whatsapp-alerts/global')}>
            <Settings className="h-4 w-4 mr-2" />
            Global Settings
          </Button>
          <Button variant="outline" onClick={() => router.push('/settings/whatsapp-alerts/recipients')}>
            <Users className="h-4 w-4 mr-2" />
            Role Recipients
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Today</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistics.sent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statistics.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Queued</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statistics.queued}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Initialize Button */}
      {alertSettings.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Alert Settings Found</CardTitle>
            <CardDescription>
              Initialize default alert settings to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleInitialize} disabled={initializing}>
              {initializing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Initialize Default Alerts
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Alert Settings Grid */}
      {alertSettings.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {alertSettings.map((alert) => (
            <Card key={alert.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getAlertIcon(alert.alertType)}</span>
                    <div>
                      <CardTitle className="text-lg">
                        {getAlertDisplayName(alert.alertType)}
                      </CardTitle>
                      <Badge variant={alert.enabled ? 'default' : 'secondary'} className="mt-1">
                        {alert.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={alert.enabled}
                    onCheckedChange={(checked) => handleToggleAlert(alert.alertType, checked)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {alert.timingConfig && Object.keys(alert.timingConfig).length > 0 && (
                    <div>
                      <strong>Timing:</strong>{' '}
                      {JSON.stringify(alert.timingConfig)}
                    </div>
                  )}
                  {alert.thresholdConfig && Object.keys(alert.thresholdConfig).length > 0 && (
                    <div>
                      <strong>Threshold:</strong>{' '}
                      {JSON.stringify(alert.thresholdConfig)}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/settings/whatsapp-alerts/${alert.alertType}`)}
                    className="flex-1"
                  >
                    Configure
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/settings/whatsapp-alerts/test?type=${alert.alertType}`)}
                  >
                    <TestTube className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
