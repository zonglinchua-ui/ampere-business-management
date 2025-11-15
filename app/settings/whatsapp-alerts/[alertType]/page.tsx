'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, ArrowLeft, CheckCircle, XCircle, TestTube, Copy } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AlertSetting {
  id?: string
  alertType: string
  enabled: boolean
  timingConfig: any
  recipientConfig: any
  thresholdConfig: any
  messageTemplate: string
}

const TEMPLATE_VARIABLES = [
  { value: '{user_name}', label: 'User Name' },
  { value: '{project_number}', label: 'Project Number' },
  { value: '{project_name}', label: 'Project Name' },
  { value: '{tender_number}', label: 'Tender Number' },
  { value: '{tender_name}', label: 'Tender Name' },
  { value: '{invoice_number}', label: 'Invoice Number' },
  { value: '{amount}', label: 'Amount' },
  { value: '{due_date}', label: 'Due Date' },
  { value: '{days_remaining}', label: 'Days Remaining' },
  { value: '{customer_name}', label: 'Customer Name' },
  { value: '{supplier_name}', label: 'Supplier Name' },
  { value: '{task_title}', label: 'Task Title' },
  { value: '{document_name}', label: 'Document Name' },
  { value: '{po_number}', label: 'PO Number' },
  { value: '{quotation_number}', label: 'Quotation Number' },
  { value: '{claim_number}', label: 'Claim Number' },
  { value: '{percentage}', label: 'Percentage' },
  { value: '{status}', label: 'Status' },
  { value: '{old_status}', label: 'Old Status' },
  { value: '{new_status}', label: 'New Status' },
]

