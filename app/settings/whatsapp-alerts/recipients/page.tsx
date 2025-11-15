'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, ArrowLeft, CheckCircle, XCircle, Plus, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RoleRecipient {
  id: string
  roleName: string
  phoneNumbers: string[]
  enabled: boolean
}

const PREDEFINED_ROLES = [
  'FINANCE_TEAM',
  'SALES_TEAM',
  'PROJECT_MANAGERS',
  'SUPER_ADMINS',
  'OPERATIONS_TEAM',
  'HR_TEAM'
]

export default function RoleRecipientsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [roleRecipients, setRoleRecipients] = useState<RoleRecipient[]>([])
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<Partial<RoleRecipient>>({
    roleName: '',
    phoneNumbers: [],
    enabled: true
  })
  const [newPhoneNumber, setNewPhoneNumber] = useState('')

  useEffect(() => {
    fetchRoleRecipients()
  }, [])

  const fetchRoleRecipients = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/whatsapp-alerts/role-recipients')
      
      if (res.ok) {
        const data = await res.json()
        setRoleRecipients(data.roleRecipients || [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRole = async (role: Partial<RoleRecipient>) => {
    try {
      setSaving(true)
      setError(null)

      if (!role.roleName || !role.phoneNumbers || role.phoneNumbers.length === 0) {
        setError('Role name and at least one phone number are required')
        return
      }

      const res = await fetch('/api/admin/whatsapp-alerts/role-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save role recipients')
      }

      setSuccess('Role recipients saved successfully')
      setEditingRole(null)
      setNewRole({ roleName: '', phoneNumbers: [], enabled: true })
      setNewPhoneNumber('')
      
      // Refresh data
      await fetchRoleRecipients()
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddPhoneNumber = (role: Partial<RoleRecipient>, phoneNumber: string) => {
    if (!phoneNumber) return

    // Validate phone number format
    const phoneRegex = /^\+\d{1,4}\d{6,14}$/
    if (!phoneRegex.test(phoneNumber)) {
      setError('Invalid phone number format. Must include country code (e.g., +6591234567)')
      return
    }

    const updatedNumbers = [...(role.phoneNumbers || []), phoneNumber]
    
    if (role.id) {
      // Update existing role
      const updatedRole = { ...role, phoneNumbers: updatedNumbers }
      handleSaveRole(updatedRole)
    } else {
      // Update new role
      setNewRole({ ...role, phoneNumbers: updatedNumbers })
      setNewPhoneNumber('')
    }
  }

  const handleRemovePhoneNumber = (role: Partial<RoleRecipient>, phoneNumber: string) => {
    const updatedNumbers = (role.phoneNumbers || []).filter(num => num !== phoneNumber)
    
    if (role.id) {
      // Update existing role
      const updatedRole = { ...role, phoneNumbers: updatedNumbers }
      handleSaveRole(updatedRole)
    } else {
      // Update new role
      setNewRole({ ...role, phoneNumbers: updatedNumbers })
    }
  }

  const handleToggleRole = async (role: RoleRecipient, enabled: boolean) => {
    try {
      const res = await fetch('/api/admin/whatsapp-alerts/role-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...role,
          enabled
        })
      })

      if (!res.ok) throw new Error('Failed to update role')

      // Update local state
      setRoleRecipients(prev =>
        prev.map(r => r.id === role.id ? { ...r, enabled } : r)
      )
      
      setSuccess(`Role ${enabled ? 'enabled' : 'disabled'} successfully`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    }
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
          <h1 className="text-3xl font-bold">Role Recipients</h1>
          <p className="text-muted-foreground">Manage phone numbers for role-based notifications</p>
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

      {/* Add New Role */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Role</CardTitle>
          <CardDescription>Create a new role with phone numbers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="roleName">Role Name</Label>
            <Input
              id="roleName"
              placeholder="e.g., FINANCE_TEAM"
              value={newRole.roleName || ''}
              onChange={(e) => setNewRole({ ...newRole, roleName: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Suggested: {PREDEFINED_ROLES.join(', ')}
            </p>
          </div>

          <div>
            <Label>Phone Numbers</Label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="+6591234567"
                value={newPhoneNumber}
                onChange={(e) => setNewPhoneNumber(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddPhoneNumber(newRole, newPhoneNumber)
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => handleAddPhoneNumber(newRole, newPhoneNumber)}
                disabled={!newPhoneNumber}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {newRole.phoneNumbers && newRole.phoneNumbers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {newRole.phoneNumbers.map((phone, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {phone}
                    <button
                      onClick={() => handleRemovePhoneNumber(newRole, phone)}
                      className="ml-1 hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => handleSaveRole(newRole)}
            disabled={saving || !newRole.roleName || !newRole.phoneNumbers || newRole.phoneNumbers.length === 0}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </CardContent>
      </Card>

      {/* Existing Roles */}
      <div className="grid gap-4 md:grid-cols-2">
        {roleRecipients.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <CardTitle className="text-lg">{role.roleName}</CardTitle>
                </div>
                <Switch
                  checked={role.enabled}
                  onCheckedChange={(checked) => handleToggleRole(role, checked)}
                />
              </div>
              <Badge variant={role.enabled ? 'default' : 'secondary'}>
                {role.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Phone Numbers ({role.phoneNumbers.length})</Label>
                <div className="space-y-2">
                  {role.phoneNumbers.map((phone, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="font-mono text-sm">{phone}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePhoneNumber(role, phone)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {editingRole === role.id ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="+6591234567"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddPhoneNumber(role, newPhoneNumber)
                        setNewPhoneNumber('')
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleAddPhoneNumber(role, newPhoneNumber)
                      setNewPhoneNumber('')
                    }}
                    disabled={!newPhoneNumber}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingRole(null)
                      setNewPhoneNumber('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingRole(role.id)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Phone Number
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {roleRecipients.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No role recipients configured yet</p>
            <p className="text-sm text-muted-foreground">Add your first role above to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
