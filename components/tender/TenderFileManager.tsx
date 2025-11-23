'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Folder,
  File,
  RefreshCw,
  AlertCircle,
  FolderPlus,
  Home,
  ChevronRight,
  ArrowLeft
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TenderFile {
  name: string
  size: number
  isDirectory: boolean
  createdAt: string
  modifiedAt: string
  extension: string
}

interface TenderFileManagerProps {
  tenderId: string
  tenderNumber?: string
  tenderTitle?: string
  customerName?: string
}

export function TenderFileManager({ 
  tenderId, 
  tenderNumber, 
  tenderTitle,
  customerName 
}: TenderFileManagerProps) {
  const [files, setFiles] = useState<TenderFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [deleteItem, setDeleteItem] = useState<string | null>(null)
  const [nasPath, setNasPath] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string>('')
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([])
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Fetch files from NAS
  const fetchFiles = useCallback(async (subPath: string = '') => {
    try {
      setLoading(true)
      const url = `/api/tenders/files?tenderId=${tenderId}${subPath ? `&subPath=${encodeURIComponent(subPath)}` : ''}`
      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        setFiles(data.files || [])
        setNasPath(data.tender?.nasPath || '')
        setCurrentPath(data.currentPath || '')
        setBreadcrumbs(data.breadcrumbs || [])
      } else {
        toast.error(data.error || 'Failed to load files')
      }
    } catch (error) {
      console.error('Error fetching files:', error)
      toast.error('Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [tenderId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // Navigate to folder
  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}\\${folderName}` : folderName
    fetchFiles(newPath)
  }

  // Navigate to breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Navigate to root
      fetchFiles('')
    } else {
      // Navigate to specific breadcrumb
      const newPath = breadcrumbs.slice(0, index + 1).join('\\')
      fetchFiles(newPath)
    }
  }

  // Go back to parent folder
  const goBack = () => {
    if (breadcrumbs.length > 0) {
      navigateToBreadcrumb(breadcrumbs.length - 2)
    }
  }

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name')
      return
    }

    try {
      const response = await fetch('/api/tenders/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenderId,
          folderName: newFolderName,
          subPath: currentPath
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Folder created successfully')
        setShowCreateFolder(false)
        setNewFolderName('')
        fetchFiles(currentPath)
      } else {
        toast.error(data.error || 'Failed to create folder')
      }
    } catch (error) {
      console.error('Create folder error:', error)
      toast.error('Failed to create folder')
    }
  }

  // Handle file upload
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    setUploading(true)
    const uploadPromises = Array.from(fileList).map(async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tenderId', tenderId)
      formData.append('subPath', currentPath)

      try {
        const response = await fetch('/api/tenders/files', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (response.ok) {
          toast.success(`${file.name} uploaded successfully`)
          return true
        } else {
          toast.error(`Failed to upload ${file.name}: ${data.error}`)
          return false
        }
      } catch (error) {
        console.error('Upload error:', error)
        toast.error(`Failed to upload ${file.name}`)
        return false
      }
    })

    await Promise.all(uploadPromises)
    setUploading(false)
    fetchFiles(currentPath)
  }

  // Handle delete
  const handleDelete = async (filename: string) => {
    try {
      const response = await fetch('/api/tenders/files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenderId, filename, subPath: currentPath }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        fetchFiles(currentPath)
      } else {
        toast.error(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete')
    }
    setDeleteItem(null)
  }

  // Handle file download
  const handleDownload = (filename: string) => {
    const subPathParam = currentPath ? `&subPath=${encodeURIComponent(currentPath)}` : ''
    const url = `/api/tenders/files/download?tenderId=${tenderId}&filename=${encodeURIComponent(filename)}${subPathParam}`
    window.open(url, '_blank')
  }

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Get file icon
  const getFileIcon = (file: TenderFile) => {
    if (file.isDirectory) {
      return <Folder className="h-5 w-5 text-yellow-500" />
    }
    
    const iconMap: Record<string, string> = {
      '.pdf': 'text-red-500',
      '.doc': 'text-blue-500',
      '.docx': 'text-blue-500',
      '.xls': 'text-green-500',
      '.xlsx': 'text-green-500',
      '.txt': 'text-gray-500',
      '.jpg': 'text-purple-500',
      '.jpeg': 'text-purple-500',
      '.png': 'text-purple-500',
    }

    const colorClass = iconMap[file.extension] || 'text-gray-500'
    return <File className={`h-5 w-5 ${colorClass}`} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle>Documents</CardTitle>
            {nasPath && (
              <p className="text-xs text-muted-foreground mt-1">
                📁 {nasPath}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchFiles(currentPath)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateFolder(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mt-3 text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            disabled={breadcrumbs.length === 0}
            className="h-7 px-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToBreadcrumb(-1)}
            className="h-7 px-2"
          >
            <Home className="h-4 w-4" />
          </Button>
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateToBreadcrumb(index)}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                {crumb}
              </Button>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* Drag and Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 mb-4 transition-colors ${
            dragActive 
              ? 'border-red-500 bg-red-50 dark:bg-red-950' 
              : 'border-gray-300 dark:border-gray-700'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop files here, or click Upload button
            </p>
            <p className="text-xs text-muted-foreground">
              Supports all file types
            </p>
          </div>
        </div>

        {/* File List */}
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading files...</p>
          </div>
        ) : files.length > 0 ? (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onDoubleClick={() => file.isDirectory && navigateToFolder(file.name)}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(file)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.isDirectory ? 'Folder' : formatFileSize(file.size)} • Modified {format(new Date(file.modifiedAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {file.isDirectory ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToFolder(file.name)}
                    >
                      Open
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file.name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteItem(file.name)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-muted-foreground">No documents uploaded yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload files using the button above or drag and drop them here
            </p>
          </div>
        )}
      </CardContent>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} className="bg-red-600 hover:bg-red-700">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && handleDelete(deleteItem)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

