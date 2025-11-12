'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  FolderOpen,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  HardDrive,
  FolderUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface TenderFile {
  name: string
  size: number
  modifiedAt: string
  type: string
}

interface TenderFileManagerProps {
  tenderId: string
  tenderTitle: string
  customerName: string
  nasPath?: string
}

export function TenderFileManager({
  tenderId,
  tenderTitle,
  customerName,
  nasPath,
}: TenderFileManagerProps) {
  const [files, setFiles] = useState<TenderFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')

  // Load files on mount
  useEffect(() => {
    if (tenderId) {
      loadFiles()
    }
  }, [tenderId])

  const loadFiles = async () => {
    if (!tenderId) {
      console.error('TenderFileManager: tenderId is required')
      toast.error('Tender ID is missing')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/tenders/${tenderId}/files`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to load files')
      }
    } catch (error) {
      console.error('Error loading files:', error)
      toast.error('Error loading files')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      setSelectedFiles(files)
    }
  }

  const handleUpload = async (filesToUpload?: FileList) => {
    const files = filesToUpload || selectedFiles
    
    if (!files || files.length === 0) {
      toast.error('Please select files first')
      return
    }

    if (!tenderId) {
      toast.error('Tender ID is missing')
      return
    }

    setUploading(true)
    setUploadProgress(`Uploading 0/${files.length} files...`)
    
    try {
      let successCount = 0
      let failCount = 0

      // Upload files one by one
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`)

        const formData = new FormData()
        formData.append('file', file)

        try {
          const response = await fetch(`/api/tenders/${tenderId}/files`, {
            method: 'POST',
            body: formData,
          })

          if (response.ok) {
            successCount++
          } else {
            const error = await response.json()
            console.error(`Failed to upload ${file.name}:`, error.error)
            failCount++
          }
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error)
          failCount++
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`)
      }
      if (failCount > 0) {
        toast.error(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`)
      }

      setSelectedFiles(null)
      setUploadProgress('')
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      // Reload files
      await loadFiles()
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error('Error uploading files')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const handleDownload = async (filename: string) => {
    if (!tenderId) {
      toast.error('Tender ID is missing')
      return
    }

    try {
      const response = await fetch(
        `/api/tenders/${tenderId}/files?filename=${encodeURIComponent(filename)}`
      )
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('File downloaded')
      } else {
        toast.error('Failed to download file')
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Error downloading file')
    }
  }

  const handleDelete = async () => {
    if (!fileToDelete || !tenderId) return

    try {
      const response = await fetch(
        `/api/tenders/${tenderId}/files?filename=${encodeURIComponent(fileToDelete)}`,
        {
          method: 'DELETE',
        }
      )

      if (response.ok) {
        toast.success('File deleted successfully')
        setFileToDelete(null)
        await loadFiles()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('Error deleting file')
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const items = e.dataTransfer.items
    const files: File[] = []

    if (items) {
      // Handle DataTransferItemList
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry()
          if (entry) {
            await traverseFileTree(entry, files)
          }
        }
      }
    } else {
      // Fallback to files
      const droppedFiles = e.dataTransfer.files
      for (let i = 0; i < droppedFiles.length; i++) {
        files.push(droppedFiles[i])
      }
    }

    if (files.length > 0) {
      // Create a FileList-like object
      const dataTransfer = new DataTransfer()
      files.forEach(file => dataTransfer.items.add(file))
      setSelectedFiles(dataTransfer.files)
      
      // Automatically upload the dropped files
      await handleUpload(dataTransfer.files)
    }
  }

  // Recursively traverse folder structure
  const traverseFileTree = async (entry: any, files: File[]): Promise<void> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          files.push(file)
          resolve()
        })
      })
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries: any[]) => {
          for (const entry of entries) {
            await traverseFileTree(entry, files)
          }
          resolve()
        })
      })
    }
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    
    switch (ext) {
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
        return <FileText className="h-5 w-5 text-blue-500" />
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return <FileImage className="h-5 w-5 text-green-500" />
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
      default:
        return <File className="h-5 w-5 text-gray-500" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Show error if tenderId is missing
  if (!tenderId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Configuration Error</CardTitle>
          <CardDescription>
            Tender ID is required for the file manager to work properly.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Tender Documents</CardTitle>
                <CardDescription className="mt-1">
                  {nasPath || `A:\\AMPERE WEB SERVER\\TENDER\\${customerName}\\${tenderTitle}\\`}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFiles}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Upload Section with Drag & Drop */}
          <div 
            className={`mb-6 p-6 border-2 border-dashed rounded-lg transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 bg-muted/50'
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderUp className="h-5 w-5" />
                <p className="text-sm font-medium">
                  {isDragging 
                    ? 'Drop files or folders here' 
                    : 'Drag and drop files or folders here, or click to browse'}
                </p>
              </div>
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <Input
                    id="file-upload"
                    type="file"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    multiple
                    webkitdirectory=""
                    directory=""
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Select multiple files or an entire folder
                  </p>
                </div>
                <Button
                  onClick={() => handleUpload()}
                  disabled={!selectedFiles || uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
              {selectedFiles && selectedFiles.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                </p>
              )}
              {uploadProgress && (
                <p className="text-sm font-medium text-primary">
                  {uploadProgress}
                </p>
              )}
            </div>
          </div>

          {/* Files Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No files yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your first document to get started
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[120px]">Size</TableHead>
                    <TableHead className="w-[180px]">Modified</TableHead>
                    <TableHead className="w-[180px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.name}>
                      <TableCell>{getFileIcon(file.name)}</TableCell>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(file.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(file.modifiedAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFileToDelete(file.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

