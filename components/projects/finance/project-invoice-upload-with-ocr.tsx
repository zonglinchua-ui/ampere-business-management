

'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Tag,
  File,
  Image,
  Trash2,
  Loader2,
  Sparkles,
  Edit
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface ProjectInvoiceUploadProps {
  projectId: string
  suppliers?: Array<{ id: string; name: string }>
  budgetCategories?: Array<{
    id: string
    name: string
    code: string
    color?: string
    customCategory?: { id: string; name: string; code: string; color?: string }
  }>
  onUploadComplete?: () => void
}

interface ExtractedData {
  supplierName: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  dueDate: string | null
  totalAmount: number | null
  currency: string | null
  lineItems?: Array<{ description: string; amount: number }>
  taxAmount?: number | null
  notes: string | null
  confidence: 'high' | 'medium' | 'low'
}

interface UploadFile {
  id: string
  file: File
  preview?: string
  status: 'pending' | 'extracting' | 'extracted' | 'uploading' | 'success' | 'error'
  errorMessage?: string
  supplierId?: string
  budgetCategoryId?: string
  amount?: string
  subtotal?: string
  taxAmount?: string
  invoiceNumber?: string
  invoiceDate?: string
  notes?: string
  extractedData?: ExtractedData
  isManuallyEdited?: boolean
}

const SYSTEM_BUDGET_CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'MATERIALS', label: 'Materials' },
  { value: 'LABOR', label: 'Labor' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SUBCONTRACTOR', label: 'Subcontractor' },
  { value: 'PERMITS', label: 'Permits' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'OVERHEAD', label: 'Overhead' },
  { value: 'CONTINGENCY', label: 'Contingency' },
  { value: 'OTHER', label: 'Other' },
]

