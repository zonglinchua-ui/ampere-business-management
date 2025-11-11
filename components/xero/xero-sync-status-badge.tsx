
'use client'

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Upload,
  Loader2
} from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface XeroSyncStatusBadgeProps {
  entityType: 'client' | 'vendor' | 'invoice' | 'payment'
  entityId: string
  entityName?: string
  isSynced: boolean
  xeroId?: string | null
  lastSyncDate?: Date | null
  onSyncSuccess?: () => void
  showSyncButton?: boolean
  invoiceType?: 'client' | 'vendor' // for invoices only
}

export function XeroSyncStatusBadge({
  entityType,
  entityId,
  entityName,
  isSynced,
  xeroId,
  lastSyncDate,
  onSyncSuccess,
  showSyncButton = true,
  invoiceType
}: XeroSyncStatusBadgeProps) {
  const { toast } = useToast()
  const [syncing, setSyncing] = useState(false)

  const syncEntity = async () => {
    try {
      setSyncing(true)
      
      let endpoint = ''
      let payload: any = {}
      
      switch (entityType) {
        case 'client':
          endpoint = '/api/finance/sync/clients'
          payload = { clientId: entityId }
          break
        case 'vendor':
          endpoint = '/api/finance/sync/vendors'
          payload = { vendorId: entityId }
          break
        case 'invoice':
          endpoint = '/api/finance/sync/invoices'
          payload = { invoiceId: entityId, type: invoiceType || 'client' }
          break
        case 'payment':
          endpoint = '/api/finance/sync/payments'
          payload = { paymentId: entityId }
          break
        default:
          throw new Error('Invalid entity type')
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Sync failed')
      }

      const result = await response.json()
      
      toast({
        title: "Sync Successful",
        description: `${entityName || entityType} synced to Xero successfully`,
        variant: "default",
      })

      // Call callback to refresh parent component
      if (onSyncSuccess) {
        onSyncSuccess()
      }
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "An error occurred during sync",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const getSyncStatus = () => {
    if (isSynced && xeroId) {
      return {
        variant: 'default' as const,
        icon: <CheckCircle className="h-3 w-3" />,
        text: 'Synced',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      }
    } else {
      return {
        variant: 'secondary' as const,
        icon: <XCircle className="h-3 w-3" />,
        text: 'Not Synced',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      }
    }
  }

  const status = getSyncStatus()

  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={status.variant} className={status.color}>
              {status.icon}
              <span className="ml-1">{status.text}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">
                {entityName || entityType.charAt(0).toUpperCase() + entityType.slice(1)}
              </p>
              {isSynced ? (
                <>
                  <p className="text-sm">Xero ID: {xeroId}</p>
                  {lastSyncDate && (
                    <p className="text-sm">
                      Last synced: {lastSyncDate.toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm">Not yet synced to Xero</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showSyncButton && !isSynced && (
        <Button
          size="sm"
          variant="outline"
          onClick={syncEntity}
          disabled={syncing}
          className="h-6 px-2 text-xs"
        >
          {syncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          <span className="ml-1">Sync</span>
        </Button>
      )}
    </div>
  )
}
