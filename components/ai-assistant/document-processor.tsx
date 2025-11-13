'use client'

/**
 * Document Processor Component
 * 
 * Handles AI-powered document processing for:
 * - Purchase Orders (PO) → Create Projects
 * - Invoices → Link to Projects
 * - Progress Claims → Prepare Invoices
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  FileText, 
  Loader, 
  CheckCircle, 
  AlertCircle,
  FileSearch,
  Building2,
  Receipt,
  FileBarChart
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type DocumentType = 'PO' | 'INVOICE' | 'PROGRESS_CLAIM'

interface ExtractedData {
  documentType: string
  confidence: number
  [key: string]: any
}

export function DocumentProcessor() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<DocumentType>('PO')
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [projects, setProjects] = useState<any[]>([])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setExtractedData(null)
      setDocumentId(null)
    }
  }

  const handleUploadAndExtract = async () => {
    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }

    setIsUploading(true)
    setIsProcessing(true)

    try {
      // Step 1: Upload document
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('category', 'GENERAL')

      const uploadResponse = await fetch('/api/ai-assistant/documents/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload document')
      }

      const uploadResult = await uploadResponse.json()
      setDocumentId(uploadResult.document.id)
      setIsUploading(false)

      toast.success('Document uploaded successfully')

      // Step 2: Extract data based on document type
      let extractResponse
      
      switch (documentType) {
        case 'PO':
          extractResponse = await fetch('/api/ai-assistant/process-po', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: uploadResult.document.id })
          })
          break
        
        case 'INVOICE':
          extractResponse = await fetch('/api/ai-assistant/process-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: uploadResult.document.id })
          })
          break
        
        case 'PROGRESS_CLAIM':
          extractResponse = await fetch('/api/ai-assistant/process-progress-claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: uploadResult.document.id })
          })
          break
      }

      if (!extractResponse.ok) {
        throw new Error('Failed to extract data')
      }

      const extractResult = await extractResponse.json()
      setExtractedData(extractResult.extractedData)

      // If suggested project, load projects list
      if (extractResult.suggestedProject) {
        setSelectedProject(extractResult.suggestedProject.id)
      }

      // Load projects for invoice and progress claim
      if (documentType !== 'PO') {
        const projectsResponse = await fetch('/api/projects?limit=100')
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json()
          setProjects(projectsData.data || [])
        }
      }

      toast.success('Data extracted successfully!')

    } catch (error: any) {
      console.error('Processing error:', error)
      toast.error(error.message || 'Failed to process document')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateRecord = async () => {
    if (!extractedData || !documentId) {
      toast.error('No extracted data available')
      return
    }

    setIsProcessing(true)

    try {
      let response
      
      switch (documentType) {
        case 'PO':
          response = await fetch('/api/ai-assistant/process-po', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId,
              extractedData,
              createProject: true
            })
          })
          break
        
        case 'INVOICE':
          if (!selectedProject) {
            toast.error('Please select a project')
            setIsProcessing(false)
            return
          }
          response = await fetch('/api/ai-assistant/process-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId,
              extractedData,
              projectId: selectedProject,
              createRecord: true
            })
          })
          break
        
        case 'PROGRESS_CLAIM':
          if (!selectedProject) {
            toast.error('Please select a project')
            setIsProcessing(false)
            return
          }
          response = await fetch('/api/ai-assistant/process-progress-claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId,
              extractedData,
              projectId: selectedProject,
              createInvoice: true
            })
          })
          break
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Failed to create record')
      }

      const result = await response.json()
      
      toast.success(result.message)

      // Navigate to the created record
      if (documentType === 'PO' && result.project) {
        router.push(`/projects/${result.project.id}`)
      } else if (documentType === 'INVOICE' && result.expense) {
        router.push(`/projects/${selectedProject}`)
      } else if (documentType === 'PROGRESS_CLAIM' && result.progressClaim) {
        router.push(`/projects/${selectedProject}`)
      }

      // Reset form
      setSelectedFile(null)
      setExtractedData(null)
      setDocumentId(null)
      setSelectedProject('')

    } catch (error: any) {
      console.error('Create record error:', error)
      toast.error(error.message || 'Failed to create record')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Document Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            AI Document Processing
          </CardTitle>
          <CardDescription>
            Upload a document and let AI extract the information automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PO">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Purchase Order (Create Project)
                  </div>
                </SelectItem>
                <SelectItem value="INVOICE">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Invoice (Link to Project)
                  </div>
                </SelectItem>
                <SelectItem value="PROGRESS_CLAIM">
                  <div className="flex items-center gap-2">
                    <FileBarChart className="h-4 w-4" />
                    Progress Claim (Prepare Invoice)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Upload Document</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                onChange={handleFileSelect}
                disabled={isProcessing}
              />
              <Button
                onClick={handleUploadAndExtract}
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Extract
                  </>
                )}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extracted Data Preview */}
      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Extracted Data
              <Badge variant="secondary">
                Confidence: {(extractedData.confidence * 100).toFixed(0)}%
              </Badge>
            </CardTitle>
            <CardDescription>
              Review the extracted information and make corrections if needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* PO Data */}
            {documentType === 'PO' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>PO Number</Label>
                    <Input value={extractedData.poNumber || ''} readOnly />
                  </div>
                  <div>
                    <Label>PO Date</Label>
                    <Input value={extractedData.poDate || ''} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Customer Name</Label>
                  <Input value={extractedData.customer?.name || ''} readOnly />
                </div>
                <div>
                  <Label>Project Name</Label>
                  <Input value={extractedData.projectInfo?.projectName || ''} readOnly />
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <Input value={`${extractedData.currency || 'SGD'} ${extractedData.totalAmount?.toFixed(2) || '0.00'}`} readOnly />
                </div>
                <div>
                  <Label>Line Items ({extractedData.lineItems?.length || 0})</Label>
                  <Textarea 
                    value={extractedData.lineItems?.map((item: any) => 
                      `${item.description} - ${item.quantity || ''} ${item.unit || ''} @ ${item.amount || 0}`
                    ).join('\n') || ''} 
                    readOnly 
                    rows={5}
                  />
                </div>
              </div>
            )}

            {/* Invoice Data */}
            {documentType === 'INVOICE' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Invoice Number</Label>
                    <Input value={extractedData.invoiceNumber || ''} readOnly />
                  </div>
                  <div>
                    <Label>Invoice Date</Label>
                    <Input value={extractedData.invoiceDate || ''} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Vendor Name</Label>
                  <Input value={extractedData.vendor?.name || ''} readOnly />
                </div>
                <div>
                  <Label>Select Project *</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.projectNumber} - {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <Input value={`${extractedData.currency || 'SGD'} ${extractedData.totalAmount?.toFixed(2) || '0.00'}`} readOnly />
                </div>
              </div>
            )}

            {/* Progress Claim Data */}
            {documentType === 'PROGRESS_CLAIM' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Claim Number</Label>
                    <Input value={extractedData.claimNumber || ''} readOnly />
                  </div>
                  <div>
                    <Label>Claim Date</Label>
                    <Input value={extractedData.claimDate || ''} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Select Project *</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.projectNumber} - {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Current Claim</Label>
                    <Input value={`${extractedData.currency || 'SGD'} ${extractedData.currentClaimAmount?.toFixed(2) || '0.00'}`} readOnly />
                  </div>
                  <div>
                    <Label>Retention</Label>
                    <Input value={`${extractedData.currency || 'SGD'} ${extractedData.retentionAmount?.toFixed(2) || '0.00'}`} readOnly />
                  </div>
                  <div>
                    <Label>Net Amount</Label>
                    <Input value={`${extractedData.currency || 'SGD'} ${extractedData.netAmount?.toFixed(2) || '0.00'}`} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Work Items ({extractedData.workItems?.length || 0})</Label>
                  <Textarea 
                    value={extractedData.workItems?.map((item: any) => 
                      `${item.description} - Current: ${item.currentClaim || 0}`
                    ).join('\n') || ''} 
                    readOnly 
                    rows={5}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setExtractedData(null)
                setSelectedFile(null)
                setDocumentId(null)
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreateRecord} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {documentType === 'PO' ? 'Create Project' : documentType === 'INVOICE' ? 'Create Expense' : 'Create Progress Claim'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
