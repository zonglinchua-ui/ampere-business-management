
'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FolderOpen, 
  Copy, 
  ExternalLink, 
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { toast } from "sonner"

interface NASLinkProps {
  path?: string
  title?: string
  description?: string
  className?: string
}

export function NASLink({ path, title = "Document Folder", description, className }: NASLinkProps) {
  const [copySuccess, setCopySuccess] = useState(false)

  if (!path) {
    return null
  }

  const handleOpenFolder = () => {
    try {
      // Try to open the folder using different methods
      if (path.startsWith('\\\\')) {
        // Windows UNC path
        window.open(`file:///${path.replace(/\\/g, '/')}`, '_blank')
      } else if (path.startsWith('smb://')) {
        // SMB path
        window.open(path, '_blank')
      } else if (path.startsWith('file://')) {
        // File protocol
        window.open(path, '_blank')
      } else {
        // Try as-is
        window.open(`file:///${path}`, '_blank')
      }
    } catch (error) {
      console.error('Error opening folder:', error)
      toast.error('Could not open folder. Please copy the path and open manually.')
    }
  }

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(path)
      setCopySuccess(true)
      toast.success('Path copied to clipboard!')
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast.error('Failed to copy path')
    }
  }

  const formatDisplayPath = (path: string) => {
    // Truncate very long paths for display
    if (path.length > 60) {
      const start = path.substring(0, 25)
      const end = path.substring(path.length - 25)
      return `${start}...${end}`
    }
    return path
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <FolderOpen className="mr-2 h-4 w-4" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-2 text-sm">
          <code className="flex-1 bg-muted px-2 py-1 rounded text-xs break-all">
            {formatDisplayPath(path)}
          </code>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenFolder}
            className="flex-1"
          >
            <ExternalLink className="mr-2 h-3 w-3" />
            Open Folder
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPath}
            className="flex-1"
          >
            {copySuccess ? (
              <CheckCircle className="mr-2 h-3 w-3" />
            ) : (
              <Copy className="mr-2 h-3 w-3" />
            )}
            {copySuccess ? 'Copied!' : 'Copy Path'}
          </Button>
        </div>
        
        <div className="flex items-start space-x-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <strong>Note:</strong> This link will only work if you're on the same network as the NAS server. 
            If the folder doesn't open automatically, copy the path and navigate to it manually in your file explorer.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

interface NASLinkInputProps {
  value?: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  description?: string
  error?: string
}

export function NASLinkInput({ 
  value = '', 
  onChange, 
  label = "NAS Document Folder Path",
  placeholder = "\\\\nas-server\\tenders\\project-name or smb://nas-server/tenders/project-name",
  description = "Enter the network path to the folder containing documents. Use UNC format (\\\\server\\path) for Windows or SMB format (smb://server/path) for Mac/Linux.",
  error
}: NASLinkInputProps) {
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  const handleTestPath = () => {
    if (!value.trim()) return

    setTestResult('testing')
    try {
      // Basic validation
      if (!value.includes('\\\\') && !value.includes('smb://') && !value.includes('file://')) {
        setTestResult('error')
        toast.error('Path should use UNC (\\\\server\\path) or SMB (smb://server/path) format')
        return
      }

      // Try to construct a valid URL
      let testUrl: string
      if (value.startsWith('\\\\')) {
        testUrl = `file:///${value.replace(/\\/g, '/')}`
      } else {
        testUrl = value
      }

      // Test if it's a valid URL format
      new URL(testUrl)
      setTestResult('success')
      toast.success('Path format looks valid!')
    } catch (error) {
      setTestResult('error')
      toast.error('Invalid path format')
    }

    setTimeout(() => setTestResult('idle'), 3000)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="nasPath">{label}</Label>
      <div className="flex space-x-2">
        <Input
          id="nasPath"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestPath}
          disabled={!value.trim() || testResult === 'testing'}
        >
          {testResult === 'testing' && 'Testing...'}
          {testResult === 'success' && '✓ Valid'}
          {testResult === 'error' && '✗ Invalid'}
          {testResult === 'idle' && 'Test Path'}
        </Button>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1" />
          {error}
        </p>
      )}
      
      {/* Example formats */}
      <div className="mt-2 p-2 bg-muted rounded-md">
        <p className="text-xs font-medium mb-1">Example formats:</p>
        <div className="text-xs text-muted-foreground space-y-1">
          <div><strong>Windows UNC:</strong> <code>\\\\nas-server\\shared\\tenders\\project-abc</code></div>
          <div><strong>SMB:</strong> <code>smb://nas-server/shared/tenders/project-abc</code></div>
          <div><strong>File Protocol:</strong> <code>file://server/shared/tenders/project-abc</code></div>
        </div>
      </div>
    </div>
  )
}
