

'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  AlertTriangle,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  Building2,
  CreditCard,
  Users,
  Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface ConflictData {
  id: string
  entity: string
  entityId: string
  entityName: string
  conflictType: string
  localData: any
  xeroData: any
  suggestedAction: string
  status: string
  createdAt: string
  syncLog: {
    createdAt: string
    userId: string
    User?: {
      name: string
      email: string
    }
  }
}

export function XeroConflictManager() {
  const { toast } = useToast()
  const [conflicts, setConflicts] = useState<ConflictData[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<Record<string, boolean>>({})
  const [selectedConflict, setSelectedConflict] = useState<ConflictData | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)

  useEffect(() => {
    fetchConflicts()
  }, [])

  const fetchConflicts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/finance/sync/conflicts')
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch conflicts')
      }

      const data = await response.json()
      setConflicts(data.conflicts || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch conflicts",
        variant: "destructive",
      })
      setConflicts([])
    } finally {
      setLoading(false)
    }
  }

  const resolveConflict = async (conflictId: string, resolution: 'use_local' | 'use_xero' | 'manual') => {
    try {
      setResolving(prev => ({ ...prev, [conflictId]: true }))
      
      const response = await fetch('/api/finance/sync/conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conflictId, resolution }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve conflict')
      }

      const result = await response.json()
      
      toast({
        title: "Conflict Resolved",
        description: result.message,
        variant: "default",
      })

      // Refresh conflicts list
      await fetchConflicts()
      setShowDetailsDialog(false)
      setSelectedConflict(null)

    } catch (error: any) {
      toast({
        title: "Resolution Failed",
        description: error.message || "Failed to resolve conflict",
        variant: "destructive",
      })
    } finally {
      setResolving(prev => ({ ...prev, [conflictId]: false }))
    }
  }

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'client': return <Building2 className="h-4 w-4 text-blue-600" />
      case 'vendor': return <Users className="h-4 w-4 text-green-600" />
      case 'invoice':
      case 'bill': return <FileText className="h-4 w-4 text-purple-600" />
      case 'payment': return <CreditCard className="h-4 w-4 text-indigo-600" />
      default: return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getConflictTypeBadge = (type: string) => {
    const colors = {
      'DATA_MISMATCH': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'DUPLICATE_DETECTED': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'VALIDATION_ERROR': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'PERMISSION_DENIED': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'MISSING_DEPENDENCY': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    }

    return (
      <Badge variant="outline" className={colors[type as keyof typeof colors] || colors.DATA_MISMATCH}>
        {type.replace(/_/g, ' ')}
      </Badge>
    )
  }

  const showConflictDetails = (conflict: ConflictData) => {
    setSelectedConflict(conflict)
    setShowDetailsDialog(true)
  }

  const renderDataComparison = (localData: any, xeroData: any) => {
    const keys = new Set([...Object.keys(localData || {}), ...Object.keys(xeroData || {})])
    const compareKeys = Array.from(keys).filter(key => 
      !['id', 'createdAt', 'updatedAt', 'createdById'].includes(key)
    )

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Local Data (Finance)</h4>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
              {compareKeys.map(key => (
                <div key={`local-${key}`} className="flex justify-between py-1 text-sm">
                  <span className="font-medium">{key}:</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {localData?.[key]?.toString() || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Xero Data</h4>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border">
              {compareKeys.map(key => (
                <div key={`xero-${key}`} className="flex justify-between py-1 text-sm">
                  <span className="font-medium">{key}:</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {xeroData?.[key]?.toString() || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading conflicts...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-yellow-600" />
                Sync Conflicts Manager
              </CardTitle>
              <CardDescription>
                Review and resolve data conflicts between Finance module and Xero
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                {conflicts.length} Pending Conflicts
              </Badge>
              <Button variant="outline" onClick={fetchConflicts} disabled={loading}>
                <Clock className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-green-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Conflicts Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                All sync operations completed successfully without conflicts.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Conflicts require manual review before they can be resolved. 
                  Choose to keep local data, use Xero data, or mark for manual resolution.
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Conflict Type</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflicts.map((conflict) => (
                      <TableRow key={conflict.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getEntityIcon(conflict.entity)}
                            <span className="capitalize">{conflict.entity}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {conflict.entityName || conflict.entityId}
                        </TableCell>
                        <TableCell>
                          {getConflictTypeBadge(conflict.conflictType)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(conflict.createdAt), 'MMM dd, HH:mm')}
                            {conflict.syncLog?.User && (
                              <div className="flex items-center mt-1">
                                <User className="h-3 w-3 mr-1" />
                                {conflict.syncLog.User.name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => showConflictDetails(conflict)}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              Review
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conflict Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {selectedConflict && getEntityIcon(selectedConflict.entity)}
              <span className="ml-2">
                Conflict: {selectedConflict?.entityName || selectedConflict?.entityId}
              </span>
            </DialogTitle>
            <DialogDescription>
              Review the conflicting data and choose how to resolve this sync conflict.
            </DialogDescription>
          </DialogHeader>

          {selectedConflict && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p><strong>Entity Type:</strong> {selectedConflict.entity}</p>
                  <p><strong>Conflict Type:</strong> {getConflictTypeBadge(selectedConflict.conflictType)}</p>
                </div>
                <div>
                  <p><strong>Detected At:</strong> {format(new Date(selectedConflict.createdAt), 'PPpp')}</p>
                  <p><strong>Suggested Action:</strong> {selectedConflict.suggestedAction}</p>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-4">Data Comparison</h4>
                {renderDataComparison(selectedConflict.localData, selectedConflict.xeroData)}
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => selectedConflict && resolveConflict(selectedConflict.id, 'use_local')}
                disabled={resolving[selectedConflict?.id || '']}
              >
                {resolving[selectedConflict?.id || ''] ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Keep Local Data
              </Button>
              
              <Button
                variant="outline"
                onClick={() => selectedConflict && resolveConflict(selectedConflict.id, 'use_xero')}
                disabled={resolving[selectedConflict?.id || '']}
              >
                {resolving[selectedConflict?.id || ''] ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Use Xero Data
              </Button>

              <Button
                variant="outline"
                onClick={() => selectedConflict && resolveConflict(selectedConflict.id, 'manual')}
                disabled={resolving[selectedConflict?.id || '']}
              >
                {resolving[selectedConflict?.id || ''] ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Mark for Manual Review
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => setShowDetailsDialog(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

