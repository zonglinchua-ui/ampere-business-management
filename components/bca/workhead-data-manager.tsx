
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Plus, Database } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface WorkheadData {
  id: string
  workheadCode: string
  workheadName: string
  description: string | null
  minProjectCount: number
  minContractValue: string
  isActive: boolean
}

export default function WorkheadDataManager() {
  const [workheads, setWorkheads] = useState<WorkheadData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    workheadCode: "",
    workheadName: "",
    description: "",
    minProjectCount: "2",
    minContractValue: "0",
  })

  useEffect(() => {
    fetchWorkheads()
  }, [])

  async function fetchWorkheads() {
    try {
      setLoading(true)
      const response = await fetch("/api/bca/workhead-data")
      if (!response.ok) throw new Error("Failed to fetch workheads")
      const data = await response.json()
      setWorkheads(data.workheads || [])
    } catch (error) {
      console.error("Error fetching workheads:", error)
      toast.error("Failed to load workhead data")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const response = await fetch("/api/bca/workhead-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          minProjectCount: parseInt(formData.minProjectCount),
          minContractValue: parseFloat(formData.minContractValue),
        }),
      })

      if (!response.ok) throw new Error("Failed to create workhead data")

      toast.success("Workhead data created successfully!")
      setShowForm(false)
      setFormData({
        workheadCode: "",
        workheadName: "",
        description: "",
        minProjectCount: "2",
        minContractValue: "0",
      })
      fetchWorkheads()
    } catch (error: any) {
      console.error("Error creating workhead:", error)
      toast.error(error.message || "Failed to create workhead data")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Workhead Data Management
              </CardTitle>
              <CardDescription>
                Configure BCA workhead requirements and validation rules
              </CardDescription>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? "Cancel" : "Add Workhead"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="workheadCode">Workhead Code *</Label>
                  <Input
                    id="workheadCode"
                    value={formData.workheadCode}
                    onChange={(e) =>
                      setFormData({ ...formData, workheadCode: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g., CW01"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workheadName">Workhead Name *</Label>
                  <Input
                    id="workheadName"
                    value={formData.workheadName}
                    onChange={(e) =>
                      setFormData({ ...formData, workheadName: e.target.value })
                    }
                    placeholder="e.g., General Building Works"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter workhead description"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minProjectCount">Min. Projects *</Label>
                  <Input
                    id="minProjectCount"
                    type="number"
                    min="1"
                    value={formData.minProjectCount}
                    onChange={(e) =>
                      setFormData({ ...formData, minProjectCount: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minContractValue">Min. Contract Value ($) *</Label>
                  <Input
                    id="minContractValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minContractValue}
                    onChange={(e) =>
                      setFormData({ ...formData, minContractValue: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Workhead</Button>
              </div>
            </form>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Min. Projects</TableHead>
                  <TableHead>Min. Contract Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workheads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No workhead data found. Add your first workhead to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  workheads.map((workhead) => (
                    <TableRow key={workhead.id}>
                      <TableCell className="font-medium">{workhead.workheadCode}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{workhead.workheadName}</div>
                          {workhead.description && (
                            <div className="text-sm text-muted-foreground">
                              {workhead.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{workhead.minProjectCount}</TableCell>
                      <TableCell>${Number(workhead.minContractValue).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={workhead.isActive ? "default" : "secondary"}>
                          {workhead.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
