
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CreateApplicationProps {
  onSuccess?: () => void
}

export default function CreateApplication({ onSuccess }: CreateApplicationProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    workheadCode: "",
    workheadName: "",
    applicationType: "",
    notes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.workheadCode || !formData.workheadName || !formData.applicationType) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      setLoading(true)
      const response = await fetch("/api/bca/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create application")
      }

      const data = await response.json()
      toast.success(`Application ${data.application.applicationNumber} created successfully!`)
      
      // Reset form
      setFormData({
        workheadCode: "",
        workheadName: "",
        applicationType: "",
        notes: "",
      })

      if (onSuccess) onSuccess()
    } catch (error: any) {
      console.error("Error creating application:", error)
      toast.error(error.message || "Failed to create application")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Application</CardTitle>
        <CardDescription>
          Start a new BCA workhead application or renewal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              A unique application number will be automatically generated upon submission.
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workheadCode">
                Workhead Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="workheadCode"
                placeholder="e.g., CW01, ME05, etc."
                value={formData.workheadCode}
                onChange={(e) =>
                  setFormData({ ...formData, workheadCode: e.target.value.toUpperCase() })
                }
                required
              />
              <p className="text-sm text-muted-foreground">
                Enter the BCA workhead code (e.g., CW01, ME05)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicationType">
                Application Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.applicationType}
                onValueChange={(value) =>
                  setFormData({ ...formData, applicationType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New Application</SelectItem>
                  <SelectItem value="RENEWAL">Renewal</SelectItem>
                  <SelectItem value="UPGRADE">Upgrade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workheadName">
              Workhead Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="workheadName"
              placeholder="e.g., General Building Works"
              value={formData.workheadName}
              onChange={(e) =>
                setFormData({ ...formData, workheadName: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes or comments..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setFormData({
                  workheadCode: "",
                  workheadName: "",
                  applicationType: "",
                  notes: "",
                })
              }
              disabled={loading}
            >
              Clear Form
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Application"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
