

'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  RefreshCw, 
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  ArrowLeftRight
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SyncResult {
  success: boolean
  message: string
  totalProcessed?: number
  totalErrors?: number
  syncedCount?: number
  progress?: {
    total: number
    succeeded: number
    failed: number
    pages: number
    duration?: number
  }
  details?: {
    push?: {
      clients?: number
      vendors?: number  
      invoices?: number
    }
    pull?: {
      contacts?: number
      invoices?: number
      payments?: number
    }
    contacts?: {
      total: number
      succeeded: number
      failed: number
      pages: number
    }
    invoices?: {
      total: number
      succeeded: number
      failed: number
      pages: number
    }
    payments?: {
      total: number
      succeeded: number
      failed: number
      pages: number
    }
  }
  errors?: string[]
  warnings?: string[]
}

interface ManualSyncButtonProps {
  className?: string
  size?: "sm" | "default" | "lg"
  variant?: "default" | "outline" | "secondary"
}

export function ManualSyncButton({ 
  className = "",
  size = "default",
  variant = "default"
}: ManualSyncButtonProps) {
  const { toast } = useToast()
  const [syncing, setSyncing] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentOperation, setCurrentOperation] = useState("")
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  const performManualSync = async () => {
    try {
      setSyncing(true)
      setShowProgress(true)
      setProgress(0)
      setSyncResult(null)
      
      // Using scalable sync with full sync (contacts, invoices, payments)
      setCurrentOperation("Starting comprehensive sync with Xero...")
      setProgress(10)

      const response = await fetch('/api/xero/enhanced-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncType: 'full_sync',
          direction: 'pull_from_xero',
          entityType: 'all',
          config: {
            pageSize: 100,
            batchSize: 50,
            maxRetries: 3,
            continueOnError: true
          }
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Sync operation failed')
      }

      const result = await response.json()
      setProgress(100)
      setCurrentOperation("Sync completed!")

      // Format result from scalable sync service
      const formattedResult: SyncResult = {
        success: result.success,
        message: result.message || "Sync completed",
        syncedCount: result.syncedCount || 0,
        totalProcessed:
          (result.details?.contacts?.total || 0) +
          (result.details?.invoices?.total || 0) +
          (result.details?.payments?.total || 0),
        totalErrors:
          (result.details?.contacts?.failed || 0) +
          (result.details?.invoices?.failed || 0) +
          (result.details?.payments?.failed || 0),
        details: result.details,
        errors: result.errors || [],
        warnings: result.warnings || []
      }

      setSyncResult(formattedResult)

      // Show toast notification
      if (formattedResult.success) {
        const contactsInfo = result.details?.contacts 
          ? `${result.details.contacts.succeeded} contacts (${result.details.contacts.pages} pages)` 
          : ''
        const invoicesInfo = result.details?.invoices 
          ? `${result.details.invoices.succeeded} invoices (${result.details.invoices.pages} pages)` 
          : ''
        const paymentsInfo = result.details?.payments 
          ? `${result.details.payments.succeeded} payments (${result.details.payments.pages} pages)` 
          : ''
        
        const details = [contactsInfo, invoicesInfo, paymentsInfo].filter(Boolean).join(', ')
        
        toast({
          title: "✅ Sync Successful",
          description: `Synced ${formattedResult.syncedCount} records successfully. ${details}`,
          variant: "default",
        })
      } else {
        toast({
          title: "⚠️ Sync Completed with Issues",
          description: formattedResult.message,
          variant: "default",
        })
      }

    } catch (error: any) {
      console.error('Manual sync error:', error)
      
      setSyncResult({
        success: false,
        message: "Sync failed",
        errors: [error.message || 'Unknown error occurred']
      })

      // Show error toast but don't break the Finance module
      toast({
        title: "Sync Failed",
        description: "Check sync logs for details. Finance module remains functional.",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
      setCurrentOperation("")
      
      // Keep progress dialog open for 2 seconds to show final status
      setTimeout(() => {
        setShowProgress(false)
        setProgress(0)
      }, 2000)
    }
  }

  const getSyncStatusIcon = () => {
    if (!syncResult) return <RefreshCw className="h-4 w-4" />
    if (syncResult.success) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (syncResult.totalErrors && syncResult.totalErrors > 0) return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    return <XCircle className="h-4 w-4 text-red-600" />
  }

  const getSyncStatusColor = () => {
    if (!syncResult) return ""
    if (syncResult.success) return "text-green-600"
    if (syncResult.totalErrors && syncResult.totalErrors > 0) return "text-yellow-600" 
    return "text-red-600"
  }

  return (
    <>
      <Button
        onClick={performManualSync}
        disabled={syncing}
        size={size}
        variant={variant}
        className={className}
      >
        {syncing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ArrowLeftRight className="mr-2 h-4 w-4" />
        )}
        {syncing ? "Syncing..." : "Sync with Xero"}
      </Button>

      {/* Progress Dialog */}
      <Dialog open={showProgress} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Zap className="mr-2 h-5 w-5 text-blue-600" />
              Manual Xero Sync
            </DialogTitle>
            <DialogDescription>
              Performing bidirectional sync between Finance and Xero
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            {currentOperation && (
              <div className="flex items-center space-x-2">
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  getSyncStatusIcon()
                )}
                <span className={`text-sm ${getSyncStatusColor()}`}>
                  {currentOperation}
                </span>
              </div>
            )}

            {syncResult && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Result</span>
                  <Badge variant={syncResult.success ? "default" : "secondary"}>
                    {syncResult.success ? "Success" : "Completed with Issues"}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground">
                  Errors and warnings will be listed below once the sync finishes so
                  you can review each item individually.
                </div>

                {syncResult.totalProcessed !== undefined && (
                  <div className="text-sm text-muted-foreground">
                    Processed: {syncResult.totalProcessed} items
                  </div>
                )}
                
                {syncResult.totalErrors !== undefined && syncResult.totalErrors > 0 && (
                  <div className="text-sm text-yellow-600">
                    Errors: {syncResult.totalErrors}
                  </div>
                )}

                {syncResult.details && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {syncResult.details.push && (
                      <div>• Pushed: {JSON.stringify(syncResult.details.push)}</div>
                    )}
                    {syncResult.details.pull && (
                      <div>• Pulled: {JSON.stringify(syncResult.details.pull)}</div>
                    )}
                  </div>
                )}

                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div className="text-xs text-red-700 space-y-1">
                    <div className="font-semibold text-red-800">
                      Errors ({syncResult.errors.length})
                    </div>
                    <ul className="list-disc space-y-1 pl-4 text-red-700">
                      {syncResult.errors.map((error, index) => (
                        <li key={`sync-error-${index}`}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {syncResult.warnings && syncResult.warnings.length > 0 && (
                  <div className="text-xs text-amber-700 space-y-1">
                    <div className="font-semibold text-amber-800">
                      Warnings ({syncResult.warnings.length})
                    </div>
                    <ul className="list-disc space-y-1 pl-4 text-amber-700">
                      {syncResult.warnings.map((warning, index) => (
                        <li key={`sync-warning-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {!syncing && (
            <DialogFooter>
              <Button onClick={() => setShowProgress(false)} variant="outline">
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

