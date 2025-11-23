
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Target } from 'lucide-react'

interface ProgressEditDialogProps {
  projectId: string
  currentProgress: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ProgressEditDialog({
  projectId,
  currentProgress,
  open,
  onOpenChange,
  onSuccess
}: ProgressEditDialogProps) {
  const [progress, setProgress] = useState(currentProgress)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update progress')
      }

      toast.success('Progress updated successfully')
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error updating progress:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update progress')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Edit Project Progress</span>
          </DialogTitle>
          <DialogDescription>
            Update the completion percentage for this project
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="progress-input">Progress Percentage</Label>
              <Input
                id="progress-input"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-20 text-center"
              />
            </div>
            
            <div className="space-y-2">
              <Slider
                value={[progress]}
                onValueChange={(value) => setProgress(value[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{progress}%</div>
                <div className="text-sm text-gray-600 mt-1">Current Progress</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Progress'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
