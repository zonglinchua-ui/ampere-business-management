
'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FileText,
  Download,
  Eye,
  Calendar,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  History,
  Edit
} from "lucide-react"
import { toast } from "sonner"
import { 
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_CONFIG,
  DOCUMENT_CATEGORY_LABELS,
  formatFileSize
} from "@/lib/document-utils"
import { ProjectDocumentType, ProjectDocumentStatus, ProjectDocumentCategory } from "@prisma/client"
import { ProjectPDFPreview } from "./project-pdf-preview"

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
  activities?: Array<{
    id: string
    action: string
    description?: string
    oldValue?: string
    newValue?: string
    userId: string
    userEmail: string
    createdAt: string
  }>
}

interface DocumentViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: ProjectDocument | null
  canEdit?: boolean
}

export function DocumentViewer({ 
  open, 
  onOpenChange, 
  document,
  canEdit = false
}: DocumentViewerProps) {
  const [loading, setLoading] = useState(false)

  if (!document) return null

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
      case 'SUBMITTED': return <Eye className="h-4 w-4" />
      case 'UNDER_REVIEW': return <Clock className="h-4 w-4" />
      case 'APPROVED': return <CheckCircle className="h-4 w-4" />
      case 'REJECTED': return <XCircle className="h-4 w-4" />
      case 'ARCHIVED': return <AlertCircle className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const handleDownload = async () => {
    if (!document.cloudStoragePath) {
      toast.error('No file attached to this document')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${document.projectId}/documents/${document.id}/download`)
      
      if (!response.ok) throw new Error('Failed to generate download URL')
      
      const { downloadUrl, filename } = await response.json()
      
      // Create a temporary link and trigger download
      const link = window.document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'document'
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading document:', error)
      toast.error('Failed to download document')
    } finally {
      setLoading(false)
    }
  }

  const openInNewTab = async () => {
    if (!document.cloudStoragePath) {
      toast.error('No file attached to this document')
      return
    }

    try {
      const response = await fetch(`/api/projects/${document.projectId}/documents/${document.id}/download`)
      
      if (!response.ok) throw new Error('Failed to generate download URL')
      
      const { downloadUrl } = await response.json()
      window.open(downloadUrl, '_blank')
    } catch (error) {
      console.error('Error opening document:', error)
      toast.error('Failed to open document')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center space-x-2">
                {getStatusIcon(document.status)}
                <span>{document.title}</span>
                {document.version > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    v{document.version}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {DOCUMENT_TYPE_LABELS[document.documentType]} • {DOCUMENT_CATEGORY_LABELS[document.category]}
              </DialogDescription>
            </div>

            <div className="flex items-center space-x-2">
              <Badge variant="outline" className={DOCUMENT_STATUS_CONFIG[document.status].color}>
                {DOCUMENT_STATUS_CONFIG[document.status].label}
              </Badge>
              
              {document.cloudStoragePath && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openInNewTab}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownload}
                    disabled={loading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </>
              )}

              {canEdit && (
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="preview">PDF Preview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Document Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {document.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{document.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Created By</h4>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{getUserDisplayName(document.createdBy)}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Created At</h4>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{new Date(document.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {document.approvedBy && document.approvedAt && (
                    <>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Approved By</h4>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{getUserDisplayName(document.approvedBy)}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Approved At</h4>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{new Date(document.approvedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {document.rejectedAt && document.rejectionReason && (
                    <div className="col-span-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rejection Reason</h4>
                      <div className="flex items-start space-x-2">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-red-600">{document.rejectionReason}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Rejected on {new Date(document.rejectedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {document.cloudStoragePath && document.size && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">File Information</h4>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{document.originalName || document.filename}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(document.size)} • {document.mimetype}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Template Data */}
            {document.templateData && Object.keys(document.templateData).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Template Data</CardTitle>
                  <CardDescription>
                    Information filled in using the {document.templateType} template
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(document.templateData).map(([key, value]) => (
                      <div key={key}>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {typeof value === 'object' ? JSON.stringify(value) : value?.toString() || 'Not specified'}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Version History */}
            {document.versions && document.versions.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <History className="h-5 w-5" />
                    <span>Version History</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {document.versions.map((version, index) => (
                      <div key={version.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                            v{version.version}
                            {index === 0 && " (Current)"}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">
                              Created by {getUserDisplayName(version.createdBy)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(version.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {version.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="preview">
            <ProjectPDFPreview
              documentId={document.id}
              documentNumber={document.documentNumber || 'DOC-' + document.id}
              documentTitle={document.title}
            />
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                {document.activities && document.activities.length > 0 ? (
                  <div className="space-y-3">
                    {document.activities.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3 p-3 border-l-2 border-gray-200">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.action}</p>
                          {activity.description && (
                            <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                          )}
                          {activity.oldValue && activity.newValue && (
                            <div className="text-xs text-gray-500 mt-1">
                              Changed from "{activity.oldValue}" to "{activity.newValue}"
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {activity.userEmail} • {new Date(activity.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No activity recorded yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