export function ProjectInvoiceUploadWithOCR({ 
  projectId, 
  suppliers = [], 
  budgetCategories = [],
  onUploadComplete 
}: ProjectInvoiceUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [bulkSettings, setBulkSettings] = useState({
    supplierId: '',
    budgetCategoryId: '',
    notes: ''
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (!validTypes.includes(file.type)) {
      return { isValid: false, error: 'Invalid file type. Please upload PDF, JPG, or PNG files.' }
    }
    
    if (file.size > maxSize) {
      return { isValid: false, error: 'File too large. Maximum size is 10MB.' }
    }
    
    return { isValid: true }
  }

  const generateFilePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => resolve(undefined)
        reader.readAsDataURL(file)
      } else {
        resolve(undefined)
      }
    })
  }

  // Find supplier by name using intelligent fuzzy matching
  const findSupplierByName = async (name: string | null): Promise<{
    supplierId: string | undefined
    confidence: 'exact' | 'high' | 'medium' | 'low' | 'none'
    matchedName?: string
  }> => {
    if (!name) return { supplierId: undefined, confidence: 'none' }
    
    try {
      const response = await fetch('/api/suppliers/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierName: name })
      })
      
      if (!response.ok) {
        throw new Error('Failed to match supplier')
      }
      
      const result = await response.json()
      
      return {
        supplierId: result.matched ? result.supplier.id : undefined,
        confidence: result.confidence,
        matchedName: result.supplier?.name
      }
    } catch (error) {
      console.error('Error matching supplier:', error)
      // Fallback to simple matching
      const normalizedName = name.toLowerCase().trim()
      const exactMatch = suppliers.find(s => s.name.toLowerCase() === normalizedName)
      return {
        supplierId: exactMatch?.id,
        confidence: exactMatch ? 'high' : 'none'
      }
    }
  }

  // Extract invoice data using AI
  const extractInvoiceData = async (file: File): Promise<ExtractedData | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/invoice-extract', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to extract invoice data')
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Extraction error:', error)
      return null
    }
  }

  const handleFiles = async (files: FileList) => {
    const newFiles: UploadFile[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const validation = validateFile(file)
      
      if (validation.isValid) {
        const preview = await generateFilePreview(file)
        const fileItem: UploadFile = {
          id: `${Date.now()}-${i}`,
          file,
          preview,
          status: 'extracting'
        }
        newFiles.push(fileItem)
      } else {
        toast.error(`${file.name}: ${validation.error}`)
      }
    }
    
    setUploadFiles(prev => [...prev, ...newFiles])
    
    // Extract data for each file
    for (const fileItem of newFiles) {
      const extractedData = await extractInvoiceData(fileItem.file)
      
      if (extractedData) {
        // Match supplier using intelligent fuzzy matching
        const matchResult = await findSupplierByName(extractedData.supplierName)
        
        // Calculate subtotal from total and tax if available
        let calculatedSubtotal = extractedData.totalAmount || 0
        const taxAmt = extractedData.taxAmount || 0
        if (extractedData.totalAmount && extractedData.taxAmount) {
          calculatedSubtotal = extractedData.totalAmount - extractedData.taxAmount
        }
        
        updateFileData(fileItem.id, {
          status: 'extracted',
          extractedData,
          supplierId: matchResult.supplierId,
          subtotal: calculatedSubtotal > 0 ? calculatedSubtotal.toString() : '',
          taxAmount: taxAmt > 0 ? taxAmt.toString() : '',
          amount: extractedData.totalAmount?.toString() || '',
          invoiceNumber: extractedData.invoiceNumber || '',
          invoiceDate: extractedData.invoiceDate || '',
          notes: extractedData.notes || ''
        })
        
        // Provide feedback about extraction and matching
        let description = ''
        if (matchResult.confidence === 'exact' || matchResult.confidence === 'high') {
          description = `Supplier matched: ${matchResult.matchedName || 'Found'}`
        } else if (matchResult.confidence === 'medium') {
          description = `Possible supplier match: ${matchResult.matchedName || 'Please verify'}`
        } else if (matchResult.supplierId) {
          description = `Low confidence match: ${matchResult.matchedName || 'Please verify'}`
        } else {
          description = `Supplier "${extractedData.supplierName}" not found - Please select manually`
        }
        
        toast.success(`Data extracted from ${fileItem.file.name}`, {
          description
        })
      } else {
        updateFileData(fileItem.id, {
          status: 'pending',
          errorMessage: 'Could not extract data automatically. Please enter manually.'
        })
        toast.warning(`${fileItem.file.name}: Manual entry required`)
      }
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const updateFileData = (fileId: string, data: Partial<UploadFile>) => {
    setUploadFiles(prev => prev.map(f => f.id === fileId ? { ...f, ...data } : f))
  }

  const applyBulkSettings = () => {
    setUploadFiles(prev => prev.map(f => ({
      ...f,
      supplierId: bulkSettings.supplierId || f.supplierId,
      budgetCategoryId: bulkSettings.budgetCategoryId || f.budgetCategoryId,
      notes: bulkSettings.notes || f.notes
    })))
    setShowBulkDialog(false)
    setBulkSettings({ supplierId: '', budgetCategoryId: '', notes: '' })
    toast.success('Bulk settings applied to all files')
  }

  const uploadFile = async (uploadFileItem: UploadFile) => {
    if (!uploadFileItem.supplierId || !uploadFileItem.subtotal) {
      updateFileData(uploadFileItem.id, { 
        status: 'error', 
        errorMessage: 'Supplier and subtotal are required' 
      })
      return
    }

    updateFileData(uploadFileItem.id, { status: 'uploading' })

    try {
      const formData = new FormData()
      formData.append('file', uploadFileItem.file)
      formData.append('projectId', projectId)
      formData.append('supplierId', uploadFileItem.supplierId)
      formData.append('subtotal', uploadFileItem.subtotal)
      formData.append('taxAmount', uploadFileItem.taxAmount || '0')
      formData.append('amount', uploadFileItem.amount || uploadFileItem.subtotal)
      formData.append('budgetCategoryId', uploadFileItem.budgetCategoryId || '')
      formData.append('invoiceNumber', uploadFileItem.invoiceNumber || '')
      formData.append('invoiceDate', uploadFileItem.invoiceDate || '')
      formData.append('notes', uploadFileItem.notes || '')
      
      // Include extracted data confidence for audit purposes
      if (uploadFileItem.extractedData) {
        formData.append('extractionConfidence', uploadFileItem.extractedData.confidence)
        formData.append('wasAutoExtracted', 'true')
      }
      
      const response = await fetch(`/api/projects/${projectId}/supplier-invoices/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        // Parse error response to get specific error message
        let errorMessage = 'Upload failed'
        let errorDetails = 'Please try again.'
        
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
          if (errorData.details) {
            errorDetails = errorData.details
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
        }
        
        // Handle specific error codes
        if (response.status === 409) {
          // Conflict - duplicate invoice number
          throw new Error(errorDetails || 'Invoice number already exists for this supplier')
        } else if (response.status === 404) {
          // Not found - invalid supplier
          throw new Error(errorDetails || 'Supplier not found')
        } else if (response.status === 400) {
          // Bad request - missing required fields
          throw new Error(errorDetails || 'Missing required fields')
        } else {
          // Generic server error
          throw new Error(`${errorMessage}: ${errorDetails}`)
        }
      }

      updateFileData(uploadFileItem.id, { status: 'success' })
      toast.success(`${uploadFileItem.file.name} uploaded successfully`)
      
      // Remove successful upload after a delay
      setTimeout(() => {
        removeFile(uploadFileItem.id)
      }, 2000)
      
      onUploadComplete?.()

    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.'
      
      updateFileData(uploadFileItem.id, { 
        status: 'error', 
        errorMessage 
      })
      toast.error(`Failed to upload ${uploadFileItem.file.name}: ${errorMessage}`)
    }
  }

  const uploadAllFiles = () => {
    uploadFiles.forEach(fileItem => {
      if (fileItem.status === 'pending' || fileItem.status === 'extracted') {
        uploadFile(fileItem)
      }
    })
  }

  const getCategoryLabel = (categoryId: string) => {
    // Check custom categories first
    const customCategory = budgetCategories.find(cat => 
      (cat.customCategory && cat.customCategory.id === categoryId) || cat.id === categoryId
    )
    if (customCategory) {
      return customCategory.customCategory?.name || customCategory.name
    }
    
    // Check system categories
    const systemCategory = SYSTEM_BUDGET_CATEGORIES.find(cat => cat.value === categoryId)
    return systemCategory?.label || 'Unknown Category'
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image
    if (file.type === 'application/pdf') return FileText
    return File
  }

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-orange-100 text-orange-800'
    }
    return (
      <Badge variant="outline" className={colors[confidence]}>
        <Sparkles className="mr-1 h-3 w-3" />
        {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      {/* Drag and Drop Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className={`h-12 w-12 mb-4 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
          <CardTitle className="text-lg mb-2">
            <div className="flex items-center gap-2">
              Upload Supplier Invoices
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                <Sparkles className="mr-1 h-3 w-3" />
                AI-Powered
              </Badge>
            </div>
          </CardTitle>
          <CardDescription className="text-center">
            Drag and drop PDF, JPG, or PNG files here, or click to browse.<br />
            Invoice details will be automatically extracted using AI.<br />
            Maximum file size: 10MB per file
          </CardDescription>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileInput}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* File List */}
      <AnimatePresence>
        {uploadFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Files to Upload ({uploadFiles.length})</h3>
              <div className="space-x-2">
                {uploadFiles.length > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowBulkDialog(true)}
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    Bulk Settings
                  </Button>
                )}
                <Button 
                  onClick={uploadAllFiles}
                  disabled={uploadFiles.every(f => f.status !== 'pending' && f.status !== 'extracted')}
                >
                  Upload All
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {uploadFiles.map((uploadFileItem) => {
                const IconComponent = getFileIcon(uploadFileItem.file)
                
                return (
                  <motion.div
                    key={uploadFileItem.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border rounded-lg p-4 bg-white shadow-sm"
                  >
                    <div className="flex items-start space-x-4">
                      {/* File Preview/Icon */}
                      <div className="flex-shrink-0">
                        {uploadFileItem.preview ? (
                          <img 
                            src={uploadFileItem.preview} 
                            alt={uploadFileItem.file.name}
                            className="w-16 h-16 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center">
                            <IconComponent className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* File Details */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{uploadFileItem.file.name}</h4>
                            <p className="text-xs text-gray-500">
                              {(uploadFileItem.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {uploadFileItem.status === 'extracting' && (
                              <Badge variant="default" className="bg-purple-100 text-purple-800">
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Extracting...
                              </Badge>
                            )}
                            {uploadFileItem.status === 'extracted' && uploadFileItem.extractedData && (
                              getConfidenceBadge(uploadFileItem.extractedData.confidence)
                            )}
                            {uploadFileItem.status === 'pending' && (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                            {uploadFileItem.status === 'uploading' && (
                              <Badge variant="default">Uploading...</Badge>
                            )}
                            {uploadFileItem.status === 'success' && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Success
                              </Badge>
                            )}
                            {uploadFileItem.status === 'error' && (
                              <Badge variant="destructive">
                                <AlertCircle className="mr-1 h-3 w-3" />
                                Error
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(uploadFileItem.id)}
                              disabled={uploadFileItem.status === 'uploading' || uploadFileItem.status === 'extracting'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* File Form Fields */}
                        {uploadFileItem.status !== 'success' && uploadFileItem.status !== 'extracting' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Supplier *</Label>
                                <Select 
                                  value={uploadFileItem.supplierId || 'no-supplier'} 
                                  onValueChange={(value) => {
                                    updateFileData(uploadFileItem.id, { 
                                      supplierId: value === 'no-supplier' ? undefined : value,
                                      isManuallyEdited: true 
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select supplier" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no-supplier">Select Supplier</SelectItem>
                                    {suppliers.map((supplier) => (
                                      <SelectItem key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {uploadFileItem.extractedData?.supplierName && !uploadFileItem.supplierId && (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Extracted: {uploadFileItem.extractedData.supplierName} (not found in system)
                                  </p>
                                )}
                              </div>

                              <div>
                                <Label className="text-xs">Invoice Number</Label>
                                <Input
                                  type="text"
                                  placeholder="INV-001"
                                  value={uploadFileItem.invoiceNumber || ''}
                                  onChange={(e) => {
                                    updateFileData(uploadFileItem.id, { 
                                      invoiceNumber: e.target.value,
                                      isManuallyEdited: true 
                                    })
                                  }}
                                  className="h-8"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Invoice Date</Label>
                                <Input
                                  type="date"
                                  value={uploadFileItem.invoiceDate || ''}
                                  onChange={(e) => {
                                    updateFileData(uploadFileItem.id, { 
                                      invoiceDate: e.target.value,
                                      isManuallyEdited: true 
                                    })
                                  }}
                                  className="h-8"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Subtotal (Before Tax) *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={uploadFileItem.subtotal || ''}
                                  onChange={(e) => {
                                    const subtotal = parseFloat(e.target.value) || 0
                                    const tax = parseFloat(uploadFileItem.taxAmount || '0') || 0
                                    const total = subtotal + tax
                                    updateFileData(uploadFileItem.id, { 
                                      subtotal: e.target.value,
                                      amount: total > 0 ? total.toFixed(2) : '',
                                      isManuallyEdited: true 
                                    })
                                  }}
                                  className="h-8"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Tax Amount</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={uploadFileItem.taxAmount || ''}
                                  onChange={(e) => {
                                    const tax = parseFloat(e.target.value) || 0
                                    const subtotal = parseFloat(uploadFileItem.subtotal || '0') || 0
                                    const total = subtotal + tax
                                    updateFileData(uploadFileItem.id, { 
                                      taxAmount: e.target.value,
                                      amount: total > 0 ? total.toFixed(2) : '',
                                      isManuallyEdited: true 
                                    })
                                  }}
                                  className="h-8"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Total Amount (After Tax) *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={uploadFileItem.amount || ''}
                                  onChange={(e) => {
                                    updateFileData(uploadFileItem.id, { 
                                      amount: e.target.value,
                                      isManuallyEdited: true 
                                    })
                                  }}
                                  className="h-8"
                                  readOnly
                                  disabled
                                />
                              </div>

                              <div className="md:col-span-2">
                                <Label className="text-xs">Budget Category</Label>
                                <Select 
                                  value={uploadFileItem.budgetCategoryId || 'no-category'} 
                                  onValueChange={(value) => {
                                    updateFileData(uploadFileItem.id, { 
                                      budgetCategoryId: value === 'no-category' ? undefined : value,
                                      isManuallyEdited: true 
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no-category">No Category</SelectItem>
                                    {/* System Categories */}
                                    {SYSTEM_BUDGET_CATEGORIES.map((category) => (
                                      <SelectItem key={category.value} value={category.value}>
                                        {category.label}
                                      </SelectItem>
                                    ))}
                                    {/* Custom Categories */}
                                    {budgetCategories.map((category) => (
                                      <SelectItem 
                                        key={category.id} 
                                        value={category.customCategory?.id || category.id}
                                      >
                                        {category.customCategory?.name || category.name} ({category.customCategory?.code || category.code})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Notes */}
                            <div>
                              <Label className="text-xs">Notes</Label>
                              <Textarea
                                placeholder="Additional notes..."
                                value={uploadFileItem.notes || ''}
                                onChange={(e) => {
                                  updateFileData(uploadFileItem.id, { 
                                    notes: e.target.value,
                                    isManuallyEdited: true 
                                  })
                                }}
                                className="h-16 text-xs"
                              />
                            </div>

                            {/* Extracted Line Items Display */}
                            {uploadFileItem.extractedData?.lineItems && uploadFileItem.extractedData.lineItems.length > 0 && (
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <Label className="text-xs font-semibold mb-2 block">Extracted Line Items</Label>
                                <div className="space-y-1">
                                  {uploadFileItem.extractedData.lineItems.map((item, idx) => (
                                    <div key={idx} className="text-xs flex justify-between">
                                      <span className="text-gray-700">{item.description}</span>
                                      <span className="font-medium">${item.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Error Message */}
                        {uploadFileItem.status === 'error' && uploadFileItem.errorMessage && (
                          <div className="text-red-600 text-xs bg-red-50 p-2 rounded">
                            {uploadFileItem.errorMessage}
                          </div>
                        )}

                        {/* Upload Button */}
                        {(uploadFileItem.status === 'pending' || uploadFileItem.status === 'extracted') && (
                          <div className="flex items-center justify-between">
                            <Button 
                              size="sm" 
                              onClick={() => uploadFile(uploadFileItem)}
                              disabled={!uploadFileItem.supplierId || !uploadFileItem.subtotal}
                            >
                              Upload File
                            </Button>
                            {uploadFileItem.isManuallyEdited && (
                              <Badge variant="outline" className="text-xs">
                                <Edit className="mr-1 h-3 w-3" />
                                Manually Edited
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Settings Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Bulk Settings</DialogTitle>
            <DialogDescription>
              Apply common settings to all uploaded files. Individual file settings will override these values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Default Supplier</Label>
              <Select 
                value={bulkSettings.supplierId || 'no-supplier'} 
                onValueChange={(value) => setBulkSettings(prev => ({ ...prev, supplierId: value === 'no-supplier' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-supplier">Select Supplier</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Default Budget Category</Label>
              <Select 
                value={bulkSettings.budgetCategoryId || 'no-category'} 
                onValueChange={(value) => setBulkSettings(prev => ({ ...prev, budgetCategoryId: value === 'no-category' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-category">No Category</SelectItem>
                  {SYSTEM_BUDGET_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                  {budgetCategories.map((category) => (
                    <SelectItem 
                      key={category.id} 
                      value={category.customCategory?.id || category.id}
                    >
                      {category.customCategory?.name || category.name} ({category.customCategory?.code || category.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Default Notes</Label>
              <Textarea
                placeholder="Common notes for all files..."
                value={bulkSettings.notes}
                onChange={(e) => setBulkSettings(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                Cancel
              </Button>
              <Button onClick={applyBulkSettings}>
                Apply Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
