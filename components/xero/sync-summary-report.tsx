
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Download,
  Eye,
  FileText
} from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface SyncSummaryData {
  entity: string
  synced: number
  updated: number
  skipped: number
  failed: number
  skippedReasons?: Array<{
    name: string
    reason: string
    timestamp: string
  }>
}

interface SyncSummaryReportProps {
  summaryData: SyncSummaryData[]
  timestamp: Date
  duration?: number
  onExport?: () => void
}

export function SyncSummaryReport({ 
  summaryData, 
  timestamp, 
  duration,
  onExport 
}: SyncSummaryReportProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<SyncSummaryData | null>(null)

  const totalSynced = summaryData.reduce((sum, item) => sum + item.synced, 0)
  const totalUpdated = summaryData.reduce((sum, item) => sum + item.updated, 0)
  const totalSkipped = summaryData.reduce((sum, item) => sum + item.skipped, 0)
  const totalFailed = summaryData.reduce((sum, item) => sum + item.failed, 0)
  const totalProcessed = totalSynced + totalUpdated + totalSkipped

  const hasErrors = totalFailed > 0
  const hasWarnings = totalSkipped > 0

  const handleExportCSV = () => {
    if (onExport) {
      onExport()
      return
    }

    // Default CSV export
    const headers = ['Entity Type', 'Synced', 'Updated', 'Skipped', 'Failed']
    const rows = summaryData.map(item => [
      item.entity,
      item.synced,
      item.updated,
      item.skipped,
      item.failed
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `xero-sync-summary-${format(timestamp, 'yyyy-MM-dd-HHmmss')}.csv`
    a.click()
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-2 shadow-lg">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasErrors ? (
                  <XCircle className="h-6 w-6 text-red-600" />
                ) : hasWarnings ? (
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
                <div>
                  <CardTitle>
                    Xero Sync Complete
                    {hasErrors && <span className="text-red-600 ml-2">- With Errors</span>}
                    {!hasErrors && hasWarnings && <span className="text-yellow-600 ml-2">- With Warnings</span>}
                  </CardTitle>
                  <CardDescription>
                    {format(timestamp, 'PPpp')}
                    {duration && ` • Duration: ${(duration / 1000).toFixed(1)}s`}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={hasErrors ? 'destructive' : hasWarnings ? 'outline' : 'default'}>
                  {totalProcessed} total
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            {/* Summary Table */}
            <div className="border rounded-lg overflow-hidden mb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity Type</TableHead>
                    <TableHead className="text-center">Synced</TableHead>
                    <TableHead className="text-center">Updated</TableHead>
                    <TableHead className="text-center">Skipped</TableHead>
                    <TableHead className="text-center">Failed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map((item) => (
                    <TableRow key={item.entity}>
                      <TableCell className="font-medium">
                        {item.entity}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {item.synced}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {item.updated}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.skipped > 0 ? (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            {item.skipped}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.failed > 0 ? (
                          <Badge variant="destructive">
                            {item.failed}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(item.skipped > 0 || item.failed > 0) && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedEntity(item)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Log
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  {item.entity} - Detailed Log
                                </DialogTitle>
                                <DialogDescription>
                                  Showing skipped and failed items for this sync operation
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                {item.skippedReasons && item.skippedReasons.length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                      Skipped Items ({item.skipped})
                                    </h4>
                                    <div className="border rounded-lg overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Time</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {item.skippedReasons.map((reason, idx) => (
                                            <TableRow key={idx}>
                                              <TableCell className="font-medium">
                                                {reason.name}
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground">
                                                {reason.reason}
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground">
                                                {format(new Date(reason.timestamp), 'HH:mm:ss')}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{totalSynced}</TableCell>
                    <TableCell className="text-center">{totalUpdated}</TableCell>
                    <TableCell className="text-center">{totalSkipped}</TableCell>
                    <TableCell className="text-center">{totalFailed}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Warning/Error Messages */}
            {hasWarnings && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-200">
                      {totalSkipped} items were skipped during sync
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Common reasons: Missing required data, invalid Xero IDs, or contacts not marked as customer/supplier.
                      Click "View Log" to inspect skipped details.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {hasErrors && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-200">
                      {totalFailed} items failed to sync
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Check the sync logs for detailed error messages and stack traces.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Sync completed at {format(timestamp, 'PPpp')}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="/finance?tab=integrations">
                    <FileText className="h-4 w-4 mr-2" />
                    View Full Logs
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
