
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Printer, RefreshCw, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PDFPreviewProps {
  quotationId: string
  quotationNumber: string
}

export function PDFPreview({ quotationId, quotationNumber }: PDFPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Set the PDF URL directly without checking availability first
    // This eliminates the extra round-trip and speeds up loading
    setPdfUrl(`/api/quotations/${quotationId}/preview-pdf?t=${Date.now()}`)
  }, [quotationId, refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleDownload = async () => {
    if (!pdfUrl) return
    
    try {
      const response = await fetch(pdfUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${quotationNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast({
        title: 'Download Started',
        description: 'PDF download has been initiated.',
      })
    } catch (err) {
      console.error('Error downloading PDF:', err)
      toast({
        title: 'Download Failed',
        description: 'Failed to download PDF. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadExcel = async () => {
    if (!quotationId) return
    
    setIsDownloadingExcel(true)
    try {
      const response = await fetch(`/api/quotations/${quotationId}/excel`)
      if (!response.ok) {
        throw new Error('Failed to get Excel download URL')
      }
      
      const data = await response.json()
      
      // Download the file from the signed URL
      const fileResponse = await fetch(data.downloadUrl)
      const blob = await fileResponse.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${quotationNumber}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast({
        title: 'Download Started',
        description: 'Excel download has been initiated.',
      })
    } catch (err) {
      console.error('Error downloading Excel:', err)
      toast({
        title: 'Download Failed',
        description: 'Failed to download Excel file. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsDownloadingExcel(false)
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
          <CardTitle>Document Preview & Download</CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={!pdfUrl}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!pdfUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              disabled={isDownloadingExcel}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {isDownloadingExcel ? 'Downloading...' : 'Excel'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!pdfUrl}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pdfUrl && (
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
        
        {!pdfUrl && (
          <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg" style={{ height: 'calc(100vh - 300px)', minHeight: '1000px' }}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Initializing PDF preview...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