export default function AlertConfigurationPage() {
  const router = useRouter()
  const params = useParams()
  const alertType = params.alertType as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [settings, setSettings] = useState<AlertSetting>({
    alertType,
    enabled: true,
    timingConfig: {},
    recipientConfig: {},
    thresholdConfig: {},
    messageTemplate: ''
  })

  const [daysBefore, setDaysBefore] = useState<string>('')
  const [daysAfter, setDaysAfter] = useState<string>('')

  useEffect(() => {
    fetchSettings()
  }, [alertType])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/whatsapp-alerts/settings/${alertType}`)
      
      if (res.ok) {
        const data = await res.json()
        setSettings(data.setting)
        
        // Parse timing config
        if (data.setting.timingConfig?.daysBefore) {
          setDaysBefore(data.setting.timingConfig.daysBefore.join(', '))
        }
        if (data.setting.timingConfig?.daysAfter) {
          setDaysAfter(data.setting.timingConfig.daysAfter.join(', '))
        }
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

      // Parse timing config
      const timingConfig: any = {}
      if (daysBefore) {
        timingConfig.daysBefore = daysBefore.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
      }
      if (daysAfter) {
        timingConfig.daysAfter = daysAfter.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
      }

      const res = await fetch('/api/admin/whatsapp-alerts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          timingConfig
        })
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

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('messageTemplate') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = settings.messageTemplate
      const newText = text.substring(0, start) + variable + text.substring(end)
      setSettings({ ...settings, messageTemplate: newText })
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    }
  }

  const getAlertDisplayName = (alertType: string) => {
    return alertType
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{getAlertDisplayName(alertType)}</h1>
          <p className="text-muted-foreground">Configure alert settings and message template</p>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Settings</CardTitle>
              <CardDescription>Enable or disable this alert type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Alert</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn this alert type on or off
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Timing Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Timing Configuration</CardTitle>
              <CardDescription>When to send notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="daysBefore">Days Before (comma-separated)</Label>
                <Input
                  id="daysBefore"
                  placeholder="e.g., 7, 3, 1"
                  value={daysBefore}
                  onChange={(e) => setDaysBefore(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Send notifications X days before the deadline
                </p>
              </div>

              <div>
                <Label htmlFor="daysAfter">Days After (comma-separated)</Label>
                <Input
                  id="daysAfter"
                  placeholder="e.g., 1, 3, 7"
                  value={daysAfter}
                  onChange={(e) => setDaysAfter(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Send notifications X days after the deadline (for overdue items)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recipient Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Recipient Configuration</CardTitle>
              <CardDescription>Who should receive this alert</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendToAssigned"
                  checked={settings.recipientConfig?.sendToAssigned}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      recipientConfig: { ...settings.recipientConfig, sendToAssigned: checked }
                    })
                  }
                />
                <Label htmlFor="sendToAssigned">Send to assigned user</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendToManager"
                  checked={settings.recipientConfig?.sendToManager}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      recipientConfig: { ...settings.recipientConfig, sendToManager: checked }
                    })
                  }
                />
                <Label htmlFor="sendToManager">Send to manager</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendToCustomer"
                  checked={settings.recipientConfig?.sendToCustomer}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      recipientConfig: { ...settings.recipientConfig, sendToCustomer: checked }
                    })
                  }
                />
                <Label htmlFor="sendToCustomer">Send to customer</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendToFinanceTeam"
                  checked={settings.recipientConfig?.sendToFinanceTeam}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      recipientConfig: { ...settings.recipientConfig, sendToFinanceTeam: checked }
                    })
                  }
                />
                <Label htmlFor="sendToFinanceTeam">Send to finance team</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendToSalesTeam"
                  checked={settings.recipientConfig?.sendToSalesTeam}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      recipientConfig: { ...settings.recipientConfig, sendToSalesTeam: checked }
                    })
                  }
                />
                <Label htmlFor="sendToSalesTeam">Send to sales team</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendToSuperAdmins"
                  checked={settings.recipientConfig?.sendToSuperAdmins}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      recipientConfig: { ...settings.recipientConfig, sendToSuperAdmins: checked }
                    })
                  }
                />
                <Label htmlFor="sendToSuperAdmins">Send to super admins</Label>
              </div>
            </CardContent>
          </Card>

          {/* Threshold Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Threshold Configuration</CardTitle>
              <CardDescription>Conditions for sending alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="minAmount">Minimum Amount (SGD)</Label>
                <Input
                  id="minAmount"
                  type="number"
                  placeholder="e.g., 1000"
                  value={settings.thresholdConfig?.minAmount || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      thresholdConfig: { ...settings.thresholdConfig, minAmount: parseFloat(e.target.value) || 0 }
                    })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Only send alerts for amounts above this threshold
                </p>
              </div>

              <div>
                <Label htmlFor="percentage">Percentage Threshold</Label>
                <Input
                  id="percentage"
                  type="number"
                  placeholder="e.g., 75"
                  value={settings.thresholdConfig?.percentage || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      thresholdConfig: { ...settings.thresholdConfig, percentage: parseFloat(e.target.value) || 0 }
                    })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  For budget alerts, percentage of budget used
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Message Template */}
          <Card>
            <CardHeader>
              <CardTitle>Message Template</CardTitle>
              <CardDescription>Customize the notification message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="messageTemplate">Template</Label>
                <Textarea
                  id="messageTemplate"
                  rows={10}
                  placeholder="Enter message template..."
                  value={settings.messageTemplate}
                  onChange={(e) => setSettings({ ...settings, messageTemplate: e.target.value })}
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Use variables from the list on the right. Use *text* for bold.
                </p>
              </div>

              <div className="border rounded-lg p-4 bg-muted">
                <Label className="mb-2 block">Preview</Label>
                <div className="whitespace-pre-wrap font-mono text-sm">
                  {settings.messageTemplate || 'No template yet...'}
                </div>
              </div>
            </CardContent>
          </Card>

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

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Variables</CardTitle>
              <CardDescription>Click to insert into template</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <Button
                    key={variable.value}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start font-mono text-xs"
                    onClick={() => insertVariable(variable.value)}
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    {variable.value}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Formatting Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>
                <code>*bold text*</code>
                <p className="text-muted-foreground">Makes text bold</p>
              </div>
              <div>
                <code>_italic text_</code>
                <p className="text-muted-foreground">Makes text italic</p>
              </div>
              <div>
                <code>~strikethrough~</code>
                <p className="text-muted-foreground">Strikes through text</p>
              </div>
              <div>
                <code>```code```</code>
                <p className="text-muted-foreground">Monospace text</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
