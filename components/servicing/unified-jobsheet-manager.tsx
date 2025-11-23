
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Download, 
  Printer, 
  RefreshCw, 
  FileText, 
  Upload, 
  CheckCircle2,
  Eye,
  FileCheck,
  Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface JobSheet {
  id: string
  jobSheetNumber?: string | null
  filePath: string
  endorsedFilePath?: string | null
  endorsedUploadedAt?: string | null
  clientSignature?: string | null
  generatedAt: string
}

interface UnifiedJobSheetManagerProps {
  jobId: string
  jobSheetNumber?: string
  existingJobSheets?: JobSheet[]
  onUpdate?: () => void
}

export function UnifiedJobSheetManager({ 
  jobId, 
  jobSheetNumber,
  existingJobSheets = [],
  onUpdate
}: UnifiedJobSheetManagerProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobSheets, setJobSheets] = useState<JobSheet[]>(existingJobSheets)
  const [uploading, setUploading] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedJobSheetId, setSelectedJobSheetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    setJobSheets(existingJobSheets)
  }, [existingJobSheets])

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

  const handleDownload = async (filePath: string, filename: string) => {
    try {
      const link = document.createElement('a')
      link.href = filePath
      link.download = filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: 'Download Started',
        description: 'Job sheet download has been initiated.',
      })
    } catch (err) {
      console.error('Error downloading file:', err)
      toast({
        title: 'Download Failed',
        description: 'Failed to download file. Please try again.',
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
      
      // Refresh the preview and job sheets list
      handleRefresh()
      if (onUpdate) onUpdate()
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

  const handleUploadClick = (jobSheetId: string) => {
    setSelectedJobSheetId(jobSheetId)
    setSelectedFile(null)
    setUploadDialogOpen(true)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload a PDF or image file (JPEG, JPG, PNG)',
          variant: 'destructive',
        })
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Please upload a file smaller than 10MB',
          variant: 'destructive',
        })
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleUploadEndorsed = async () => {
    if (!selectedFile || !selectedJobSheetId) return

    setUploading(selectedJobSheetId)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('jobSheetId', selectedJobSheetId)

      const response = await fetch(`/api/servicing/jobs/${jobId}/upload-endorsed-jobsheet`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()
      
      toast({
        title: 'Upload Successful',
        description: 'Customer-endorsed job sheet has been uploaded successfully.',
      })

      setUploadDialogOpen(false)
      setSelectedFile(null)
      setSelectedJobSheetId(null)
      
      // Refresh the job sheets list
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Error uploading endorsed job sheet:', err)
      toast({
        title: 'Upload Failed',
        description: err instanceof Error ? err.message : 'Failed to upload endorsed job sheet.',
        variant: 'destructive',
      })
    } finally {
      setUploading(null)
    }
  }

  const handleDelete = async (jobSheetId: string, jobSheetNumber: string) => {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete Job Sheet ${jobSheetNumber}? This action cannot be undone.`)) {
      return
    }

    setDeleting(jobSheetId)
    try {
      const response = await fetch(`/api/servicing/jobsheets/${jobSheetId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Delete failed')
      }

      toast({
        title: 'Job Sheet Deleted',
        description: 'The job sheet has been successfully deleted.',
      })

      // Refresh the job sheets list
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Error deleting job sheet:', err)
      toast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Failed to delete job sheet. You may not have permission.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Preview Section */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Job Sheet Preview & Generation
              </CardTitle>
              <CardDescription className="mt-2">
                Preview the job sheet before generating, or generate and save to records
              </CardDescription>
            </div>
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

      {/* Generated Job Sheets Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Generated Job Sheets
          </CardTitle>
          <CardDescription>
            Job sheets that have been generated and saved, with option to upload customer-endorsed copies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobSheets.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="text-muted-foreground font-medium mb-2">No job sheets generated yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Click "Generate & Save" above to create your first job sheet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobSheets.map((sheet) => (
                <div key={sheet.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">Job Sheet #{sheet.jobSheetNumber || jobSheetNumber || 'N/A'}</p>
                          {sheet.endorsedFilePath && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Generated: {format(new Date(sheet.generatedAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>

                      {/* Generated Job Sheet */}
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Generated Document:</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(sheet.filePath, `JobSheet-${sheet.jobSheetNumber || jobSheetNumber || 'Generated'}.pdf`)}
                          className="h-7 px-2"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(sheet.filePath, '_blank')}
                          className="h-7 px-2"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>

                      {/* Endorsed Job Sheet */}
                      {sheet.endorsedFilePath ? (
                        <div className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950/20 p-2 rounded">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-700 dark:text-green-400">
                            Customer-Endorsed Document:
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {sheet.endorsedUploadedAt && format(new Date(sheet.endorsedUploadedAt), 'MMM dd, yyyy HH:mm')}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(sheet.endorsedFilePath!, `JobSheet-${sheet.jobSheetNumber || jobSheetNumber || 'Endorsed'}-Endorsed.pdf`)}
                            className="h-7 px-2"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(sheet.endorsedFilePath!, '_blank')}
                            className="h-7 px-2"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            No customer-endorsed document uploaded yet
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant={sheet.endorsedFilePath ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleUploadClick(sheet.id)}
                        disabled={uploading === sheet.id || deleting === sheet.id}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {sheet.endorsedFilePath ? 'Re-upload' : 'Upload'} Endorsed
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(sheet.id, sheet.jobSheetNumber || jobSheetNumber || 'N/A')}
                        disabled={deleting === sheet.id || uploading === sheet.id}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleting === sheet.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Customer-Endorsed Job Sheet</DialogTitle>
            <DialogDescription>
              Upload the job sheet that has been signed/endorsed by the customer for records
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="endorsed-file">Select File</Label>
              <Input
                id="endorsed-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, JPEG, JPG, PNG (Max 10MB)
              </p>
            </div>
            {selectedFile && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Selected File:</p>
                <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false)
                setSelectedFile(null)
                setSelectedJobSheetId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadEndorsed}
              disabled={!selectedFile || uploading !== null}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
