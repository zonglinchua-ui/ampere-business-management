
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react"

interface Project {
  id: string
  name: string
  projectNumber: string
  Customer: {
    id: string
    name: string
  }
}

interface BcaProjectForm {
  id: string
  formNumber: string
  formType: string
  status: string
  contractValue: number
  completionPercentage: number | null
  startDate: string | null
  completionDate: string | null
  isOngoing: boolean
  clientName: string | null
  remarks: string | null
  createdAt: string
  Project: {
    id: string
    name: string
    projectNumber: string
    Customer: {
      id: string
      name: string
    }
  }
  Application: {
    id: string
    applicationNumber: string
    applicationType: string
  }
}

interface ProjectFormsManagerProps {
  applicationId?: string
  projectId?: string
  showCreateButton?: boolean
}

const formTypeOptions = [
  { value: "D1", label: "D1 - Work Commencement" },
  { value: "D2", label: "D2 - Work Completion" },
]

const statusColors = {
  INCOMPLETE: "bg-yellow-100 text-yellow-800",
  PENDING_REVIEW: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SUBMITTED: "bg-purple-100 text-purple-800",
}

const statusIcons = {
  INCOMPLETE: Clock,
  PENDING_REVIEW: AlertCircle,
  APPROVED: CheckCircle,
  REJECTED: AlertCircle,
  SUBMITTED: CheckCircle,
}

