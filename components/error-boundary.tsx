
/**
 * Global Error Boundary Component
 * 
 * Catches React component errors and logs them to the system
 */

'use client'

import React, { Component, ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface LogPayload {
  type: 'ERROR'
  action: string
  message: string
  module: string
  status: 'CRITICAL'
  createdAt: string
}

/**
 * Send error log to backend
 */
async function sendErrorLog(log: LogPayload): Promise<void> {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    })
  } catch (err) {
    console.error('[Error Boundary] Failed to send error log:', err)
    
    // Queue for retry
    try {
      const queue = JSON.parse(localStorage.getItem('pendingLogs') || '[]')
      queue.push(log)
      localStorage.setItem('pendingLogs', JSON.stringify(queue))
    } catch (e) {
      console.error('[Error Boundary] Failed to queue log:', e)
    }
  }
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Error Boundary] Caught error:', error, errorInfo)

    this.setState({ error, errorInfo })

    // Log to system
    const logPayload: LogPayload = {
      type: 'ERROR',
      action: 'React Component Failure',
      message: `${error.message}\n\nComponent Stack:${errorInfo.componentStack}`,
      module: 'Frontend',
      status: 'CRITICAL',
      createdAt: new Date().toISOString(),
    }

    sendErrorLog(logPayload)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <CardDescription className="text-base mt-2">
                We encountered an unexpected error. Our team has been notified and will investigate the issue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-64">
                  <p className="font-mono text-xs text-red-600 whitespace-pre-wrap">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                        Component Stack
                      </summary>
                      <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-center pt-4">
                <Button onClick={this.handleReset} variant="outline">
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoHome}>
                  <Home className="w-4 h-4 mr-2" />
                  Go to Home
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground pt-4">
                If this problem persists, please contact support with the error details.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
