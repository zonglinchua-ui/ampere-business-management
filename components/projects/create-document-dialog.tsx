
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Upload, FileText, AlertCircle, Camera, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { 
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  getDocumentTypesByCategory,
  getCategoryForDocumentType
} from "@/lib/document-utils"
import { ProjectDocumentType, ProjectDocumentCategory } from "@prisma/client"
import { AIPhotoUpload } from "@/components/photos/ai-photo-upload"

interface AnalyzedPhoto {
  file: File
  preview: string
  analysis: {
    description: string
    suggestedTitle: string
  } | null
  customTitle: string
  customDescription: string
}

interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectDetails?: {
    projectNumber: string
    name: string
    description?: string | null
    clientName?: string
    location?: string
    startDate?: string | null
    endDate?: string | null
  }
  onDocumentCreated: () => void
  selectedTemplate?: any
  onTemplateCleared?: () => void
}

export function CreateDocumentDialog({ 
  open, 
  onOpenChange, 
  projectId,
  projectDetails, 
  onDocumentCreated,
  selectedTemplate,
  onTemplateCleared
}: CreateDocumentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    documentType: '' as ProjectDocumentType | '',
    title: '',
    description: '',
    requiresApproval: false,
    templateData: {} as Record<string, any>
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ProjectDocumentCategory | ''>('')
  const [analyzedPhotos, setAnalyzedPhotos] = useState<AnalyzedPhoto[]>([])
  const [uploadMode, setUploadMode] = useState<'file' | 'photos'>('file')

  // Function to generate initial template data with project information
  const generateInitialTemplateData = () => {
    const initialData: Record<string, any> = {}
    
    if (projectDetails) {
      // Pre-populate common project fields
      initialData['project-id'] = projectDetails.projectNumber || ''
      initialData['project-name'] = projectDetails.name || ''
      initialData['project-location'] = projectDetails.location || projectDetails.description || ''
      initialData['client-name'] = projectDetails.clientName || ''
      initialData['site-address'] = projectDetails.location || projectDetails.description || ''
      
      if (projectDetails.startDate) {
        initialData['project-start-date'] = projectDetails.startDate.split('T')[0] // Format as YYYY-MM-DD
        initialData['start-date'] = projectDetails.startDate.split('T')[0]
        initialData['effective-date'] = projectDetails.startDate.split('T')[0]
      }
      
      if (projectDetails.endDate) {
        initialData['project-end-date'] = projectDetails.endDate.split('T')[0]
        initialData['end-date'] = projectDetails.endDate.split('T')[0]
      }
      
      // Calculate project duration if both dates are available
      if (projectDetails.startDate && projectDetails.endDate) {
        const start = new Date(projectDetails.startDate)
        const end = new Date(projectDetails.endDate)
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        initialData['project-duration'] = `${diffDays} days`
      }
      
      // Add today's date for survey date, plan version, etc.
      const today = new Date().toISOString().split('T')[0]
      initialData['survey-date'] = today
      initialData['inspection-date'] = today
      initialData['report-date'] = today
      initialData['completion-date'] = today
    }
    
    return initialData
  }

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (selectedTemplate) {
        const initialTemplateData = generateInitialTemplateData()
        
        setFormData({
          documentType: selectedTemplate.templateType,
          title: `${selectedTemplate.name}${projectDetails?.name ? ` - ${projectDetails.name}` : ''}`,
          description: selectedTemplate.description || '',
          requiresApproval: true,
          templateData: initialTemplateData
        })
        setSelectedCategory(selectedTemplate.category)
      } else {
        // Even without a template, pre-populate project information in the description
        const projectDescription = projectDetails ? 
          `Document for project: ${projectDetails.name} (${projectDetails.projectNumber})\n` +
          `Client: ${projectDetails.clientName || 'N/A'}\n` +
          (projectDetails.location ? `Location: ${projectDetails.location}\n` : '') +
          (projectDetails.startDate ? `Start Date: ${new Date(projectDetails.startDate).toLocaleDateString()}\n` : '') +
          (projectDetails.endDate ? `End Date: ${new Date(projectDetails.endDate).toLocaleDateString()}` : '')
          : ''
        
        setFormData({
          documentType: '',
          title: projectDetails ? `Document - ${projectDetails.name}` : '',
          description: projectDescription,
          requiresApproval: false,
          templateData: {}
        })
        setSelectedCategory('')
      }
      setSelectedFile(null)
      setAnalyzedPhotos([])
      setUploadMode('file')
    }
  }, [open, selectedTemplate, projectDetails])

  // Update category when document type changes
  useEffect(() => {
    if (formData.documentType) {
      const category = getCategoryForDocumentType(formData.documentType)
      setSelectedCategory(category)
    }
  }, [formData.documentType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.documentType || !formData.title) {
      toast.error('Please provide document type and title')
      return
    }

    setLoading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('documentType', formData.documentType)
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('requiresApproval', formData.requiresApproval.toString())
      
      if (selectedTemplate) {
        formDataToSend.append('templateType', selectedTemplate.templateType)
        
        // Ensure templateData is valid before stringifying
        let templateDataToSend: Record<string, any> = {}
        if (formData.templateData && typeof formData.templateData === 'object') {
          // Filter out empty or null values
          Object.keys(formData.templateData).forEach(key => {
            const value = formData.templateData[key]
            if (value !== null && value !== undefined && value !== '') {
              templateDataToSend[key] = value
            }
          })
        }
        
        formDataToSend.append('templateData', JSON.stringify(templateDataToSend))
      }
      
      if (selectedFile) {
        formDataToSend.append('file', selectedFile)
      }
      
      // Handle photos
      if (analyzedPhotos.length > 0) {
        analyzedPhotos.forEach((photo, index) => {
          formDataToSend.append(`photo_${index}`, photo.file)
        })
        
        // Store photo descriptions
        const photoDescriptions = analyzedPhotos.map(photo => ({
          title: photo.customTitle,
          description: photo.customDescription,
          originalFilename: photo.file.name,
          size: photo.file.size,
          type: photo.file.type
        }))
        
        formDataToSend.append('photoDescriptions', JSON.stringify(photoDescriptions))
        formDataToSend.append('photoCount', analyzedPhotos.length.toString())
        formDataToSend.append('hasPhotos', 'true')
      }

      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        body: formDataToSend,
      })

      if (!response.ok) {
        let errorMessage = 'Failed to create document'
        try {
          const error = await response.json()
          console.error('Document creation error:', error)
          errorMessage = error.error || error.message || errorMessage
        } catch (parseError) {
          // If we can't parse the error response, log the raw response
          console.error('Error parsing response:', parseError)
          console.error('Response status:', response.status)
          console.error('Response statusText:', response.statusText)
          
          // Try to get response text instead
          try {
            const responseText = await response.text()
            console.error('Response text:', responseText)
            
            // Check if response contains common error messages
            if (responseText.includes('upstream')) {
              errorMessage = 'Server connection error. Please try again.'
            } else if (responseText.includes('JSON')) {
              errorMessage = 'Data format error. Please check your input and try again.'
            }
          } catch (textError) {
            console.error('Error getting response text:', textError)
          }
        }
        throw new Error(errorMessage)
      }

      toast.success('Document created successfully')
      onDocumentCreated()
      onOpenChange(false)
      
      if (onTemplateCleared) {
        onTemplateCleared()
      }
    } catch (error) {
      console.error('Error creating document:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create document')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      templateData: {
        ...prev.templateData,
        [fieldId]: value
      }
    }))
  }

  const renderTemplateField = (field: any) => {
    const value = formData.templateData[field.id] || ''

    switch (field.type) {
      case 'text':
        return (
          <Input
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.id, e.target.value)}
            required={field.required}
          />
        )
      
      case 'textarea':
        return (
          <Textarea
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.id, e.target.value)}
            required={field.required}
            rows={3}
          />
        )
      
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.id, e.target.value)}
            required={field.required}
          />
        )
      
      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={(val) => handleTemplateFieldChange(field.id, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: string) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={!!value}
              onCheckedChange={(checked) => handleTemplateFieldChange(field.id, checked)}
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.label}
            </Label>
          </div>
        )
      
      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.id, parseFloat(e.target.value) || '')}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        )
      
      default:
        return (
          <Input
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.id, e.target.value)}
            required={field.required}
          />
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedTemplate ? `Create ${selectedTemplate.name}` : 'Create Document'}
          </DialogTitle>
          <DialogDescription>
            {selectedTemplate 
              ? `Create a new document using the ${selectedTemplate.name} template`
              : 'Add a new document to this project'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={(value) => {
                      setSelectedCategory(value as ProjectDocumentCategory)
                      setFormData(prev => ({ ...prev, documentType: '' }))
                    }}
                    disabled={!!selectedTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedTemplate ? DOCUMENT_CATEGORY_LABELS[selectedCategory as ProjectDocumentCategory] : "Select category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documentType">Document Type</Label>
                  <Select 
                    value={formData.documentType} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, documentType: value as ProjectDocumentType }))}
                    disabled={!!selectedTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedTemplate ? DOCUMENT_TYPE_LABELS[formData.documentType as ProjectDocumentType] : "Select document type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCategory && getDocumentTypesByCategory(selectedCategory).map((type) => (
                        <SelectItem key={type} value={type}>
                          {DOCUMENT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter document title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter document description (optional)"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiresApproval"
                  checked={formData.requiresApproval}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresApproval: !!checked }))}
                />
                <Label htmlFor="requiresApproval" className="text-sm">
                  Requires approval before completion
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Template Fields */}
          {selectedTemplate && selectedTemplate.fields && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Template Fields</CardTitle>
                <CardDescription>
                  Fill in the required information for this template
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTemplate.sections ? (
                  selectedTemplate.sections.map((section: any, sectionIndex: number) => (
                    <div key={sectionIndex} className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-sm">{section.title}</h4>
                        <Separator className="flex-1" />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        {section.fields.map((fieldId: string) => {
                          const field = selectedTemplate.fields.find((f: any) => f.id === fieldId)
                          if (!field) return null

                          return (
                            <div key={field.id} className="space-y-2">
                              <Label htmlFor={field.id} className="text-sm">
                                {field.label}
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                              </Label>
                              {renderTemplateField(field)}
                            </div>
                          )
                        })}
                      </div>
                      
                      {sectionIndex < selectedTemplate.sections.length - 1 && (
                        <Separator className="my-6" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {selectedTemplate.fields.map((field: any) => (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id} className="text-sm">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {renderTemplateField(field)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* File Upload and Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attachments</CardTitle>
              <CardDescription>
                Upload files or add AI-analyzed photos to this document
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Mode Toggle */}
              <div className="flex items-center space-x-4 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('file')
                    setAnalyzedPhotos([])
                  }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    uploadMode === 'file'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload File</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('photos')
                    setSelectedFile(null)
                  }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    uploadMode === 'photos'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  <Sparkles className="h-4 w-4" />
                  <span>AI Photos</span>
                </button>
              </div>

              {/* File Upload Mode */}
              {uploadMode === 'file' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (MAX. 10MB)</p>
                      </div>
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  
                  {selectedFile && (
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-gray-600">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* AI Photos Mode */}
              {uploadMode === 'photos' && (
                <AIPhotoUpload
                  onPhotosAnalyzed={setAnalyzedPhotos}
                  documentType={formData.documentType}
                  context={`${formData.documentType ? DOCUMENT_TYPE_LABELS[formData.documentType as ProjectDocumentType] : 'construction project'}`}
                  maxPhotos={10}
                  disabled={loading}
                />
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Document'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
