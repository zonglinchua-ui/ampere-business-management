
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Printer, RefreshCw, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface JobSheetPDFPreviewProps {
  jobId: string
  jobSheetNumber?: string
}

export function JobSheetPDFPreview({ jobId, jobSheetNumber }: JobSheetPDFPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Set the PDF URL for preview
    setPdfUrl(`/api/servicing/jobs/${jobId}/preview-jobsheet?t=${Date.now()}`)
  }, [jobId, refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    toast({
      title: 'Refreshing',
      description: 'Job sheet preview is being refreshed.',
    })
  }

  const handleDownload = async () => {
    if (!pdfUrl) return
    
    try {
      const response = await fetch(pdfUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `JobSheet-${jobSheetNumber || jobId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast({
        title: 'Download Started',
        description: 'Job sheet PDF download has been initiated.',
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

  const handlePrint = () => {
    if (!pdfUrl) return
    
    const printWindow = window.open(pdfUrl, '_blank')
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print()
      })
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch(`/api/servicing/jobs/${jobId}/generate-jobsheet`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate job sheet')
      }
      
      const data = await response.json()
      
      toast({
        title: 'Job Sheet Generated',
        description: `Job sheet ${data.jobSheetNumber} has been generated and saved successfully.`,
      })
      
      // Refresh the preview
      handleRefresh()
    } catch (err) {
      console.error('Error generating job sheet:', err)
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate job sheet. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Job Sheet Preview
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              title="Refresh Preview"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              title="Print Job Sheet"
            >
              <Printer className="h-4 w-4" />
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
              variant="default"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              title="Generate and Save Job Sheet"
            >
              <FileText className="h-4 w-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate & Save'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pdfUrl ? (
          <div className="relative w-full border rounded-lg" style={{ height: 'calc(100vh - 300px)', minHeight: '1000px' }}>
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="Job Sheet Preview"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height: 'calc(100vh - 300px)', minHeight: '1000px' }}>
            <p className="text-muted-foreground">Loading job sheet preview...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
