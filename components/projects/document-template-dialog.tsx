
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  FileCheck, 
  FileText, 
  AlertTriangle,
  Clipboard,
  Calendar,
  CheckCircle,
  Settings,
  DollarSign
} from "lucide-react"
import { toast } from "sonner"
import { 
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_COLORS
} from "@/lib/document-utils"
import { ProjectDocumentCategory } from "@prisma/client"

interface DocumentTemplate {
  id: string
  name: string
  templateType: string
  category: ProjectDocumentCategory
  description: string
  fields: any[]
  sections?: any[]
}

interface DocumentTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTemplateSelected: (template: DocumentTemplate | null) => void
}

export function DocumentTemplateDialog({ 
  open, 
  onOpenChange, 
  onTemplateSelected 
}: DocumentTemplateDialogProps) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/template-project/documents/templates`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast.error('Failed to fetch templates')
    } finally {
      setLoading(false)
    }
  }

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const getTemplateIcon = (templateType: string) => {
    switch (templateType) {
      case 'RISK_ASSESSMENT':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'WORK_METHOD_STATEMENT':
        return <Clipboard className="h-5 w-5 text-blue-500" />
      case 'INCIDENT_REPORT':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />
      case 'HANDOVER_FORM':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'TOOLBOX_MEETING':
        return <Settings className="h-5 w-5 text-purple-500" />
      case 'INSPECTION_CHECKLIST':
        return <FileCheck className="h-5 w-5 text-indigo-500" />
      case 'OPERATION_MAINTENANCE_MANUAL':
        return <Settings className="h-5 w-5 text-gray-500" />
      case 'DELIVERY_ORDER_JOB_COMPLETION':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />
      case 'PROGRESS_CLAIM':
        return <DollarSign className="h-5 w-5 text-green-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Document Template</DialogTitle>
          <DialogDescription>
            Choose a template to create a structured document with pre-defined fields
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Templates by Category */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All Templates</TabsTrigger>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="text-xs">
                  {label.replace('&', '&')}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-6">
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([categoryKey, categoryLabel]) => {
                const categoryTemplates = filteredTemplates.filter(template => template.category === categoryKey)
                if (!categoryTemplates.length) return null

                return (
                  <div key={categoryKey} className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-medium">{categoryLabel}</h3>
                      <Badge variant="secondary">{categoryTemplates.length}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onSelect={onTemplateSelected}
                          getIcon={getTemplateIcon}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </TabsContent>

            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([categoryKey, categoryLabel]) => (
              <TabsContent key={categoryKey} value={categoryKey} className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates
                    .filter(template => template.category === categoryKey)
                    .map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={onTemplateSelected}
                        getIcon={getTemplateIcon}
                      />
                    ))
                  }
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {filteredTemplates.length === 0 && !loading && (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium">No templates found</h3>
              <p className="mt-2 text-gray-600">
                Try adjusting your search terms or browse different categories.
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <Button 
              variant="ghost" 
              onClick={() => {
                onTemplateSelected(null)
                onOpenChange(false)
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Without Template
            </Button>
            
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TemplateCard({ 
  template, 
  onSelect, 
  getIcon 
}: { 
  template: DocumentTemplate
  onSelect: (template: DocumentTemplate) => void
  getIcon: (templateType: string) => JSX.Element
}) {
  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-all ${DOCUMENT_CATEGORY_COLORS[template.category]} hover:border-blue-300`}
      onClick={() => onSelect(template)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            {getIcon(template.templateType)}
            <Badge variant="outline" className="text-xs">
              {DOCUMENT_CATEGORY_LABELS[template.category]}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-base">{template.name}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-sm mb-3">
          {template.description}
        </CardDescription>
        
        {template.fields && (
          <div className="space-y-2">
            <div className="text-xs text-gray-600">
              {template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
              {template.sections && ` • ${template.sections.length} section${template.sections.length !== 1 ? 's' : ''}`}
            </div>
            
            <div className="flex flex-wrap gap-1">
              {template.fields.slice(0, 3).map((field, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {field.label}
                </Badge>
              ))}
              {template.fields.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.fields.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <Button 
          size="sm" 
          className="w-full mt-4"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(template)
          }}
        >
          Use Template
        </Button>
      </CardContent>
    </Card>
  )
}
