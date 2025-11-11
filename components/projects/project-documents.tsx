
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Download, 
  Upload, 
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Archive,
  Send,
  Edit,
  Trash2,
  Eye,
  History,
  Package,
  AlertCircle,
  FileCheck,
  FileX
} from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { 
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_CONFIG,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_COLORS,
  getDocumentTypesByCategory,
  formatFileSize,
} from "@/lib/document-utils"
import { parseDocumentNumber, getDocumentTypeNameFromCode } from "@/lib/document-numbering"
import { ProjectDocumentType, ProjectDocumentStatus, ProjectDocumentCategory } from "@prisma/client"
import { CreateDocumentDialog } from "./create-document-dialog"
import { DocumentTemplateDialog } from "./document-template-dialog"
import { DocumentViewer } from "./document-viewer"
import { EditDocumentDialog } from "./edit-document-dialog"

interface ProjectDocument {
  id: string
  projectId: string
  documentNumber?: string
  documentType: ProjectDocumentType
  title: string
  description?: string
  status: ProjectDocumentStatus
  category: ProjectDocumentCategory
  version: number
  cloudStoragePath?: string
  filename?: string
  originalName?: string
  mimetype?: string
  size?: number
  templateType?: string
  templateData?: any
  requiresApproval: boolean
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name?: string
    firstName?: string
    lastName?: string
    email: string
  }
  approvedBy?: {
    id: string
    name?: string
    firstName?: string
    lastName?: string
    email: string
  }
  submittedBy?: {
    id: string
    name?: string
    firstName?: string
    lastName?: string
    email: string
  }
  versions?: Array<{
    id: string
    version: number
    status: string
    createdAt: string
    createdBy: {
      name?: string
      firstName?: string
      lastName?: string
    }
  }>
}

interface ProjectDocumentsProps {
  projectId: string
  userRole: string
  projectDetails?: {
    projectNumber: string
    name: string
    description?: string | null
    customerName?: string
    location?: string
    startDate?: string | null
    endDate?: string | null
  }
}

