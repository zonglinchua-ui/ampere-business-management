'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  SkipForward, 
  RefreshCw, 
  Users,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

interface SyncError {
  id: string
  syncType: string
  status: string
  entityName?: string
  errorMessage?: string
  createdAt: string
  attemptCount: number
}

interface DuplicateGroup {
  id: string
  contacts: Array<{
    id: string
    name: string
    email?: string
    phone?: string
    isCustomer: boolean | null
    isSupplier: boolean | null
    xeroContactId?: string
  }>
  similarityScore: number
  suggestedMerge: string
  matchReasons?: string[]
}

export function DataQualityTab() {
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([])
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [errorsRes, duplicatesRes] = await Promise.all([
        fetch('/api/xero/sync-errors'),
        fetch('/api/xero/duplicate-contacts?threshold=0.8')
      ])

      if (errorsRes.ok) {
        const errorsData = await errorsRes.json()
        setSyncErrors(errorsData.errors || [])
        setStats(errorsData.stats)
      }

      if (duplicatesRes.ok) {
        const duplicatesData = await duplicatesRes.json()
        console.log('[Data Quality] Duplicates data:', duplicatesData)
        if (duplicatesData.success && duplicatesData.duplicates) {
          setDuplicates(duplicatesData.duplicates)
        } else {
          setDuplicates([])
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data quality information')
    } finally {
      setLoading(false)
    }
  }

  const resolveError = async (errorId: string) => {
    setResolving(errorId)
    try {
      const res = await fetch('/api/xero/sync-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: errorId })
      })

      if (res.ok) {
        toast.success('Error marked as resolved')
        fetchData()
      } else {
        toast.error('Failed to resolve error')
      }
    } catch (error) {
      toast.error('Failed to resolve error')
    } finally {
      setResolving(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'SKIPPED':
        return <SkipForward className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: any = {
      SUCCESS: 'default',
      FAILED: 'destructive',
      SKIPPED: 'secondary',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Data Quality</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Monitor sync errors and detect duplicate contacts
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Errors</CardDescription>
              <CardTitle className="text-2xl">{stats.totalErrors}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unresolved</CardDescription>
              <CardTitle className="text-2xl text-red-600">{stats.unresolvedErrors}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Recent (24h)</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{stats.recentErrors}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Duplicate Groups</CardDescription>
              <CardTitle className="text-2xl text-orange-600">{duplicates.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="errors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="errors">
            <AlertCircle className="h-4 w-4 mr-2" />
            Sync Errors
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            <Users className="h-4 w-4 mr-2" />
            Duplicate Contacts
          </TabsTrigger>
        </TabsList>

        {/* Sync Errors Tab */}
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Sync Errors</CardTitle>
              <CardDescription>
                Failed and skipped sync operations from Xero
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : syncErrors.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                  <p className="text-gray-600">No sync errors found!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {syncErrors.map((error) => (
                    <div
                      key={error.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(error.status)}
                            {getStatusBadge(error.status)}
                            <Badge variant="outline">{error.syncType}</Badge>
                            {error.entityName && (
                              <span className="text-sm font-medium">{error.entityName}</span>
                            )}
                          </div>
                          {error.errorMessage && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {error.errorMessage}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Attempts: {error.attemptCount}</span>
                            <span>{new Date(error.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveError(error.id)}
                          disabled={resolving === error.id}
                        >
                          {resolving === error.id ? 'Resolving...' : 'Mark Resolved'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates">
          <Card>
            <CardHeader>
              <CardTitle>Duplicate Contacts</CardTitle>
              <CardDescription>
                Contacts with similar names that may be duplicates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : duplicates.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                  <p className="text-gray-600">No duplicate contacts found!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {duplicates.map((group) => (
                    <div
                      key={group.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          <span className="font-medium">
                            {group.contacts.length} similar contacts
                          </span>
                          <Badge variant="secondary">
                            {(group.similarityScore * 100).toFixed(0)}% match
                          </Badge>
                        </div>
                        {group.matchReasons && group.matchReasons.length > 0 && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 ml-7">
                            <span className="font-medium">Match reasons:</span> {group.matchReasons.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className={`p-3 rounded border ${
                              contact.id === group.suggestedMerge
                                ? 'bg-green-50 border-green-200 dark:bg-green-900/20'
                                : 'bg-white dark:bg-gray-900'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{contact.name}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {contact.email || 'No email'} • {contact.phone || 'No phone'}
                                </div>
                                <div className="flex gap-2 mt-1">
                                  {contact.isCustomer && (
                                    <Badge variant="outline" className="text-xs">Customer</Badge>
                                  )}
                                  {contact.isSupplier && (
                                    <Badge variant="outline" className="text-xs">Supplier</Badge>
                                  )}
                                  {contact.xeroContactId && (
                                    <Badge variant="outline" className="text-xs">Synced to Xero</Badge>
                                  )}
                                </div>
                              </div>
                              {contact.id === group.suggestedMerge && (
                                <Badge className="bg-green-600">Suggested to Keep</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

