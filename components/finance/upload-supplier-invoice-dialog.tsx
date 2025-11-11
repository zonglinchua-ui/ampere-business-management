
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'

interface UploadSupplierInvoiceDialogProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (data: FormData) => Promise<void>
  suppliers?: Array<{ id: string; name: string }>
  projects?: Array<{ id: string; name: string; projectNumber: string }>
}

export function UploadSupplierInvoiceDialog({
  isOpen,
  onClose,
  onUpload,
  suppliers = [],
  projects = []
}: UploadSupplierInvoiceDialogProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    supplierId: '',
    amount: '',
    currency: 'SGD',
    projectId: '',
    poNumber: '',
    notes: ''
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type', {
          description: 'Please upload a PDF, JPG, or PNG file'
        })
        return
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error('File too large', {
          description: 'File size must be less than 10MB'
        })
        return
      }

      setSelectedFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }

    if (!formData.supplierId) {
      toast.error('Please select a supplier')
      return
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsUploading(true)

    try {
      const uploadData = new FormData()
      uploadData.append('file', selectedFile)
      uploadData.append('supplierId', formData.supplierId)
      uploadData.append('amount', formData.amount)
      uploadData.append('currency', formData.currency)
      if (formData.projectId) uploadData.append('projectId', formData.projectId)
      if (formData.poNumber) uploadData.append('poNumber', formData.poNumber)
      if (formData.notes) uploadData.append('notes', formData.notes)

      await onUpload(uploadData)

      // Reset form
      setSelectedFile(null)
      setFormData({
        supplierId: '',
        amount: '',
        currency: 'SGD',
        projectId: '',
        poNumber: '',
        notes: ''
      })

      toast.success('Supplier invoice uploaded successfully')
      onClose()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload invoice', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Supplier Invoice</DialogTitle>
          <DialogDescription>
            Upload a supplier invoice document and link it to a project and PO
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Invoice Document *</Label>
            <div className="border-2 border-dashed rounded-lg p-6 hover:border-blue-500 transition-colors cursor-pointer">
              <input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file" className="cursor-pointer">
                {selectedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        setSelectedFile(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, JPG, PNG (max 10MB)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplierId">Supplier *</Label>
            <Select
              value={formData.supplierId}
              onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(suppliers) ? suppliers : []).map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SGD">SGD (Singapore Dollar)</SelectItem>
                  <SelectItem value="USD">USD (US Dollar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project Link */}
          <div className="space-y-2">
            <Label htmlFor="projectId">Link to Project (Optional)</Label>
            <Select
              value={formData.projectId || "no-project"}
              onValueChange={(value) => setFormData({ ...formData, projectId: value === "no-project" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-project">No Project</SelectItem>
                {(Array.isArray(projects) ? projects : []).map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectNumber} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PO Number */}
          <div className="space-y-2">
            <Label htmlFor="poNumber">Purchase Order Number (Optional)</Label>
            <Input
              id="poNumber"
              placeholder="Enter PO number"
              value={formData.poNumber}
              onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any internal notes about this invoice"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading}>
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload Invoice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