export function ProjectDocuments({ projectId, userRole, projectDetails }: ProjectDocumentsProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [documentToEdit, setDocumentToEdit] = useState<ProjectDocument | null>(null)

  const canCreateEdit = ['SUPERADMIN', 'PROJECT_MANAGER', 'ADMIN'].includes(userRole)
  const canApprove = ['SUPERADMIN', 'PROJECT_MANAGER', 'ADMIN'].includes(userRole)
  const isSuperAdmin = userRole === 'SUPERADMIN'

  useEffect(() => {
    fetchDocuments()
  }, [projectId, selectedCategory, selectedStatus])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory)
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus)

      const response = await fetch(`/api/projects/${projectId}/documents?${params}`)
      if (!response.ok) throw new Error('Failed to fetch documents')
      
      const data = await response.json()
      setDocuments(data)
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast.error('Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (documentId: string, newStatus: ProjectDocumentStatus, rejectionReason?: string) => {
    try {
      const formData = new FormData()
      formData.append('status', newStatus)
      if (rejectionReason) {
        formData.append('rejectionReason', rejectionReason)
      }

      const response = await fetch(`/api/projects/${projectId}/documents/${documentId}`, {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to update document')

      toast.success(`Document ${newStatus.toLowerCase()} successfully`)
      fetchDocuments()
    } catch (error) {
      console.error('Error updating document:', error)
      toast.error('Failed to update document')
    }
  }

  const handleDownload = async (documentId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/documents/${documentId}/download`)
      if (!response.ok) throw new Error('Failed to generate download URL')
      
      const { downloadUrl, filename } = await response.json()
      
      // Create a temporary link and trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'document'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading document:', error)
      toast.error('Failed to download document')
    }
  }

  const handleDelete = async (documentId: string) => {
    // Find the document to get its status for confirmation message
    const document = documents.find(doc => doc.id === documentId)
    const isApprovedDocument = document && document.status !== 'DRAFT'
    
    let confirmMessage = 'Are you sure you want to delete this document? This action cannot be undone.'
    if (isSuperAdmin && isApprovedDocument) {
      confirmMessage = 'As a superadmin, you are about to delete an approved/submitted document. This action cannot be undone and may affect project records. Are you sure you want to proceed?'
    }
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete document')
      }

      toast.success('Document deleted successfully')
      fetchDocuments()
    } catch (error: any) {
      console.error('Error deleting document:', error)
      toast.error(error.message || 'Failed to delete document')
    }
  }

  const handleViewDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/documents/${documentId}`)
      if (!response.ok) throw new Error('Failed to fetch document details')
      
      const documentData = await response.json()
      setSelectedDocument(documentData)
      setViewerOpen(true)
    } catch (error) {
      console.error('Error fetching document details:', error)
      toast.error('Failed to load document details')
    }
  }

  const handleEditDocument = (document: ProjectDocument) => {
    setDocumentToEdit(document)
    setEditDialogOpen(true)
  }

  const handleBulkExport = async (packageType: string) => {
    const approvedDocs = documents.filter(doc => doc.status === 'APPROVED')
    if (!approvedDocs.length) {
      toast.error('No approved documents available for export')
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/documents/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageType,
          documentIds: approvedDocs.map(doc => doc.id),
        }),
      })

      if (!response.ok) throw new Error('Failed to create document package')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${packageType}_Package.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(`${packageType} package exported successfully`)
    } catch (error) {
      console.error('Error exporting documents:', error)
      toast.error('Failed to export documents')
    }
  }

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    DOCUMENT_TYPE_LABELS[doc.documentType].toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getUserDisplayName = (user: any) => {
    if (!user) return 'Unknown User'
    if (user.name) return user.name
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`
    if (user.firstName) return user.firstName
    return user.email
  }

  const getStatusIcon = (status: ProjectDocumentStatus) => {
    switch (status) {
      case 'DRAFT': return <FileText className="h-4 w-4" />
      case 'SUBMITTED': return <Send className="h-4 w-4" />
      case 'UNDER_REVIEW': return <Clock className="h-4 w-4" />
      case 'APPROVED': return <CheckCircle className="h-4 w-4" />
      case 'REJECTED': return <XCircle className="h-4 w-4" />
      case 'ARCHIVED': return <Archive className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Project Documents</h2>
          <p className="text-sm text-muted-foreground">
            Create structured documents with auto-generated numbers using professional templates
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {canCreateEdit && (
            <Button
              onClick={() => setTemplateDialogOpen(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Package className="h-4 w-4 mr-2" />
                Export Package
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleBulkExport('Handover')}>
                <Package className="h-4 w-4 mr-2" />
                Handover Package
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkExport('Compliance')}>
                <FileCheck className="h-4 w-4 mr-2" />
                Compliance Package
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkExport('Complete')}>
                <Archive className="h-4 w-4 mr-2" />
                Complete Package
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(DOCUMENT_STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents by Category */}
      <Tabs value={selectedCategory === 'all' ? 'all' : selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Documents</TabsTrigger>
          {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
            <TabsTrigger key={key} value={key} className="text-xs">
              {label.replace('&', '&')}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([categoryKey, categoryLabel]) => {
            const categoryDocs = filteredDocuments.filter(doc => doc.category === categoryKey)
            if (!categoryDocs.length) return null

            return (
              <Card key={categoryKey} className={DOCUMENT_CATEGORY_COLORS[categoryKey as ProjectDocumentCategory]}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{categoryLabel}</CardTitle>
                  <CardDescription>
                    {categoryDocs.length} document{categoryDocs.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {categoryDocs.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        document={doc}
                        canApprove={canApprove}
                        canCreateEdit={canCreateEdit}
                        isSuperAdmin={isSuperAdmin}
                        onStatusChange={handleStatusChange}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        onView={handleViewDocument}
                        onEdit={handleEditDocument}
                        getUserDisplayName={getUserDisplayName}
                        getStatusIcon={getStatusIcon}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([categoryKey, categoryLabel]) => (
          <TabsContent key={categoryKey} value={categoryKey} className="space-y-4">
            <div className="space-y-2">
              {filteredDocuments
                .filter(doc => doc.category === categoryKey)
                .map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    document={doc}
                    canApprove={canApprove}
                    canCreateEdit={canCreateEdit}
                    isSuperAdmin={isSuperAdmin}
                    onStatusChange={handleStatusChange}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    onView={handleViewDocument}
                    onEdit={handleEditDocument}
                    getUserDisplayName={getUserDisplayName}
                    getStatusIcon={getStatusIcon}
                  />
                ))
              }
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {filteredDocuments.length === 0 && !loading && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium">No documents yet</h3>
          <p className="mt-2 text-gray-600">
            Start by selecting a professional template to create your first document with auto-generated numbering.
          </p>
          {canCreateEdit && (
            <div className="mt-4">
              <Button onClick={() => setTemplateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Document
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create Document Dialog */}
      <CreateDocumentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectId={projectId}
        projectDetails={projectDetails}
        onDocumentCreated={fetchDocuments}
        selectedTemplate={selectedTemplate}
        onTemplateCleared={() => setSelectedTemplate(null)}
      />

      {/* Template Selection Dialog */}
      <DocumentTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onTemplateSelected={(template) => {
          setSelectedTemplate(template)
          setTemplateDialogOpen(false)
          setCreateDialogOpen(true)
        }}
      />

      {/* Document Viewer */}
      <DocumentViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        document={selectedDocument}
        canEdit={canCreateEdit}
      />

      {/* Edit Document Dialog */}
      <EditDocumentDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        document={documentToEdit}
        projectId={projectId}
        onDocumentUpdated={fetchDocuments}
      />
    </div>
  )
}

function DocumentRow({ 
  document, 
  canApprove, 
  canCreateEdit, 
  isSuperAdmin,
  onStatusChange, 
  onDownload, 
  onDelete, 
  onView,
  onEdit,
  getUserDisplayName, 
  getStatusIcon 
}: {
  document: ProjectDocument
  canApprove: boolean
  canCreateEdit: boolean
  isSuperAdmin: boolean
  onStatusChange: (id: string, status: ProjectDocumentStatus, reason?: string) => void
  onDownload: (id: string) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
  onEdit: (document: ProjectDocument) => void
  getUserDisplayName: (user: any) => string
  getStatusIcon: (status: ProjectDocumentStatus) => JSX.Element
}) {
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  return (
    <div 
      className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors cursor-pointer group"
      onClick={() => onView(document.id)}
    >
      <div className="flex items-center space-x-4 flex-1">
        <div className="flex items-center space-x-2">
          {getStatusIcon(document.status)}
          <Badge variant="outline" className={DOCUMENT_STATUS_CONFIG[document.status].color}>
            {DOCUMENT_STATUS_CONFIG[document.status].label}
          </Badge>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="font-medium group-hover:text-blue-600 transition-colors">{document.title}</h4>
            {document.documentNumber && (
              <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200">
                {document.documentNumber}
              </Badge>
            )}
            {document.version > 1 && (
              <Badge variant="secondary" className="text-xs">
                v{document.version}
              </Badge>
            )}
            {document.requiresApproval && document.status === 'DRAFT' && (
              <div className="relative group/tooltip">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200">
                  Requires approval
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {DOCUMENT_TYPE_LABELS[document.documentType]}
          </p>
          <div className="text-xs text-gray-500">
            Created by {getUserDisplayName(document.createdBy)} on {new Date(document.createdAt).toLocaleDateString()}
            {document.cloudStoragePath && document.size && (
              <> • {formatFileSize(document.size)}</>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
        {/* Submit for Approval - Only for DRAFT documents that require approval */}
        {canCreateEdit && document.status === 'DRAFT' && document.requiresApproval && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStatusChange(document.id, 'SUBMITTED')}
          >
            <Send className="h-4 w-4 mr-1" />
            Submit for Approval
          </Button>
        )}

        {/* Approve/Reject for SUBMITTED documents */}
        {canApprove && document.status === 'SUBMITTED' && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(document.id, 'APPROVED')}
              className="text-green-600 hover:text-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRejectDialog(true)}
              className="text-red-600 hover:text-red-700"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </>
        )}

        {/* Direct Approve for DRAFT documents (no approval required OR approval permissions) */}
        {canApprove && document.status === 'DRAFT' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStatusChange(document.id, 'APPROVED')}
            className="text-green-600 hover:text-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve
          </Button>
        )}

        {/* Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(document.id)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            
            {document.cloudStoragePath && (
              <DropdownMenuItem onClick={() => onDownload(document.id)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
            )}
            
            {canCreateEdit && (
              <>
                <DropdownMenuItem onClick={() => onEdit(document)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            {document.versions && document.versions.length > 1 && (
              <DropdownMenuItem>
                <History className="h-4 w-4 mr-2" />
                View History
              </DropdownMenuItem>
            )}
            
            {((canCreateEdit && document.status === 'DRAFT') || isSuperAdmin) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(document.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectDialog(false)
                  setRejectionReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onStatusChange(document.id, 'REJECTED', rejectionReason)
                  setShowRejectDialog(false)
                  setRejectionReason('')
                }}
                disabled={!rejectionReason.trim()}
              >
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
