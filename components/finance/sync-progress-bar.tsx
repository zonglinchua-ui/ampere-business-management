
'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SyncProgressBarProps {
  isVisible: boolean
  progress: number
  status: 'syncing' | 'complete' | 'error'
  recordsProcessed?: number
  totalRecords?: number
  entity?: string
  errorMessage?: string
}

export function SyncProgressBar({
  isVisible,
  progress,
  status,
  recordsProcessed = 0,
  totalRecords = 0,
  entity = 'records',
  errorMessage
}: SyncProgressBarProps) {
  if (!isVisible) return null

  return (
    <div className={cn(
      "w-full bg-white dark:bg-gray-800 border-b shadow-sm transition-all duration-300",
      isVisible ? "opacity-100" : "opacity-0"
    )}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center space-x-4">
          {/* Status Icon */}
          <div className="flex-shrink-0">
            {status === 'syncing' && (
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
            )}
            {status === 'complete' && (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
          </div>

          {/* Progress Content */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {status === 'syncing' && `Syncing ${entity}...`}
                {status === 'complete' && `✅ Sync complete`}
                {status === 'error' && `⚠️ Sync failed`}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {status === 'syncing' && totalRecords > 0 && (
                  `${recordsProcessed} of ${totalRecords} (${Math.round(progress)}%)`
                )}
                {status === 'complete' && (
                  `${recordsProcessed} ${entity} synced, 0 errors`
                )}
                {status === 'error' && errorMessage && (
                  <span className="text-red-600">{errorMessage}</span>
                )}
              </div>
            </div>
            
            {/* Progress Bar */}
            {status !== 'error' && (
              <Progress 
                value={progress} 
                className={cn(
                  "h-2 transition-all duration-300",
                  status === 'complete' && "bg-green-100"
                )}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
