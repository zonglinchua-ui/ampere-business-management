'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  Loader2,
  AlertCircle,
  Copy,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface SyncError {
  id: string
  syncType: string
  status: string
  entityId?: string
  entityName?: string
  xeroId?: string
  errorMessage?: string
  errorDetails?: any
  attemptCount: number
  lastAttemptAt: Date
  createdAt: Date
  resolvedAt?: Date | null
  resolvedBy?: string | null
  notes?: string | null
}

interface DuplicateGroup {
  id: string
  contacts: DuplicateContact[]
  similarityScore: number
  suggestedMerge: string
}

interface DuplicateContact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  isCustomer: boolean | null
  isSupplier: boolean | null
  xeroContactId?: string | null
  createdAt: Date
}

interface ErrorStats {
  totalErrors: number
  unresolvedErrors: number
  recentErrors: number
  errorsByType: Array<{
    syncType: string
    status: string
    _count: number
  }>
}

interface DuplicateStats {
  totalGroups: number
  totalDuplicates: number
  highConfidence: number
  mediumConfidence: number
  duplicates: DuplicateGroup[]
}

export function DataQualityDashboard() {
  const [loading, setLoading] = useState(false)
  const [scanningDuplicates, setScanningDuplicates] = useState(false)
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([])
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [duplicateStats, setDuplicateStats] = useState<DuplicateStats | null>(null)
  const [activeTab, setActiveTab] = useState('errors')

  // Fetch sync errors
  const fetchSyncErrors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/xero/sync-errors?limit=100')
      const data = await response.json()

      if (data.errors) {
        setSyncErrors(data.errors)
        setErrorStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch sync errors:', error)
      toast.error('Failed to load sync errors')
    } finally {
      setLoading(false)
    }
  }

  // Scan for duplicate contacts
  const scanDuplicates = async () => {
    try {
      setScanningDuplicates(true)
      toast.info('Scanning for duplicate contacts...')
      
      const response = await fetch('/api/xero/duplicate-contacts?threshold=0.8')
      const data = await response.json()

      if (data.success) {
        setDuplicates(data.duplicates || [])
        setDuplicateStats({
          totalGroups: data.total || 0,
          totalDuplicates: data.totalContacts || 0,
          highConfidence: data.duplicates?.filter((g: DuplicateGroup) => g.similarityScore >= 0.9).length || 0,
          mediumConfidence: data.duplicates?.filter((g: DuplicateGroup) => g.similarityScore >= 0.8 && g.similarityScore < 0.9).length || 0,
          duplicates: data.duplicates || [],
        })
        toast.success(`Found ${data.total || 0} duplicate groups`)
      } else {
        toast.error(data.error || 'Failed to scan for duplicates')
      }
    } catch (error) {
      console.error('Failed to scan duplicates:', error)
      toast.error('Failed to scan for duplicate contacts')
    } finally {
      setScanningDuplicates(false)
    }
  }

  // Resolve sync error
  const resolveError = async (logId: string) => {
    try {
      const response = await fetch('/api/xero/sync-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, notes: 'Resolved from Data Quality Dashboard' }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Error marked as resolved')
        fetchSyncErrors()
      } else {
        toast.error(data.error || 'Failed to resolve error')
      }
    } catch (error) {
      console.error('Failed to resolve error:', error)
      toast.error('Failed to resolve error')
    }
  }

  // Load data on mount
  useEffect(() => {
    fetchSyncErrors()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'SKIPPED':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Skipped</Badge>
      case 'SUCCESS':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getSimilarityBadge = (score: number) => {
    if (score >= 0.9) {
      return <Badge variant="destructive">High ({(score * 100).toFixed(0)}%)</Badge>
    } else if (score >= 0.8) {
      return <Badge variant="default" className="bg-orange-500">Medium ({(score * 100).toFixed(0)}%)</Badge>
    } else {
      return <Badge variant="secondary">Low ({(score * 100).toFixed(0)}%)</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Quality Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Monitor sync errors and detect duplicate contacts
          </p>
        </div>
        <Button onClick={fetchSyncErrors} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorStats?.totalErrors || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unresolved Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {errorStats?.unresolvedErrors || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Errors (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorStats?.recentErrors || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Duplicate Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {duplicateStats?.totalGroups || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="errors">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Sync Errors ({syncErrors.length})
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            <Users className="w-4 h-4 mr-2" />
            Duplicate Contacts ({duplicates.length})
          </TabsTrigger>
        </TabsList>

        {/* Sync Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Errors</CardTitle>
              <CardDescription>
                Errors encountered during Xero synchronization operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : syncErrors.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    No sync errors found. All synchronization operations completed successfully.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncErrors.map((error) => (
                      <TableRow key={error.id}>
                        <TableCell>
                          <Badge variant="outline">{error.syncType}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(error.status)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{error.entityName || 'Unknown'}</div>
                          {error.xeroId && (
                            <div className="text-xs text-muted-foreground">
                              Xero ID: {error.xeroId.substring(0, 8)}...
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate text-sm">
                            {error.errorMessage || 'No error message'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(error.createdAt), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {!error.resolvedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveError(error.id)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Duplicate Contacts Tab */}
        <TabsContent value="duplicates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Duplicate Contacts</CardTitle>
                  <CardDescription>
                    Potential duplicate contacts detected in the database
                  </CardDescription>
                </div>
                <Button onClick={scanDuplicates} disabled={scanningDuplicates}>
                  {scanningDuplicates ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Scan for Duplicates
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {duplicates.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No duplicate contacts found. Click "Scan for Duplicates" to check existing contacts.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {duplicates.map((group) => (
                    <Card key={group.id} className="border-l-4 border-l-orange-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Copy className="w-4 h-4 text-orange-500" />
                            <span className="font-medium">
                              {group.contacts.length} Potential Duplicates
                            </span>
                          </div>
                          {getSimilarityBadge(group.similarityScore)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead>Xero ID</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.contacts.map((contact) => (
                              <TableRow 
                                key={contact.id}
                                className={contact.id === group.suggestedMerge ? 'bg-green-50' : ''}
                              >
                                <TableCell className="font-medium">
                                  {contact.name}
                                  {contact.id === group.suggestedMerge && (
                                    <Badge variant="default" className="ml-2 bg-green-500">
                                      Suggested
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {contact.email || '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {contact.phone || '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    {contact.isCustomer && (
                                      <Badge variant="outline" className="text-xs">Customer</Badge>
                                    )}
                                    {contact.isSupplier && (
                                      <Badge variant="outline" className="text-xs">Supplier</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {contact.xeroContactId ? (
                                    <Badge variant="secondary" className="text-xs">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Synced
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
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

