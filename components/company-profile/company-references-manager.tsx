"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Plus, Edit, Trash2, Star, Award, Check, Search, Building2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Customer {
  id: string
  name: string
  companyReg?: string | null
}

interface Manager {
  id: string
  name: string
}

interface Project {
  id: string
  projectNumber: string
  name: string
  description?: string | null
  projectType: string
  workType?: string | null
  status: string
  startDate?: string | null
  endDate?: string | null
  contractValue?: number | null
  estimatedBudget?: number | null
  progress: number
  address?: string | null
  city?: string | null
  country?: string | null
  postalCode?: string | null
  customer: Customer
  manager?: Manager | null
  isAdded: boolean
}

interface CompanyReference {
  id: string
  projectId: string
  achievements?: string | null
  highlights?: string | null
  customNotes?: string | null
  isFeatured: boolean
  displayOrder: number
  includeInProfile: boolean
  Project: {
    id: string
    projectNumber: string
    name: string
    description?: string | null
    projectType: string
    workType?: string | null
    status: string
    startDate?: string | null
    endDate?: string | null
    contractValue?: number | null
    progress: number
    address?: string | null
    city?: string | null
    Customer: Customer
    User_Project_managerIdToUser?: Manager | null
  }
}

interface CompanyReferencesManagerProps {
  companyProfileId: string
}

const workTypeConfig = {
  REINSTATEMENT: { color: "bg-orange-100 text-orange-800 border-orange-200", label: "Reinstatement", icon: "🔨" },
  MEP: { color: "bg-purple-100 text-purple-800 border-purple-200", label: "MEP", icon: "⚡" },
  ELECTRICAL_ONLY: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Electrical Only", icon: "💡" },
  ACMV_ONLY: { color: "bg-cyan-100 text-cyan-800 border-cyan-200", label: "ACMV Only", icon: "❄️" },
  PLUMBING_SANITARY: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Plumbing & Sanitary", icon: "🚿" },
  FIRE_PROTECTION: { color: "bg-red-100 text-red-800 border-red-200", label: "Fire Protection", icon: "🔥" },
  CIVIL_STRUCTURAL: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "Civil & Structural", icon: "🏗️" },
  INTERIOR_FITOUT: { color: "bg-green-100 text-green-800 border-green-200", label: "Interior Fit-out", icon: "🪑" },
  EXTERNAL_WORKS: { color: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "External Works", icon: "🌳" },
  GENERAL_CONSTRUCTION: { color: "bg-indigo-100 text-indigo-800 border-indigo-200", label: "General Construction", icon: "👷" },
  OTHER: { color: "bg-slate-100 text-slate-800 border-slate-200", label: "Other", icon: "📋" },
}

