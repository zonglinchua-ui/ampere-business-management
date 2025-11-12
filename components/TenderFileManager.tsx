'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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

type SortField = 'name' | 'size' | 'modifiedAt'
type SortDirection = 'asc' | 'desc'

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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

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
        setSelectedItems(new Set()) // Clear selection when loading new folder
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

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const displayPath = file.relativePath || file.name
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${displayPath}`)

        const formData = new FormData()
        formData.append('file', file)
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

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`)
      }
      if (failCount > 0) {
        toast.error(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`)
      }

      setSelectedFiles([])
      setUploadProgress('')
      
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
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
      setCurrentPath(item.name)
    } else {
      await handleDownload(item.name)
    }
  }

  const handleDownload = async (filename: string) => {
    if (!tenderId) {
      toast.error('Tender ID is missing')
      return
    }

    try {
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

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0 || !tenderId) return

    try {
      let successCount = 0
      let failCount = 0

      for (const filename of selectedItems) {
        try {
          const response = await fetch(
            `/api/tenders/${tenderId}/files?filename=${encodeURIComponent(filename)}`,
            {
              method: 'DELETE',
            }
          )

          if (response.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          failCount++
        }
      }

      if (successCount > 0) {
        toast.success(`Deleted ${successCount} item${successCount > 1 ? 's' : ''}`)
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} item${failCount > 1 ? 's' : ''}`)
      }

      setSelectedItems(new Set())
      await loadFiles()
    } catch (error) {
      console.error('Error deleting files:', error)
      toast.error('Error deleting files')
    }
  }

  const toggleItemSelection = (itemName: string) => {
    const newSelection = new Set(selectedItems)
    if (newSelection.has(itemName)) {
      newSelection.delete(itemName)
    } else {
      newSelection.add(itemName)
    }
    setSelectedItems(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === sortedFiles.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(sortedFiles.map(f => f.name)))
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
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
      const droppedFiles = e.dataTransfer.files
      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i] as FileWithPath
        file.relativePath = currentPath ? `${currentPath}/${file.name}` : file.name
        files.push(file)
      }
    }

    if (files.length > 0) {
      setSelectedFiles(files)
      await handleUpload(files)
    }
  }

  const traverseFileTree = async (entry: any, files: FileWithPath[], path: string): Promise<void> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          const fileWithPath = file as FileWithPath
          fileWithPath.relativePath = path + file.name
          files.push(fileWithPath)
          resolve()
        })
      })
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries: any[]) => {
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
      return <Folder className="h-4 w-4 text-yellow-500" />
    }
    
    const ext = item.name.split('.').pop()?.toLowerCase()
    
    switch (ext) {
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
        return <FileText className="h-4 w-4 text-blue-500" />
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return <FileImage className="h-4 w-4 text-green-500" />
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
      default:
        return <File className="h-4 w-4 text-gray-500" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getDisplayName = (fullPath: string) => {
    return fullPath.split('/').pop() || fullPath
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

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

  // Sort files
  const sortedFiles = [...files].sort((a, b) => {
    // Directories first
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1

    // Then sort by selected field
    let comparison = 0
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name)
    } else if (sortField === 'size') {
      comparison = a.size - b.size
    } else if (sortField === 'modifiedAt') {
      comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Tender Documents</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {nasPath || `A:\\AMPERE WEB SERVER\\TENDER\\${customerName}\\${tenderTitle}\\`}
                  {currentPath && currentPath}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedItems.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedItems.size})
                </Button>
              )}
              {currentPath && (
                <>
                  <Button variant="outline" size="sm" onClick={navigateToRoot}>
                    <Home className="h-4 w-4 mr-1" />
                    Root
                  </Button>
                  <Button variant="outline" size="sm" onClick={navigateUp}>
                    <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
                    Up
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={loadFiles} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Section */}
          <div 
            className={`p-4 border-2 border-dashed rounded-lg transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-muted/30'
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  multiple
                  className="h-9"
                />
              </div>
              <Button onClick={() => handleUpload()} disabled={selectedFiles.length === 0 || uploading} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
            {uploadProgress && (
              <p className="text-xs font-medium text-primary mt-2">{uploadProgress}</p>
            )}
          </div>

          {/* Files Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No files yet</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40px] py-2">
                      <Checkbox
                        checked={selectedItems.size === sortedFiles.length && sortedFiles.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[30px] py-2"></TableHead>
                    <TableHead className="py-2">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center font-medium hover:text-foreground"
                      >
                        Name {getSortIcon('name')}
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px] py-2">
                      <button
                        onClick={() => handleSort('size')}
                        className="flex items-center font-medium hover:text-foreground"
                      >
                        Size {getSortIcon('size')}
                      </button>
                    </TableHead>
                    <TableHead className="w-[140px] py-2">
                      <button
                        onClick={() => handleSort('modifiedAt')}
                        className="flex items-center font-medium hover:text-foreground"
                      >
                        Modified {getSortIcon('modifiedAt')}
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px] text-right py-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFiles.map((item) => (
                    <TableRow 
                      key={item.name}
                      className="cursor-pointer hover:bg-muted/30 transition-colors h-10"
                      onClick={() => handleItemClick(item)}
                    >
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedItems.has(item.name)}
                          onCheckedChange={() => toggleItemSelection(item.name)}
                        />
                      </TableCell>
                      <TableCell className="py-1">{getFileIcon(item)}</TableCell>
                      <TableCell className="font-medium text-sm py-1">
                        {getDisplayName(item.name)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs py-1">
                        {item.isDirectory ? '-' : formatFileSize(item.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs py-1">
                        {formatDistanceToNow(new Date(item.modifiedAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right py-1">
                        <div className="flex items-center justify-end gap-1">
                          {!item.isDirectory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownload(item.name)
                              }}
                              title="Download"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFileToDelete(item.name)
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
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

export default TenderFileManager

