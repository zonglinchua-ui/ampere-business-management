
'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  AlertTriangle,
  RefreshCw,
  Settings,
  ExternalLink,
  Clock,
  Wifi,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { toast } from 'sonner'

export interface XeroErrorInfo {
  code: string
  message: string
  userFriendlyMessage: string
  isRetryable: boolean
  suggestedAction?: string
}

interface XeroErrorHandlerProps {
  error: XeroErrorInfo
  onRetry?: () => void
  onReconnect?: () => void
  compact?: boolean
  showDetails?: boolean
}

export function XeroErrorHandler({ 
  error, 
  onRetry, 
  onReconnect, 
  compact = false,
  showDetails = false 
}: XeroErrorHandlerProps) {
  const getErrorIcon = () => {
    switch (error.code) {
      case 'TOKEN_EXPIRED':
      case 'TOKEN_INVALID':
        return <Shield className="h-5 w-5 text-amber-600" />
      case 'RATE_LIMIT':
        return <Clock className="h-5 w-5 text-blue-600" />
      case 'NETWORK_ERROR':
        return <Wifi className="h-5 w-5 text-red-600" />
      case 'PERMISSION_DENIED':
        return <Shield className="h-5 w-5 text-orange-600" />
      case 'SYNC_CONFLICT':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'VALIDATION_ERROR':
        return <AlertCircle className="h-5 w-5 text-purple-600" />
      default:
        return <XCircle className="h-5 w-5 text-red-600" />
    }
  }

  const getErrorColor = () => {
    switch (error.code) {
      case 'TOKEN_EXPIRED':
      case 'TOKEN_INVALID':
        return 'border-amber-200 bg-amber-50'
      case 'RATE_LIMIT':
        return 'border-blue-200 bg-blue-50'
      case 'NETWORK_ERROR':
        return 'border-red-200 bg-red-50'
      case 'PERMISSION_DENIED':
        return 'border-orange-200 bg-orange-50'
      case 'SYNC_CONFLICT':
        return 'border-yellow-200 bg-yellow-50'
      case 'VALIDATION_ERROR':
        return 'border-purple-200 bg-purple-50'
      default:
        return 'border-red-200 bg-red-50'
    }
  }

  const getPrimaryAction = () => {
    switch (error.code) {
      case 'TOKEN_EXPIRED':
      case 'TOKEN_INVALID':
        return onReconnect ? (
          <Button onClick={onReconnect} variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            Reconnect Xero
          </Button>
        ) : null

      case 'RATE_LIMIT':
        return (
          <Button 
            onClick={() => {
              toast.success('Please wait 60 seconds before retrying')
              setTimeout(() => {
                if (onRetry) onRetry()
              }, 60000)
            }} 
            variant="outline" 
            size="sm"
          >
            <Clock className="h-4 w-4 mr-1" />
            Retry in 60s
          </Button>
        )

      case 'NETWORK_ERROR':
        return onRetry ? (
          <Button onClick={onRetry} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry Now
          </Button>
        ) : null

      case 'SYNC_CONFLICT':
        return (
          <Button 
            onClick={() => window.location.hash = 'conflicts'} 
            variant="outline" 
            size="sm"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View Conflicts
          </Button>
        )

      default:
        return error.isRetryable && onRetry ? (
          <Button onClick={onRetry} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Try Again
          </Button>
        ) : null
    }
  }

  if (compact) {
    return (
      <Alert className={`${getErrorColor()}`}>
        <div className="flex items-center gap-2">
          {getErrorIcon()}
          <AlertDescription className="flex-1">
            {error.userFriendlyMessage}
          </AlertDescription>
          {getPrimaryAction()}
        </div>
      </Alert>
    )
  }

  return (
    <Card className={`${getErrorColor()} border`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getErrorIcon()}
          Xero Sync Issue
        </CardTitle>
        <CardDescription className="text-base">
          {error.userFriendlyMessage}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error.suggestedAction && (
          <div className="p-3 bg-white/60 rounded-lg">
            <h4 className="font-semibold text-sm mb-1">Recommended Action:</h4>
            <p className="text-sm text-muted-foreground">{error.suggestedAction}</p>
          </div>
        )}

        {showDetails && (
          <div className="p-3 bg-white/40 rounded-lg">
            <h4 className="font-semibold text-sm mb-1">Technical Details:</h4>
            <p className="text-xs font-mono text-muted-foreground">{error.message}</p>
            <p className="text-xs text-muted-foreground mt-1">Error Code: {error.code}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {getPrimaryAction()}
          
          {error.isRetryable && onRetry && error.code !== 'RATE_LIMIT' && (
            <Button onClick={onRetry} variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          )}

          <Button 
            onClick={() => window.open('mailto:support@ampere.com?subject=Xero Integration Issue&body=' + encodeURIComponent(`Error Code: ${error.code}\nMessage: ${error.message}\nUser Friendly: ${error.userFriendlyMessage}`))} 
            variant="ghost" 
            size="sm"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Contact Support
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Success message component for consistency
interface XeroSuccessMessageProps {
  message: string
  details?: string
  onViewLogs?: () => void
  compact?: boolean
}

export function XeroSuccessMessage({ 
  message, 
  details, 
  onViewLogs,
  compact = false 
}: XeroSuccessMessageProps) {
  if (compact) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertDescription className="flex-1">
            {message}
          </AlertDescription>
          {onViewLogs && (
            <Button onClick={onViewLogs} variant="outline" size="sm">
              View Logs
            </Button>
          )}
        </div>
      </Alert>
    )
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-green-800">
          <CheckCircle className="h-5 w-5" />
          Sync Completed Successfully
        </CardTitle>
        <CardDescription className="text-green-700">
          {message}
        </CardDescription>
      </CardHeader>
      {(details || onViewLogs) && (
        <CardContent className="space-y-4">
          {details && (
            <div className="p-3 bg-white/60 rounded-lg">
              <p className="text-sm text-green-800">{details}</p>
            </div>
          )}
          
          {onViewLogs && (
            <Button onClick={onViewLogs} variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              View Sync Logs
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// Hook for using error handling in components
export function useXeroErrorHandling() {
  const handleXeroOperation = async (
    operation: () => Promise<any>,
    options: {
      onSuccess?: (result: any) => void
      onError?: (error: XeroErrorInfo) => void
      showToast?: boolean
    } = {}
  ) => {
    try {
      const result = await operation()
      
      if (result.success) {
        if (options.showToast) {
          toast.success(result.data?.message || 'Operation completed successfully')
        }
        if (options.onSuccess) {
          options.onSuccess(result.data)
        }
        return result.data
      } else {
        const errorInfo = result.error
        
        if (options.showToast) {
          toast.error(errorInfo.userFriendlyMessage)
        }
        if (options.onError) {
          options.onError(errorInfo)
        }
        throw new Error(errorInfo.userFriendlyMessage)
      }
    } catch (error: any) {
      const errorInfo: XeroErrorInfo = {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        userFriendlyMessage: 'An unexpected error occurred. Please try again.',
        isRetryable: true,
        suggestedAction: 'Contact support if the problem persists'
      }
      
      if (options.showToast) {
        toast.error(errorInfo.userFriendlyMessage)
      }
      if (options.onError) {
        options.onError(errorInfo)
      }
      throw error
    }
  }

  return { handleXeroOperation }
}