export function CompanyReferencesManager({ companyProfileId }: CompanyReferencesManagerProps) {
  const [references, setReferences] = useState<CompanyReference[]>([])
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedReference, setSelectedReference] = useState<CompanyReference | null>(null)
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    achievements: "",
    highlights: "",
    customNotes: "",
    isFeatured: false,
  })

  useEffect(() => {
    if (companyProfileId) {
      fetchReferences()
      fetchAvailableProjects()
    }
  }, [companyProfileId])

  const fetchReferences = async () => {
    try {
      const response = await fetch(`/api/company-profile/references?companyProfileId=${companyProfileId}`)
      if (response.ok) {
        const data = await response.json()
        setReferences(data.references || [])
      }
    } catch (error) {
      console.error("Error fetching references:", error)
      toast.error("Failed to fetch project references")
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableProjects = async () => {
    try {
      const response = await fetch(`/api/company-profile/available-projects?companyProfileId=${companyProfileId}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableProjects(data.projects || [])
      }
    } catch (error) {
      console.error("Error fetching available projects:", error)
      toast.error("Failed to fetch available projects")
    }
  }

  const handleAddProject = async (project: Project) => {
    setSaving(true)
    try {
      const response = await fetch("/api/company-profile/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyProfileId,
          projectId: project.id,
          isFeatured: false,
        }),
      })

      if (response.ok) {
        toast.success("Project added to company profile")
        fetchReferences()
        fetchAvailableProjects()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to add project")
      }
    } catch (error) {
      console.error("Error adding project:", error)
      toast.error("Failed to add project")
    } finally {
      setSaving(false)
    }
  }

  const handleEditReference = (reference: CompanyReference) => {
    setSelectedReference(reference)
    setEditForm({
      achievements: reference.achievements || "",
      highlights: reference.highlights || "",
      customNotes: reference.customNotes || "",
      isFeatured: reference.isFeatured,
    })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedReference) return

    setSaving(true)
    try {
      const response = await fetch(`/api/company-profile/references/${selectedReference.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        toast.success("Reference updated successfully")
        fetchReferences()
        setShowEditDialog(false)
        setSelectedReference(null)
      } else {
        toast.error("Failed to update reference")
      }
    } catch (error) {
      console.error("Error updating reference:", error)
      toast.error("Failed to update reference")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteReference = async (id: string) => {
    if (!confirm("Are you sure you want to remove this project from the company profile?")) return

    try {
      const response = await fetch(`/api/company-profile/references/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Project removed from company profile")
        fetchReferences()
        fetchAvailableProjects()
      } else {
        toast.error("Failed to remove project")
      }
    } catch (error) {
      console.error("Error deleting reference:", error)
      toast.error("Failed to remove project")
    }
  }

  const formatCurrency = (value?: number | null) => {
    if (!value) return "N/A"
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(value)
  }

  const formatDate = (date?: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const filteredProjects = availableProjects.filter((project) => {
    const query = searchQuery.toLowerCase()
    return (
      project.name.toLowerCase().includes(query) ||
      project.projectNumber.toLowerCase().includes(query) ||
      project.customer.name.toLowerCase().includes(query) ||
      (project.address && project.address.toLowerCase().includes(query))
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Added Projects Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Selected Project References</CardTitle>
              <CardDescription>
                Projects that will be included in your company profile
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {references.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No projects added yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add projects from your Projects module to showcase them in your company profile
              </p>
              <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Project
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {references.map((reference) => (
                <Card key={reference.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {reference.Project.name}
                          </CardTitle>
                          {reference.isFeatured && (
                            <Badge variant="default" className="gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              Featured
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          {reference.Project.projectNumber} • {reference.Project.Customer.name}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditReference(reference)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteReference(reference.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium">{reference.Project.projectType}</p>
                      </div>
                      {reference.Project.workType && (
                        <div>
                          <p className="text-muted-foreground">Work Type</p>
                          <Badge 
                            variant="outline" 
                            className={workTypeConfig[reference.Project.workType as keyof typeof workTypeConfig]?.color || ""}
                          >
                            {workTypeConfig[reference.Project.workType as keyof typeof workTypeConfig]?.icon}{" "}
                            {workTypeConfig[reference.Project.workType as keyof typeof workTypeConfig]?.label}
                          </Badge>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="outline">{reference.Project.status}</Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Contract Value</p>
                        <p className="font-medium">{formatCurrency(reference.Project.contractValue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Progress</p>
                        <p className="font-medium">{reference.Project.progress}%</p>
                      </div>
                    </div>

                    {reference.Project.address && (
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="text-sm">{reference.Project.address}</p>
                      </div>
                    )}

                    {reference.highlights && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Highlights</p>
                        <p className="text-sm mt-1">{reference.highlights}</p>
                      </div>
                    )}

                    {reference.achievements && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Achievements</p>
                        <p className="text-sm mt-1">{reference.achievements}</p>
                      </div>
                    )}

                    {reference.customNotes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Notes</p>
                        <p className="text-sm mt-1">{reference.customNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Project Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add Project to Company Profile</DialogTitle>
            <DialogDescription>
              Select projects from your Projects module to add to your company profile
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by project name, number, customer, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Projects List */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No projects found</p>
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <Card
                      key={project.id}
                      className={`cursor-pointer transition-colors ${
                        project.isAdded
                          ? "bg-muted border-primary"
                          : "hover:border-primary"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{project.name}</h4>
                              {project.isAdded && (
                                <Badge variant="secondary" className="gap-1">
                                  <Check className="h-3 w-3" />
                                  Added
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {project.projectNumber} • {project.customer.name}
                            </p>
                            <div className="flex flex-wrap gap-2 text-sm mb-2">
                              <Badge variant="outline" className="gap-1">
                                <span className="text-muted-foreground">Type:</span>
                                <span className="font-medium">{project.projectType}</span>
                              </Badge>
                              {project.workType && (
                                <Badge 
                                  variant="outline" 
                                  className={workTypeConfig[project.workType as keyof typeof workTypeConfig]?.color || ""}
                                >
                                  {workTypeConfig[project.workType as keyof typeof workTypeConfig]?.icon}{" "}
                                  {workTypeConfig[project.workType as keyof typeof workTypeConfig]?.label}
                                </Badge>
                              )}
                              <Badge variant="outline">
                                <span className="text-muted-foreground">Status:</span>
                                <span className="font-medium ml-1">{project.status}</span>
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Value: </span>
                                <span className="font-medium">{formatCurrency(project.contractValue)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Progress: </span>
                                <span className="font-medium">{project.progress}%</span>
                              </div>
                            </div>
                            {project.address && (
                              <p className="text-sm text-muted-foreground">
                                📍 {project.address}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            disabled={project.isAdded || saving}
                            onClick={() => handleAddProject(project)}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : project.isAdded ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="mr-2 h-4 w-4" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Reference Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project Reference</DialogTitle>
            <DialogDescription>
              Add custom highlights, achievements, and notes for this project
            </DialogDescription>
          </DialogHeader>

          {selectedReference && (
            <div className="space-y-4">
              {/* Project Info */}
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-semibold">{selectedReference.Project.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedReference.Project.projectNumber} • {selectedReference.Project.Customer.name}
                </p>
              </div>

              {/* Edit Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="highlights">Project Highlights</Label>
                  <Textarea
                    id="highlights"
                    placeholder="Key features and notable aspects of this project..."
                    value={editForm.highlights}
                    onChange={(e) => setEditForm({ ...editForm, highlights: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="achievements">Achievements & Awards</Label>
                  <Textarea
                    id="achievements"
                    placeholder="Notable achievements, awards, or recognitions for this project..."
                    value={editForm.achievements}
                    onChange={(e) => setEditForm({ ...editForm, achievements: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customNotes">Custom Notes</Label>
                  <Textarea
                    id="customNotes"
                    placeholder="Any additional information or notes about this project..."
                    value={editForm.customNotes}
                    onChange={(e) => setEditForm({ ...editForm, customNotes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="featured"
                    checked={editForm.isFeatured}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, isFeatured: checked as boolean })
                    }
                  />
                  <Label htmlFor="featured" className="cursor-pointer">
                    Feature this project (will be highlighted in the company profile)
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
