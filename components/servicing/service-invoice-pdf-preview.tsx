
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Download, Printer, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'

interface ServiceInvoicePDFPreviewProps {
  invoiceId: string
  invoiceNo: string
  onGenerated?: () => void
}

export function ServiceInvoicePDFPreview({ invoiceId, invoiceNo, onGenerated }: ServiceInvoicePDFPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(`/api/servicing/invoices/${invoiceId}/preview`)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `ServiceInvoice-${invoiceNo}.pdf`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Invoice download started')
  }

  const handlePrint = () => {
    const iframe = document.getElementById('invoice-preview-iframe') as HTMLIFrameElement
    if (iframe?.contentWindow) {
      iframe.contentWindow.print()
    }
  }

  const handleRefresh = () => {
    // Force refresh by adding timestamp
    setPdfUrl(`/api/servicing/invoices/${invoiceId}/preview?t=${Date.now()}`)
    toast.info('Invoice preview refreshed')
  }

  const handleGenerateAndSave = async () => {
    try {
      setIsGenerating(true)
      const response = await fetch(`/api/servicing/invoices/${invoiceId}/generate`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate invoice')
      }

      const result = await response.json()
      toast.success('Invoice generated and saved successfully')
      
      // Call the callback if provided
      if (onGenerated) {
        onGenerated()
      }
      
      // Refresh the preview
      handleRefresh()
    } catch (error) {
      console.error('Error generating invoice:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate invoice')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Invoice Preview</CardTitle>
            <CardDescription>
              Preview and generate service invoice PDF - {invoiceNo}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              title="Refresh preview"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              title="Download PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              title="Print PDF"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleGenerateAndSave}
              disabled={isGenerating}
              size="sm"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Generate & Save
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full border rounded-lg overflow-hidden bg-gray-50">
          <iframe
            id="invoice-preview-iframe"
            src={pdfUrl}
            className="w-full"
            style={{ height: 'calc(100vh - 380px)', minHeight: '1000px', border: 'none' }}
            title="Service Invoice Preview"
          />
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            <strong>Note:</strong> This is a preview of the service invoice. Click "Generate & Save" to create
            a permanent copy that will be stored in the system and available for download.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
