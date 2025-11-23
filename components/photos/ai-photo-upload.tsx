
'use client'

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Upload, 
  Camera, 
  FileImage, 
  Loader2, 
  CheckCircle, 
  X, 
  Edit, 
  Save,
  RefreshCw,
  Sparkles
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

interface PhotoAnalysis {
  description: string
  suggestedTitle: string
  filename: string
  size: number
  type: string
}

interface AnalyzedPhoto {
  file: File
  preview: string
  analysis: PhotoAnalysis | null
  isAnalyzing: boolean
  customTitle: string
  customDescription: string
  error?: string
}

interface AIPhotoUploadProps {
  onPhotosAnalyzed: (photos: AnalyzedPhoto[]) => void
  documentType?: string
  context?: string
  maxPhotos?: number
  disabled?: boolean
}

export function AIPhotoUpload({ 
  onPhotosAnalyzed, 
  documentType = '', 
  context = 'construction project',
  maxPhotos = 10,
  disabled = false
}: AIPhotoUploadProps) {
  const [photos, setPhotos] = useState<AnalyzedPhoto[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [analyzingCount, setAnalyzingCount] = useState(0)

  const analyzeImage = async (file: File): Promise<PhotoAnalysis> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('context', context)
    formData.append('documentType', documentType)

    const response = await fetch('/api/analyze-image', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to analyze image')
    }

    return await response.json()
  }

  const handleFiles = useCallback(async (files: FileList) => {
    if (disabled) return
    
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error(`${file.name} is too large (max 10MB)`)
        return false
      }
      return true
    })

    if (photos.length + validFiles.length > maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed`)
      return
    }

    // Create preview URLs and initial photo objects
    const newPhotos: AnalyzedPhoto[] = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      analysis: null,
      isAnalyzing: true,
      customTitle: '',
      customDescription: '',
    }))

    setPhotos(prev => [...prev, ...newPhotos])
    setAnalyzingCount(prev => prev + validFiles.length)

    // Analyze each image
    const analyzedPhotos = await Promise.allSettled(
      validFiles.map(async (file, index) => {
        try {
          const analysis = await analyzeImage(file)
          return { ...newPhotos[index], analysis, isAnalyzing: false }
        } catch (error) {
          console.error('Error analyzing image:', error)
          return {
            ...newPhotos[index],
            isAnalyzing: false,
            error: error instanceof Error ? error.message : 'Analysis failed'
          }
        }
      })
    )

    // Update photos with analysis results
    setPhotos(prev => {
      const updated = [...prev]
      let newPhotoIndex = prev.length - validFiles.length
      
      analyzedPhotos.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          updated[newPhotoIndex + index] = {
            ...result.value,
            customTitle: result.value.analysis?.suggestedTitle || '',
            customDescription: result.value.analysis?.description || ''
          }
        } else {
          updated[newPhotoIndex + index] = {
            ...newPhotos[index],
            isAnalyzing: false,
            error: 'Analysis failed'
          }
        }
      })
      
      return updated
    })

    setAnalyzingCount(0)

    // Notify parent component
    setTimeout(() => {
      setPhotos(current => {
        onPhotosAnalyzed(current)
        return current
      })
    }, 100)

  }, [photos.length, maxPhotos, disabled, documentType, context, onPhotosAnalyzed])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }, [handleFiles])

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = prev.filter((_, i) => i !== index)
      // Revoke the URL to prevent memory leaks
      URL.revokeObjectURL(prev[index].preview)
      onPhotosAnalyzed(updated)
      return updated
    })
  }

  const updatePhotoField = (index: number, field: 'customTitle' | 'customDescription', value: string) => {
    setPhotos(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      onPhotosAnalyzed(updated)
      return updated
    })
  }

  const retryAnalysis = async (index: number) => {
    const photo = photos[index]
    if (!photo) return

    setPhotos(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], isAnalyzing: true, error: undefined }
      return updated
    })

    setAnalyzingCount(prev => prev + 1)

    try {
      const analysis = await analyzeImage(photo.file)
      setPhotos(prev => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          analysis,
          isAnalyzing: false,
          customTitle: analysis.suggestedTitle,
          customDescription: analysis.description
        }
        onPhotosAnalyzed(updated)
        return updated
      })
    } catch (error) {
      console.error('Error retrying analysis:', error)
      setPhotos(prev => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          isAnalyzing: false,
          error: error instanceof Error ? error.message : 'Analysis failed'
        }
        return updated
      })
    } finally {
      setAnalyzingCount(prev => prev - 1)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className={`transition-all duration-200 ${dragActive ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">AI-Powered Photo Upload</CardTitle>
          </div>
          <CardDescription>
            Upload photos and get automatic descriptions powered by AI. Perfect for construction documentation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : disabled 
                ? 'border-gray-300 bg-gray-100 cursor-not-allowed' 
                : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <div className="flex items-center space-x-2 mb-2">
                <Upload className="w-6 h-6 text-gray-500" />
                <Camera className="w-6 h-6 text-blue-500" />
                <Sparkles className="w-6 h-6 text-purple-500" />
              </div>
              <p className="mb-2 text-sm text-gray-500 text-center">
                <span className="font-semibold">Click to upload</span> or drag and drop photos
              </p>
              <p className="text-xs text-gray-500 text-center">
                PNG, JPG, JPEG (MAX. 10MB) • AI will analyze each photo automatically
              </p>
              {photos.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  {photos.length}/{maxPhotos} photos uploaded
                </p>
              )}
            </div>
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept="image/*"
              multiple
              onChange={handleFileInput}
              disabled={disabled}
            />
          </div>

          {analyzingCount > 0 && (
            <div className="mt-4 flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">
                Analyzing {analyzingCount} photo{analyzingCount !== 1 ? 's' : ''}...
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {photos.map((photo, index) => (
              <motion.div
                key={`${photo.file.name}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <PhotoCard
                  photo={photo}
                  index={index}
                  onRemove={() => removePhoto(index)}
                  onUpdateField={(field, value) => updatePhotoField(index, field, value)}
                  onRetryAnalysis={() => retryAnalysis(index)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function PhotoCard({ 
  photo, 
  index, 
  onRemove, 
  onUpdateField, 
  onRetryAnalysis 
}: {
  photo: AnalyzedPhoto
  index: number
  onRemove: () => void
  onUpdateField: (field: 'customTitle' | 'customDescription', value: string) => void
  onRetryAnalysis: () => void
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <div className="aspect-video relative bg-gray-100">
          <Image
            src={photo.preview}
            alt={`Photo ${index + 1}`}
            fill
            className="object-cover"
          />
          <div className="absolute top-2 right-2 flex space-x-2">
            {photo.isAnalyzing && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Analyzing
              </Badge>
            )}
            {photo.analysis && !photo.isAnalyzing && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Analyzed
              </Badge>
            )}
            {photo.error && (
              <Badge variant="destructive">
                Error
              </Badge>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={onRemove}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Photo Title</Label>
          {isEditingTitle ? (
            <div className="flex space-x-2">
              <Input
                value={photo.customTitle}
                onChange={(e) => onUpdateField('customTitle', e.target.value)}
                placeholder="Enter photo title..."
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => setIsEditingTitle(false)}
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <p className="text-sm text-gray-900 flex-1">
                {photo.customTitle || 'No title'}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingTitle(true)}
                className="ml-2"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">AI Generated Description</Label>
          {photo.isAnalyzing ? (
            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700">Analyzing image...</span>
            </div>
          ) : photo.error ? (
            <div className="p-3 bg-red-50 rounded-lg space-y-2">
              <p className="text-sm text-red-700">{photo.error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={onRetryAnalysis}
                className="text-red-700 border-red-200 hover:bg-red-50"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry Analysis
              </Button>
            </div>
          ) : isEditingDescription ? (
            <div className="space-y-2">
              <Textarea
                value={photo.customDescription}
                onChange={(e) => onUpdateField('customDescription', e.target.value)}
                placeholder="Enter photo description..."
                rows={4}
              />
              <Button
                size="sm"
                onClick={() => setIsEditingDescription(false)}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <p className="text-sm text-gray-700 flex-1 whitespace-pre-wrap">
                  {photo.customDescription || 'No description available'}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingDescription(true)}
                  className="ml-2"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              {photo.analysis && (
                <div className="flex items-center space-x-2 text-xs text-green-600">
                  <Sparkles className="h-3 w-3" />
                  <span>Generated by AI</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* File info */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
          <div className="flex items-center space-x-2">
            <FileImage className="h-3 w-3" />
            <span>{photo.file.name}</span>
          </div>
          <span>{(photo.file.size / (1024 * 1024)).toFixed(1)} MB</span>
        </div>
      </CardContent>
    </Card>
  )
}
