
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Printer, RefreshCw, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface ProjectPDFPreviewProps {
  documentId: string
  documentNumber: string
  documentTitle: string
}

export function ProjectPDFPreview({ documentId, documentNumber, documentTitle }: ProjectPDFPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Set the PDF URL for the project document
        const url = `/api/project-documents/${documentId}/preview-pdf?t=${Date.now()}`
        setPdfUrl(url)
        
        // Verify PDF is available
        const response = await fetch(url, { method: 'HEAD' })
        if (!response.ok) {
          throw new Error('PDF not available')
        }
        
        setLoading(false)
      } catch (err) {
        console.error('Error loading PDF:', err)
        setError('Failed to load PDF preview')
        setLoading(false)
        toast.error('Failed to load PDF preview')
      }
    }

    loadPDF()
  }, [documentId, refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleDownload = async () => {
    if (!pdfUrl) return
    
    try {
      const response = await fetch(pdfUrl)
      if (!response.ok) {
        throw new Error('Failed to download PDF')
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${documentNumber || documentTitle}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('PDF downloaded successfully')
    } catch (err) {
      console.error('Error downloading PDF:', err)
      toast.error('Failed to download PDF')
    }
  }

  const handlePrint = () => {
    if (!pdfUrl) return
    
    const printWindow = window.open(pdfUrl, '_blank')
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print()
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            PDF Preview
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || !!error}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={loading || !!error}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={loading || !!error}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg" style={{ height: 'calc(100vh - 300px)', minHeight: '1000px' }}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Loading PDF preview...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg" style={{ height: 'calc(100vh - 300px)', minHeight: '1000px' }}>
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
              <Button onClick={handleRefresh} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        )}
        
        {!loading && !error && pdfUrl && (
          <div className="relative w-full bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 300px)', minHeight: '1000px' }}>
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full"
            >
              <embed
                src={pdfUrl}
                type="application/pdf"
                className="w-full h-full"
              />
            </object>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