export function ProjectFormsManager({
  applicationId,
  projectId,
  showCreateButton = true,
}: ProjectFormsManagerProps) {
  const router = useRouter()
  const [forms, setForms] = useState<BcaProjectForm[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingForm, setEditingForm] = useState<BcaProjectForm | null>(null)

  // Form data
  const [selectedApplicationId, setSelectedApplicationId] = useState(applicationId || "")
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || "")
  const [formType, setFormType] = useState("D1")
  const [contractValue, setContractValue] = useState("")
  const [completionPercentage, setCompletionPercentage] = useState("")
  const [startDate, setStartDate] = useState("")
  const [completionDate, setCompletionDate] = useState("")
  const [isOngoing, setIsOngoing] = useState(true)
  const [clientName, setClientName] = useState("")
  const [clientRepresentative, setClientRepresentative] = useState("")
  const [remarks, setRemarks] = useState("")

  useEffect(() => {
    fetchForms()
    if (!applicationId) fetchApplications()
    if (!projectId) fetchProjects()
  }, [applicationId, projectId])

  const fetchForms = async () => {
    try {
      const params = new URLSearchParams()
      if (applicationId) params.append("applicationId", applicationId)
      if (projectId) params.append("projectId", projectId)

      const response = await fetch(`/api/bca/project-forms?${params}`)
      if (!response.ok) throw new Error("Failed to fetch forms")
      const data = await response.json()
      setForms(data)
    } catch (error) {
      console.error("Error fetching forms:", error)
      toast.error("Failed to fetch forms")
    } finally {
      setLoading(false)
    }
  }

  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/bca/applications")
      if (!response.ok) throw new Error("Failed to fetch applications")
      const data = await response.json()
      // Ensure we always have an array
      if (Array.isArray(data)) {
        setApplications(data)
      } else if (data && Array.isArray(data.applications)) {
        setApplications(data.applications)
      } else {
        console.warn("Unexpected applications data format:", data)
        setApplications([])
      }
    } catch (error) {
      console.error("Error fetching applications:", error)
      setApplications([]) // Ensure state remains an array even on error
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects")
      if (!response.ok) throw new Error("Failed to fetch projects")
      const data = await response.json()
      // Handle various response formats
      if (Array.isArray(data)) {
        setProjects(data)
      } else if (data && Array.isArray(data.projects)) {
        setProjects(data.projects)
      } else if (data && Array.isArray(data.data)) {
        setProjects(data.data)
      } else {
        console.warn("Unexpected projects data format:", data)
        setProjects([])
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
      setProjects([]) // Ensure state remains an array even on error
    }
  }

  const handleCreateForm = async () => {
    try {
      if (!selectedApplicationId || !selectedProjectId) {
        toast.error("Please select both application and project")
        return
      }

      const response = await fetch("/api/bca/project-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApplicationId,
          projectId: selectedProjectId,
          formType,
          contractValue: contractValue ? parseFloat(contractValue) : undefined,
          completionPercentage: completionPercentage ? parseInt(completionPercentage) : undefined,
          startDate: startDate || undefined,
          completionDate: completionDate || undefined,
          isOngoing,
          clientName: clientName || undefined,
          clientRepresentative: clientRepresentative || undefined,
          remarks: remarks || undefined,
        }),
      })

      if (!response.ok) throw new Error("Failed to create form")

      toast.success("Form created successfully")
      setIsDialogOpen(false)
      resetFormFields()
      fetchForms()
    } catch (error) {
      console.error("Error creating form:", error)
      toast.error("Failed to create form")
    }
  }

  const handleDeleteForm = async (formId: string) => {
    if (!confirm("Are you sure you want to delete this form?")) return

    try {
      const response = await fetch(`/api/bca/project-forms/${formId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete form")

      toast.success("Form deleted successfully")
      fetchForms()
    } catch (error) {
      console.error("Error deleting form:", error)
      toast.error("Failed to delete form")
    }
  }

  const resetFormFields = () => {
    if (!applicationId) setSelectedApplicationId("")
    if (!projectId) setSelectedProjectId("")
    setFormType("D1")
    setContractValue("")
    setCompletionPercentage("")
    setStartDate("")
    setCompletionDate("")
    setIsOngoing(true)
    setClientName("")
    setClientRepresentative("")
    setRemarks("")
    setEditingForm(null)
  }

  const openCreateDialog = () => {
    resetFormFields()
    setIsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading forms...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">BCA Project Forms</h3>
          <p className="text-sm text-gray-500">
            Manage D1 and D2 forms for projects
          </p>
        </div>
        {showCreateButton && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create Form
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create BCA Project Form</DialogTitle>
                <DialogDescription>
                  Create a new D1 or D2 form for a project
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {!applicationId && (
                  <div className="grid gap-2">
                    <Label htmlFor="application">Application *</Label>
                    <Select
                      value={selectedApplicationId}
                      onValueChange={setSelectedApplicationId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select application" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(applications) && applications.map((app) => (
                          <SelectItem key={app.id} value={app.id}>
                            {app.applicationNumber} - {app.applicationType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!projectId && (
                  <div className="grid gap-2">
                    <Label htmlFor="project">Project *</Label>
                    <Select
                      value={selectedProjectId}
                      onValueChange={setSelectedProjectId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(projects) && projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.projectNumber} - {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="formType">Form Type *</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contractValue">Contract Value (S$)</Label>
                    <Input
                      id="contractValue"
                      type="number"
                      step="0.01"
                      value={contractValue}
                      onChange={(e) => setContractValue(e.target.value)}
                      placeholder="Auto-filled from project"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="completionPercentage">Completion %</Label>
                    <Input
                      id="completionPercentage"
                      type="number"
                      min="0"
                      max="100"
                      value={completionPercentage}
                      onChange={(e) => setCompletionPercentage(e.target.value)}
                      placeholder="Auto-filled from project"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="completionDate">Completion Date</Label>
                    <Input
                      id="completionDate"
                      type="date"
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isOngoing"
                    checked={isOngoing}
                    onCheckedChange={(checked) => setIsOngoing(checked as boolean)}
                  />
                  <Label htmlFor="isOngoing" className="text-sm font-normal">
                    Project is ongoing
                  </Label>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Auto-filled from project"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="clientRepresentative">Client Representative</Label>
                  <Input
                    id="clientRepresentative"
                    value={clientRepresentative}
                    onChange={(e) => setClientRepresentative(e.target.value)}
                    placeholder="Auto-filled from project"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Additional notes or remarks"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateForm}>Create Form</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center mb-4">
              No BCA forms found for this {projectId ? "project" : "application"}
            </p>
            {showCreateButton && (
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Form
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contract Value</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => {
                  const StatusIcon = statusIcons[form.status as keyof typeof statusIcons] || Clock
                  return (
                    <TableRow key={form.id}>
                      <TableCell className="font-medium">
                        {form.formNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{form.formType}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{form.Project.name}</div>
                          <div className="text-xs text-gray-500">
                            {form.Project.projectNumber}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {form.clientName || form.Project.Customer.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[form.status as keyof typeof statusColors] ||
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {form.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        S$ {Number(form.contractValue).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {form.completionPercentage ?? 0}%
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(`/projects/${form.Project.id}`)
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteForm(form.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
