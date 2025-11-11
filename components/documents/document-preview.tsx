
'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Download, 
  Printer, 
  Eye,
  ExternalLink,
  Mail,
  Share2
} from 'lucide-react'

interface DocumentPreviewProps {
  documentType: 'quotation' | 'invoice' | 'purchase-order' | 'job-completion'
  documentId: string
  documentNumber: string
  documentTitle: string
  status?: string
  onExport?: () => void
  onEmail?: () => void
  onShare?: () => void
}

export function DocumentPreview({
  documentType,
  documentId,
  documentNumber,
  documentTitle,
  status,
  onExport,
  onEmail,
  onShare
}: DocumentPreviewProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const getExportUrl = () => {
    switch (documentType) {
      case 'quotation':
        return `/api/quotations/${documentId}/export`
      case 'purchase-order':
        return `/api/finance/purchase-orders/${documentId}/export`
      case 'job-completion':
        return `/api/servicing/jobs/${documentId}/completion-certificate`
      default:
        return '#'
    }
  }

  const getDocumentIcon = () => {
    switch (documentType) {
      case 'quotation':
        return '💼'
      case 'invoice':
        return '📄'
      case 'purchase-order':
        return '📋'
      case 'job-completion':
        return '✅'
      default:
        return '📄'
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'draft':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handlePreview = () => {
    const url = getExportUrl()
    window.open(url, '_blank', 'width=1200,height=800')
  }

  const handleDownload = () => {
    const url = getExportUrl()
    const link = document.createElement('a')
    link.href = url
    link.download = `${documentNumber}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    const url = getExportUrl()
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  return (
    <div className="document-preview-container">
      {/* Document Card */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-white hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-4">
          <div className="text-2xl">{getDocumentIcon()}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{documentTitle}</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{documentNumber}</span>
              {status && (
                <Badge className={getStatusColor(status)}>
                  {status.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>

          {onEmail && (
            <Button variant="outline" size="sm" onClick={onEmail}>
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          )}

          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <div className="text-blue-600 mt-1">
            <FileText className="h-4 w-4" />
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Professional Letterhead Format</p>
            <p>
              This document includes the company letterhead with logo, certifications, 
              and professional formatting. Use the <strong>Preview</strong> button to view the 
              formatted document, or <strong>Print</strong> to save as PDF through your browser.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .document-preview-container {
          margin: 20px 0;
        }
      `}</style>
    </div>
  )
}

// Hook for easier integration with existing pages
export function useDocumentExport(documentType: DocumentPreviewProps['documentType']) {
  const [isExporting, setIsExporting] = useState(false)

  const exportDocument = async (documentId: string, documentNumber: string) => {
    setIsExporting(true)
    
    try {
      let exportUrl = ''
      switch (documentType) {
        case 'quotation':
          exportUrl = `/api/quotations/${documentId}/export`
          break
        case 'purchase-order':
          exportUrl = `/api/finance/purchase-orders/${documentId}/export`
          break
        case 'job-completion':
          exportUrl = `/api/servicing/jobs/${documentId}/completion-certificate`
          break
        default:
          throw new Error('Unsupported document type')
      }

      // Open in new window for preview/print
      window.open(exportUrl, '_blank', 'width=1200,height=800')
      
    } catch (error) {
      console.error('Error exporting document:', error)
      alert('Error exporting document. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return {
    exportDocument,
    isExporting
  }
}
