
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
  Trash2
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

interface UploadFile {
  id: string
  file: File
  preview?: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  errorMessage?: string
  supplierId?: string
  budgetCategoryId?: string
  amount?: string
  notes?: string
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

export function ProjectInvoiceUpload({ 
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

  const handleFiles = async (files: FileList) => {
    const newFiles: UploadFile[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const validation = validateFile(file)
      
      if (validation.isValid) {
        const preview = await generateFilePreview(file)
        newFiles.push({
          id: `${Date.now()}-${i}`,
          file,
          preview,
          status: 'pending'
        })
      } else {
        toast.error(`${file.name}: ${validation.error}`)
      }
    }
    
    setUploadFiles(prev => [...prev, ...newFiles])
    
    if (newFiles.length > 1) {
      setShowBulkDialog(true)
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
    if (!uploadFileItem.supplierId || !uploadFileItem.amount) {
      updateFileData(uploadFileItem.id, { 
        status: 'error', 
        errorMessage: 'Supplier and amount are required' 
      })
      return
    }

    updateFileData(uploadFileItem.id, { status: 'uploading' })

    try {
      const formData = new FormData()
      formData.append('file', uploadFileItem.file)
      formData.append('projectId', projectId)
      formData.append('supplierId', uploadFileItem.supplierId)
      formData.append('amount', uploadFileItem.amount)
      formData.append('budgetCategoryId', uploadFileItem.budgetCategoryId || '')
      formData.append('notes', uploadFileItem.notes || '')
      
      const response = await fetch(`/api/projects/${projectId}/supplier-invoices/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
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
      updateFileData(uploadFileItem.id, { 
        status: 'error', 
        errorMessage: 'Upload failed. Please try again.' 
      })
      toast.error(`Failed to upload ${uploadFileItem.file.name}`)
    }
  }

  const uploadAllFiles = () => {
    uploadFiles.forEach(fileItem => {
      if (fileItem.status === 'pending') {
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
          <CardTitle className="text-lg mb-2">Upload Supplier Invoices</CardTitle>
          <CardDescription className="text-center">
            Drag and drop PDF, JPG, or PNG files here, or click to browse.<br />
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
                  disabled={uploadFiles.every(f => f.status !== 'pending')}
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
                              disabled={uploadFileItem.status === 'uploading'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* File Form Fields */}
                        {uploadFileItem.status !== 'success' && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">Supplier *</Label>
                              <Select 
                                value={uploadFileItem.supplierId || 'no-supplier'} 
                                onValueChange={(value) => updateFileData(uploadFileItem.id, { supplierId: value === 'no-supplier' ? undefined : value })}
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
                            </div>

                            <div>
                              <Label className="text-xs">Amount (SGD) *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={uploadFileItem.amount || ''}
                                onChange={(e) => updateFileData(uploadFileItem.id, { amount: e.target.value })}
                                className="h-8"
                              />
                            </div>

                            <div>
                              <Label className="text-xs">Budget Category</Label>
                              <Select 
                                value={uploadFileItem.budgetCategoryId || 'no-category'} 
                                onValueChange={(value) => updateFileData(uploadFileItem.id, { budgetCategoryId: value === 'no-category' ? undefined : value })}
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
                        )}

                        {/* Notes */}
                        {uploadFileItem.status !== 'success' && (
                          <div>
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                              placeholder="Additional notes..."
                              value={uploadFileItem.notes || ''}
                              onChange={(e) => updateFileData(uploadFileItem.id, { notes: e.target.value })}
                              className="h-16 text-xs"
                            />
                          </div>
                        )}

                        {/* Error Message */}
                        {uploadFileItem.status === 'error' && uploadFileItem.errorMessage && (
                          <div className="text-red-600 text-xs bg-red-50 p-2 rounded">
                            {uploadFileItem.errorMessage}
                          </div>
                        )}

                        {/* Upload Button */}
                        {uploadFileItem.status === 'pending' && (
                          <Button 
                            size="sm" 
                            onClick={() => uploadFile(uploadFileItem)}
                            disabled={!uploadFileItem.supplierId || !uploadFileItem.amount}
                          >
                            Upload File
                          </Button>
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
                value={bulkSettings.supplierId} 
                onValueChange={(value) => setBulkSettings(prev => ({ ...prev, supplierId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
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
