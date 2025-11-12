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
  Folder,
  ChevronRight,
  Home,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface TenderFile {
  name: string
  size: number
  modifiedAt: string
  type: string
  isDirectory?: boolean
}

interface FileWithPath extends File {
  relativePath?: string
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
  const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string>('')

  // Load files on mount
  useEffect(() => {
    if (tenderId) {
      loadFiles()
    }
  }, [tenderId, currentPath])

  const loadFiles = async () => {
    if (!tenderId) {
      console.error('TenderFileManager: tenderId is required')
      toast.error('Tender ID is missing')
      return
    }

    setLoading(true)
    try {
      const url = `/api/tenders/${tenderId}/files${currentPath ? `?path=${encodeURIComponent(currentPath)}` : ''}`
      const response = await fetch(url)
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
    const fileList = event.target.files
    if (fileList && fileList.length > 0) {
      const filesArray: FileWithPath[] = Array.from(fileList).map(file => {
        const fileWithPath = file as FileWithPath
        // For regular file input, use just the filename
        fileWithPath.relativePath = currentPath ? `${currentPath}/${file.name}` : file.name
        return fileWithPath
      })
      setSelectedFiles(filesArray)
    }
  }

  const handleUpload = async (filesToUpload?: FileWithPath[]) => {
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
        const displayPath = file.relativePath || file.name
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${displayPath}`)

        const formData = new FormData()
        formData.append('file', file)
        // Send the relative path to preserve folder structure
        if (file.relativePath) {
          formData.append('relativePath', file.relativePath)
        }

        try {
          const response = await fetch(`/api/tenders/${tenderId}/files`, {
            method: 'POST',
            body: formData,
          })

          if (response.ok) {
            successCount++
          } else {
            const error = await response.json()
            console.error(`Failed to upload ${displayPath}:`, error.error)
            failCount++
          }
        } catch (error) {
          console.error(`Error uploading ${displayPath}:`, error)
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

      setSelectedFiles([])
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

  const handleItemClick = async (item: TenderFile) => {
    if (item.isDirectory) {
      // Navigate into folder
      setCurrentPath(item.name)
    } else {
      // Download file
      await handleDownload(item.name)
    }
  }

  const handleDownload = async (filename: string) => {
    if (!tenderId) {
      toast.error('Tender ID is missing')
      return
    }

    try {
      // Open file in new tab - browser will display if viewable, or download if not
      const url = `/api/tenders/${tenderId}/files?filename=${encodeURIComponent(filename)}`
      window.open(url, '_blank')
      toast.success('Opening file...')
    } catch (error) {
      console.error('Error opening file:', error)
      toast.error('Error opening file')
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

  const navigateToRoot = () => {
    setCurrentPath('')
  }

  const navigateUp = () => {
    const pathParts = currentPath.split('/').filter(Boolean)
    pathParts.pop()
    setCurrentPath(pathParts.join('/'))
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
    const files: FileWithPath[] = []

    if (items) {
      // Handle DataTransferItemList
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry()
          if (entry) {
            await traverseFileTree(entry, files, currentPath ? `${currentPath}/` : '')
          }
        }
      }
    } else {
      // Fallback to files
      const droppedFiles = e.dataTransfer.files
      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i] as FileWithPath
        file.relativePath = currentPath ? `${currentPath}/${file.name}` : file.name
        files.push(file)
      }
    }

    if (files.length > 0) {
      setSelectedFiles(files)
      
      // Automatically upload the dropped files
      await handleUpload(files)
    }
  }

  // Recursively traverse folder structure and preserve paths
  const traverseFileTree = async (entry: any, files: FileWithPath[], path: string): Promise<void> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          const fileWithPath = file as FileWithPath
          // Preserve the full relative path (path already includes directory structure)
          fileWithPath.relativePath = path + file.name
          files.push(fileWithPath)
          resolve()
        })
      })
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries: any[]) => {
          // Add current directory name to path for subdirectories and files
          const newPath = path + entry.name + '/'
          for (const subEntry of entries) {
            await traverseFileTree(subEntry, files, newPath)
          }
          resolve()
        })
      })
    }
  }

  const getFileIcon = (item: TenderFile) => {
    if (item.isDirectory) {
      return <Folder className="h-5 w-5 text-yellow-500" />
    }
    
    const ext = item.name.split('.').pop()?.toLowerCase()
    
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

  const getDisplayName = (fullPath: string) => {
    return fullPath.split('/').pop() || fullPath
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

  // Sort files: directories first, then files
  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

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
                  {currentPath && currentPath}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentPath && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigateToRoot}
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Root
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigateUp}
                  >
                    <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                    Up
                  </Button>
                </>
              )}
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
                    : 'Drag and drop files or folders here (folder structure will be preserved)'}
                </p>
              </div>
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1 space-y-2">
                  <Input
                    id="file-upload"
                    type="file"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    multiple
                  />
                  <p className="text-xs text-muted-foreground">
                    Select multiple files (hold Ctrl/Cmd to select multiple)
                    {currentPath && ` - Files will be uploaded to: ${currentPath}/`}
                  </p>
                </div>
                <Button
                  onClick={() => handleUpload()}
                  disabled={selectedFiles.length === 0 || uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
              {selectedFiles.length > 0 && (
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
          ) : sortedFiles.length === 0 ? (
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
                  {sortedFiles.map((item) => (
                    <TableRow 
                      key={item.name}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleItemClick(item)}
                    >
                      <TableCell>{getFileIcon(item)}</TableCell>
                      <TableCell className="font-medium">
                        {getDisplayName(item.name)}
                        {item.isDirectory && <span className="text-muted-foreground ml-2">(folder)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.isDirectory ? '-' : formatFileSize(item.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(item.modifiedAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!item.isDirectory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownload(item.name)
                              }}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFileToDelete(item.name)
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
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
            <AlertDialogTitle>Delete {fileToDelete?.includes('/') ? 'Folder' : 'File'}</AlertDialogTitle>
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

