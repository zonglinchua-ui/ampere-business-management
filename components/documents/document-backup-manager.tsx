
'use client'

/**
 * Document Backup Manager Component
 * 
 * Provides UI for managing document backups and restoration
 * Allows users to:
 * - View all backed up documents in NAS
 * - Download PDF and Excel versions
 * - Restore documents after system breakdown
 * - View backup statistics
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Download, 
  FileText, 
  Sheet, 
  RefreshCw, 
  Database,
  Calendar,
  FolderOpen,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface NASDocument {
  path: string
  filename: string
  type: 'pdf' | 'excel'
  size: number
  modifiedDate: string
  documentNumber?: string
  year?: string
  customerName?: string
  projectName?: string
}

interface BackupStatistics {
  totalDocuments: number
  totalSize: number
  byType: {
    quotations: { count: number; size: number }
    invoices: { count: number; size: number }
    purchaseOrders: { count: number; size: number }
    projects: { count: number; size: number }
  }
  byYear: Record<string, number>
  oldestBackup?: string
  newestBackup?: string
}

export function DocumentBackupManager() {
  const [quotations, setQuotations] = useState<NASDocument[]>([])
  const [invoices, setInvoices] = useState<NASDocument[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<NASDocument[]>([])
  const [projects, setProjects] = useState<NASDocument[]>([])
  const [statistics, setStatistics] = useState<BackupStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    scanBackups()
    loadStatistics()
  }, [])

  const scanBackups = async () => {
    try {
      setScanning(true)
      const response = await fetch('/api/documents/restore?action=scan')
      const data = await response.json()

      if (data.success) {
        setQuotations(data.quotations || [])
        setInvoices(data.invoices || [])
        setPurchaseOrders(data.purchaseOrders || [])
        setProjects(data.projects || [])
        
        toast.success(`Found ${data.total} backed up documents`)
      } else {
        toast.error('Failed to scan backups: ' + data.error)
      }
    } catch (error) {
      console.error('Error scanning backups:', error)
      toast.error('Failed to scan backups')
    } finally {
      setScanning(false)
    }
  }

  const loadStatistics = async () => {
    try {
      const response = await fetch('/api/documents/restore?action=statistics')
      const data = await response.json()

      if (data.success) {
        setStatistics(data.statistics)
      }
    } catch (error) {
      console.error('Error loading statistics:', error)
    }
  }

  const downloadBackup = async (backupPath: string, filename: string) => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/documents/download-backup?path=${encodeURIComponent(backupPath)}`)
      
      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Downloaded: ${filename}`)
    } catch (error) {
      console.error('Error downloading backup:', error)
      toast.error('Failed to download backup')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderDocumentList = (documents: NASDocument[], title: string) => {
    if (documents.length === 0) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No backed up {title.toLowerCase()} found in NAS storage.
          </AlertDescription>
        </Alert>
      )
    }

    // Group documents by document number
    const grouped = documents.reduce((acc, doc) => {
      const key = doc.documentNumber || doc.filename
      if (!acc[key]) {
        acc[key] = { pdf: null, excel: null }
      }
      if (doc.type === 'pdf') {
        acc[key].pdf = doc
      } else {
        acc[key].excel = doc
      }
      return acc
    }, {} as Record<string, { pdf: NASDocument | null; excel: NASDocument | null }>)

    return (
      <div className="space-y-3">
        {Object.entries(grouped).map(([docNumber, files]) => (
          <Card key={docNumber}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{docNumber}</h4>
                    {files.pdf && files.excel && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete Backup
                      </Badge>
                    )}
                  </div>
                  
                  {(files.pdf || files.excel) && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      {files.pdf?.year && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{files.pdf.year}</span>
                        </div>
                      )}
                      {files.pdf?.customerName && (
                        <div className="flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          <span>{files.pdf.customerName}</span>
                        </div>
                      )}
                      {files.pdf?.projectName && (
                        <div className="text-xs">
                          Project: {files.pdf.projectName}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {files.pdf && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadBackup(files.pdf!.path, files.pdf!.filename)}
                      disabled={loading}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF ({formatBytes(files.pdf.size)})
                    </Button>
                  )}
                  {files.excel && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadBackup(files.excel!.path, files.excel!.filename)}
                      disabled={loading}
                    >
                      <Sheet className="h-4 w-4 mr-1" />
                      Excel ({formatBytes(files.excel.size)})
                    </Button>
                  )}
                </div>
              </div>

              {files.pdf && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Last modified: {formatDate(files.pdf.modifiedDate)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Backup & Recovery</h2>
          <p className="text-muted-foreground">
            Manage and restore backed up documents from NAS storage
          </p>
        </div>
        <Button onClick={scanBackups} disabled={scanning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Refresh'}
        </Button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalDocuments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(statistics.totalSize)} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Quotations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.byType.quotations.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(statistics.byType.quotations.size)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.byType.purchaseOrders.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(statistics.byType.purchaseOrders.size)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.byType.invoices.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(statistics.byType.invoices.size)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Document Lists */}
      <Tabs defaultValue="quotations" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quotations">
            Quotations ({quotations.length})
          </TabsTrigger>
          <TabsTrigger value="purchase-orders">
            Purchase Orders ({purchaseOrders.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({projects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="space-y-4">
          {renderDocumentList(quotations, 'Quotations')}
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-4">
          {renderDocumentList(purchaseOrders, 'Purchase Orders')}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          {renderDocumentList(invoices, 'Invoices')}
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          {renderDocumentList(projects, 'Project Documents')}
        </TabsContent>
      </Tabs>

      {/* Info Alert */}
      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription>
          All documents generated from the web app are automatically backed up to NAS storage
          in both PDF and Excel formats. Use this interface to download or restore documents
          when needed, especially after system restoration or breakdown.
        </AlertDescription>
      </Alert>
    </div>
  )
}
