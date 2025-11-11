
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "sonner"
import { 
  FileText, 
  Upload, 
  Loader2 
} from "lucide-react"
import { DOCUMENT_TYPE_LABELS } from "@/lib/document-utils"
import { ProjectDocumentType, ProjectDocumentStatus } from "@prisma/client"

interface EditDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: any
  projectId: string
  onDocumentUpdated: () => void
}

export function EditDocumentDialog({
  open,
  onOpenChange,
  document,
  projectId,
  onDocumentUpdated,
}: EditDocumentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [templateData, setTemplateData] = useState('')

  useEffect(() => {
    if (document) {
      setTitle(document.title || '')
      setDescription(document.description || '')
      setTemplateData(document.templateData ? JSON.stringify(document.templateData, null, 2) : '')
      setFile(null)
    }
  }, [document])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!document || !title.trim()) {
      toast.error('Title is required')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      
      if (file) {
        formData.append('file', file)
      }
      
      if (templateData.trim()) {
        formData.append('templateData', templateData)
      }

      const response = await fetch(`/api/projects/${projectId}/documents/${document.id}`, {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update document')
      }

      toast.success('Document updated successfully')
      onDocumentUpdated()
      onOpenChange(false)
      
      // Reset form
      setTitle('')
      setDescription('')
      setTemplateData('')
      setFile(null)
    } catch (error: any) {
      console.error('Error updating document:', error)
      toast.error(error.message || 'Failed to update document')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
  }

  if (!document) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit Document
          </DialogTitle>
          <DialogDescription>
            Update the document details. Changes will create a new version if the document is approved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Document Type (Read-only) */}
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Input
              value={DOCUMENT_TYPE_LABELS[document.documentType as ProjectDocumentType]}
              disabled
              className="bg-gray-50"
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Document description"
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="edit-file">Replace File (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="edit-file"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              />
              <Upload className="h-4 w-4 text-gray-400" />
            </div>
            {document.filename && (
              <p className="text-sm text-gray-600">
                Current file: {document.filename}
              </p>
            )}
            {file && (
              <p className="text-sm text-green-600">
                New file selected: {file.name}
              </p>
            )}
          </div>

          {/* Template Data (if applicable) */}
          {document.templateData && (
            <div className="space-y-2">
              <Label htmlFor="edit-template-data">Template Data (JSON)</Label>
              <Textarea
                id="edit-template-data"
                value={templateData}
                onChange={(e) => setTemplateData(e.target.value)}
                placeholder="Template data in JSON format"
                rows={4}
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* Status Info */}
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              <strong>Current Status:</strong> {document.status.replace('_', ' ')}
              <br />
              <strong>Version:</strong> {document.version}
              {document.status !== 'DRAFT' && (
                <>
                  <br />
                  <em className="text-amber-600">
                    Note: Updating an approved document will create a new version in DRAFT status.
                  </em>
                </>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Document
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
