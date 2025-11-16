'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, ArrowLeft, CheckCircle, XCircle, TestTube2 } from 'lucide-react'

interface GlobalSettings {
  id?: string
  quietHoursStart: string | null
  quietHoursEnd: string | null
  defaultCountryCode: string
  maxMessagesPerHour: number
  testMode: boolean
  testPhoneNumber: string | null
  wahaApiUrl: string | null
  wahaApiKey: string | null
  wahaSession: string
  enabled: boolean
}

export default function GlobalSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [settings, setSettings] = useState<GlobalSettings>({
    quietHoursStart: null,
    quietHoursEnd: null,
    defaultCountryCode: '+65',
    maxMessagesPerHour: 100,
    testMode: false,
    testPhoneNumber: null,
    wahaApiUrl: null,
    wahaApiKey: null,
    wahaSession: 'default',
    enabled: true
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/whatsapp-alerts/global-settings')
      
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch('/api/admin/whatsapp-alerts/global-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!res.ok) throw new Error('Failed to save settings')

      setSuccess('Settings saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      setError(null)

      if (!settings.testPhoneNumber) {
        setError('Please enter a test phone number')
        return
      }

      const res = await fetch('/api/admin/whatsapp-alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: settings.testPhoneNumber,
          message: '🧪 Test notification from Ampere Business Management System.\n\nIf you received this message, WhatsApp notifications are working correctly!',
          alertType: 'TEST'
        })
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Test notification sent successfully!')
      } else {
        setError(data.error || 'Failed to send test notification')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Global WhatsApp Settings</h1>
          <p className="text-muted-foreground">Configure system-wide WhatsApp notification settings</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* WAHA Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>WAHA Connection</CardTitle>
            <CardDescription>Configure connection to WAHA WhatsApp API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="wahaApiUrl">WAHA API URL</Label>
              <Input
                id="wahaApiUrl"
                placeholder="http://localhost:3001"
                value={settings.wahaApiUrl || ''}
                onChange={(e) => setSettings({ ...settings, wahaApiUrl: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                URL of your WAHA server
              </p>
            </div>

            <div>
              <Label htmlFor="wahaApiKey">WAHA API Key</Label>
              <Input
                id="wahaApiKey"
                type="password"
                placeholder="Enter API key"
                value={settings.wahaApiKey || ''}
                onChange={(e) => setSettings({ ...settings, wahaApiKey: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                API key for authentication (if required)
              </p>
            </div>

            <div>
              <Label htmlFor="wahaSession">WAHA Session Name</Label>
              <Input
                id="wahaSession"
                placeholder="default"
                value={settings.wahaSession}
                onChange={(e) => setSettings({ ...settings, wahaSession: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Session name in WAHA
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Enable WhatsApp Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Master switch for all WhatsApp notifications
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Configure general notification behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="defaultCountryCode">Default Country Code</Label>
              <Input
                id="defaultCountryCode"
                placeholder="+65"
                value={settings.defaultCountryCode}
                onChange={(e) => setSettings({ ...settings, defaultCountryCode: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Default country code for phone numbers
              </p>
            </div>

            <div>
              <Label htmlFor="maxMessagesPerHour">Max Messages Per Hour</Label>
              <Input
                id="maxMessagesPerHour"
                type="number"
                placeholder="100"
                value={settings.maxMessagesPerHour}
                onChange={(e) => setSettings({ ...settings, maxMessagesPerHour: parseInt(e.target.value) || 100 })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Rate limit to prevent spam
              </p>
            </div>

            <div>
              <Label htmlFor="quietHoursStart">Quiet Hours Start</Label>
              <Input
                id="quietHoursStart"
                type="time"
                value={settings.quietHoursStart || ''}
                onChange={(e) => setSettings({ ...settings, quietHoursStart: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Don't send notifications after this time
              </p>
            </div>

            <div>
              <Label htmlFor="quietHoursEnd">Quiet Hours End</Label>
              <Input
                id="quietHoursEnd"
                type="time"
                value={settings.quietHoursEnd || ''}
                onChange={(e) => setSettings({ ...settings, quietHoursEnd: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Resume sending notifications after this time
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test Mode Settings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Test Mode</CardTitle>
            <CardDescription>Test notifications before enabling for all users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Test Mode</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, all notifications will only be sent to the test phone number
                </p>
              </div>
              <Switch
                checked={settings.testMode}
                onCheckedChange={(checked) => setSettings({ ...settings, testMode: checked })}
              />
            </div>

            {settings.testMode && (
              <div>
                <Label htmlFor="testPhoneNumber">Test Phone Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="testPhoneNumber"
                    placeholder="+6591234567"
                    value={settings.testPhoneNumber || ''}
                    onChange={(e) => setSettings({ ...settings, testPhoneNumber: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing || !settings.testPhoneNumber}
                  >
                    {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <TestTube2 className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  All notifications will be sent to this number when test mode is enabled
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
      </div>
    </MainLayout>
  )
}
