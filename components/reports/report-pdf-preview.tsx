
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, FileText, Loader2, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface ReportPDFPreviewProps {
  isOpen: boolean
  onClose: () => void
  reportId: string
  reportName: string
  filters: any
  dateRange: {
    from?: Date
    to?: Date
  }
}

export function ReportPDFPreview({ 
  isOpen, 
  onClose, 
  reportId, 
  reportName, 
  filters, 
  dateRange 
}: ReportPDFPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    if (isOpen && reportId) {
      generatePreview()
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [isOpen, reportId])

  const generatePreview = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          format: 'pdf',
          filters: {
            ...filters,
            dateRange: dateRange.from && dateRange.to ? {
              from: dateRange.from.toISOString(),
              to: dateRange.to.toISOString()
            } : undefined
          }
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
      } else {
        throw new Error('Failed to generate preview')
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      setError('Failed to generate preview. Please try again.')
      toast.error('Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!pdfUrl) return

    setDownloading(true)

    try {
      const response = await fetch(pdfUrl)
      const blob = await response.blob()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      
      const timestamp = new Date().toISOString().split('T')[0]
      a.download = `${reportName.replace(/\s+/g, '_')}_${timestamp}.pdf`
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Report downloaded successfully!')
      onClose()
    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast.error('Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50))
  }

  const handleResetZoom = () => {
    setZoom(100)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">{reportName} - Preview</DialogTitle>
              <DialogDescription className="mt-1">
                Review your report before downloading
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              {/* Zoom controls */}
              <div className="flex items-center space-x-1 border rounded-md p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="h-7 w-7 p-0"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium px-2 min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="h-7 w-7 p-0"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetZoom}
                  className="h-7 w-7 p-0"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>

              <Button
                onClick={handleDownload}
                disabled={!pdfUrl || downloading}
                className="bg-red-600 hover:bg-red-700"
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <p className="text-gray-600 dark:text-gray-400">Generating report preview...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <FileText className="h-16 w-16 text-red-500" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button onClick={generatePreview} variant="outline">
                Try Again
              </Button>
            </div>
          )}

          {pdfUrl && !loading && !error && (
            <div className="flex justify-center">
              <div 
                className="bg-white shadow-2xl" 
                style={{ 
                  width: `${zoom}%`,
                  minWidth: '600px',
                  maxWidth: '100%',
                  transition: 'width 0.3s ease'
                }}
              >
                <iframe
                  src={pdfUrl}
                  className="w-full"
                  style={{ 
                    height: 'calc(90vh - 160px)',
                    minHeight: '1000px'
                  }}
                  title="PDF Preview"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <FileText className="inline-block h-4 w-4 mr-1" />
              PDF Report Preview
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
