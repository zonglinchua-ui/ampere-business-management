
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
  CalendarDays,
  CheckSquare,
  Clock,
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  Paperclip,
  Users,
  FolderOpen,
  Building2,
  Bell,
  BellOff,
  Calendar,
  Flag,
  User,
  Target,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Edit,
  Send,
  Upload,
  Download,
  FileText,
  Image,
  File
} from "lucide-react"
import { format, formatDistanceToNow, isBefore, addDays } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"

interface TaskDetail {
  id: string
  title: string
  description?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'CANCELLED'
  dueDate?: string
  completedAt?: string
  assigner: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  assignee: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  project?: {
    id: string
    name: string
    projectNumber: string
    status: string
  }
  client?: {
    id: string
    name: string
  }
  comments: TaskComment[]
  attachments: TaskAttachment[]
  notifications: TaskNotification[]
  isOverdue: boolean
  daysPastDue?: number
  createdAt: string
  updatedAt: string
}

interface TaskComment {
  id: string
  comment: string
  isInternal: boolean
  user: {
    id: string
    firstName: string
    lastName: string
  }
  createdAt: string
  updatedAt: string
}

interface TaskAttachment {
  id: string
  filename: string
  originalName: string
  mimetype: string
  size: number
  cloudStoragePath: string
  uploadedBy: {
    id: string
    firstName: string
    lastName: string
  }
  createdAt: string
}

interface TaskNotification {
  id: string
  type: string
  message: string
  isRead: boolean
  sentAt?: string
  createdAt: string
}

const priorityConfig = {
  LOW: { color: 'bg-gray-100 text-gray-700', icon: Flag, label: 'Low', bgColor: 'bg-gray-50' },
  MEDIUM: { color: 'bg-blue-100 text-blue-700', icon: Flag, label: 'Medium', bgColor: 'bg-blue-50' },
  HIGH: { color: 'bg-orange-100 text-orange-700', icon: Flag, label: 'High', bgColor: 'bg-orange-50' },
  URGENT: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Urgent', bgColor: 'bg-red-50' },
}

const statusConfig = {
  TODO: { color: 'bg-gray-100 text-gray-700', icon: Clock, label: 'To Do' },
  IN_PROGRESS: { color: 'bg-blue-100 text-blue-700', icon: Play, label: 'In Progress' },
  REVIEW: { color: 'bg-purple-100 text-purple-700', icon: CheckSquare, label: 'In Review' },
  COMPLETED: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Completed' },
  CANCELLED: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelled' },
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

interface ProjectOption {
  id: string
  name: string
  projectNumber: string
}

interface ClientOption {
  id: string
  name: string
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [newComment, setNewComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  
  // Data for dropdowns
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  
  // Edit task dialog
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editTaskForm, setEditTaskForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    assigneeId: "",
    dueDate: "",
    projectId: "no-project",
    clientId: "no-client"
  })

  const taskId = params.id as string
  const currentUserId = session?.user?.id
  const userRole = session?.user?.role
  const canManageTasks = ["SUPERADMIN", "PROJECT_MANAGER"].includes(userRole || "")

  useEffect(() => {
    loadTaskDetail()
    loadDropdownData()
  }, [taskId])

  const loadTaskDetail = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`)
      if (response.ok) {
        const taskData = await response.json()
        setTask(taskData)
      } else {
        toast.error('Task not found')
        router.push('/tasks')
      }
    } catch (error) {
      console.error('Failed to load task:', error)
      toast.error('Failed to load task details')
    } finally {
      setLoading(false)
    }
  }

  const loadDropdownData = async () => {
    try {
      const [usersRes, projectsRes, clientsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/projects/list'),
        fetch('/api/customers/list')
      ])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData)
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        setProjects(projectsData)
      }

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json()
        // API returns { customers: [...], count: number }
        setClients(clientsData.customers || [])
      }
    } catch (error) {
      console.error('Failed to load dropdown data:', error)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!task) return

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: newStatus,
          completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : null
        })
      })

      if (response.ok) {
        const updatedTask = await response.json()
        setTask(prev => prev ? { ...prev, ...updatedTask } : null)
        toast.success('Task status updated')
      } else {
        throw new Error('Failed to update task')
      }
    } catch (error) {
      console.error('Task update failed:', error)
      toast.error('Failed to update task')
    }
  }

  const handleOpenEditDialog = () => {
    if (!task) return
    
    setEditTaskForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority,
      assigneeId: task.assignee?.id || "",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
      projectId: task.project?.id || "no-project",
      clientId: task.client?.id || "no-client"
    })
    setShowEditDialog(true)
  }

  const handleUpdateTask = async () => {
    if (!editTaskForm.title.trim()) {
      toast.error('Task title is required')
      return
    }

    if (!editTaskForm.assigneeId) {
      toast.error('Please select an assignee')
      return
    }

    if (!task) return

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editTaskForm.title,
          description: editTaskForm.description,
          priority: editTaskForm.priority,
          assigneeId: editTaskForm.assigneeId,
          dueDate: editTaskForm.dueDate ? new Date(editTaskForm.dueDate).toISOString() : null,
          projectId: editTaskForm.projectId === "no-project" ? null : editTaskForm.projectId,
          clientId: editTaskForm.clientId === "no-client" ? null : editTaskForm.clientId
        })
      })

      if (response.ok) {
        const updatedTask = await response.json()
        setTask(prev => prev ? { ...prev, ...updatedTask } : null)
        setShowEditDialog(false)
        toast.success('Task updated successfully')
        // Reload to get fresh data
        loadTaskDetail()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update task')
      }
    } catch (error: any) {
      console.error('Task update failed:', error)
      toast.error(error.message || 'Failed to update task')
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return

    setSubmittingComment(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          comment: newComment.trim(),
          isInternal: true
        })
      })

      if (response.ok) {
        const comment = await response.json()
        setTask(prev => prev ? {
          ...prev,
          comments: [comment, ...prev.comments]
        } : null)
        setNewComment("")
        toast.success('Comment added')
      } else {
        throw new Error('Failed to add comment')
      }
    } catch (error) {
      console.error('Comment creation failed:', error)
      toast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!task) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Task Not Found</h1>
            <p className="text-gray-600 mt-2">The task you're looking for doesn't exist.</p>
            <Link href="/tasks">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tasks
              </Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    )
  }

  const getPriorityIcon = (priority: string) => {
    const config = priorityConfig[priority as keyof typeof priorityConfig]
    const Icon = config?.icon || Flag
    return <Icon className="h-4 w-4" />
  }

  const getStatusIcon = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig]
    const Icon = config?.icon || Clock
    return <Icon className="h-4 w-4" />
  }

  const getPriorityColor = (priority: string) => {
    const config = priorityConfig[priority as keyof typeof priorityConfig]
    return config?.color || 'bg-gray-100 text-gray-700'
  }

  const getStatusColor = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig]
    return config?.color || 'bg-gray-100 text-gray-700'
  }

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Image className="h-4 w-4" />
    if (mimetype.includes('pdf')) return <FileText className="h-4 w-4 text-red-600" />
    return <File className="h-4 w-4" />
  }

  const canUpdateTask = canManageTasks || task.assignee.id === currentUserId || task.assigner.id === currentUserId
  const canCompleteTask = task.assignee.id === currentUserId || canManageTasks

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/tasks">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tasks
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
              <p className="text-gray-600">
                Created by {task.assigner.firstName} {task.assigner.lastName} • {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {canCompleteTask && task.status !== 'COMPLETED' && (
              <>
                {task.status === 'TODO' && (
                  <Button onClick={() => handleStatusUpdate('IN_PROGRESS')}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Task
                  </Button>
                )}
                {task.status === 'IN_PROGRESS' && (
                  <Button onClick={() => handleStatusUpdate('COMPLETED')}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                )}
                {task.status === 'REVIEW' && (
                  <Button onClick={() => handleStatusUpdate('COMPLETED')}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Complete
                  </Button>
                )}
              </>
            )}
            {canUpdateTask && (
              <Button variant="outline" onClick={handleOpenEditDialog}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Task
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Task Details</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge className={`${getPriorityColor(task.priority)} border-0`}>
                      <span className="flex items-center space-x-1">
                        {getPriorityIcon(task.priority)}
                        <span>{priorityConfig[task.priority]?.label}</span>
                      </span>
                    </Badge>
                    <Badge className={`${getStatusColor(task.status)} border-0`}>
                      <span className="flex items-center space-x-1">
                        {getStatusIcon(task.status)}
                        <span>{statusConfig[task.status]?.label}</span>
                      </span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.description && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Assigned To</h4>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {task.assignee.firstName[0]}{task.assignee.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>{task.assignee.firstName} {task.assignee.lastName}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Created By</h4>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {task.assigner.firstName[0]}{task.assigner.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>{task.assigner.firstName} {task.assigner.lastName}</span>
                    </div>
                  </div>
                </div>

                {(task.project || task.client) && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Related To</h4>
                    {task.project && (
                      <div className="flex items-center space-x-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span>{task.project.name} ({task.project.projectNumber})</span>
                      </div>
                    )}
                    {task.client && (
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{task.client.name}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Due Date</h4>
                    {task.dueDate ? (
                      <div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(task.dueDate), "PPP")}</span>
                        </div>
                        {task.isOverdue && (
                          <div className="flex items-center space-x-1 text-red-600 text-sm mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{task.daysPastDue} days overdue</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No due date set</span>
                    )}
                  </div>
                  {task.completedAt && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Completed At</h4>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>{format(new Date(task.completedAt), "PPP")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Comments and Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Comments & Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Comment */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Add Comment
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Comments List */}
                <div className="space-y-4">
                  {task.comments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                      <p>No comments yet. Be the first to add one!</p>
                    </div>
                  ) : (
                    task.comments.map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {comment.user.firstName[0]}{comment.user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {comment.user.firstName} {comment.user.lastName}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-gray-700 mt-1 whitespace-pre-wrap">{comment.comment}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Update */}
            {canUpdateTask && task.status !== 'COMPLETED' && (
              <Card>
                <CardHeader>
                  <CardTitle>Update Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={task.status} onValueChange={handleStatusUpdate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">To Do</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="REVIEW">In Review</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      {canManageTasks && (
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* Attachments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Attachments ({task.attachments.length})</CardTitle>
                  <Button size="sm" variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {task.attachments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No attachments</p>
                ) : (
                  <div className="space-y-2">
                    {task.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(attachment.mimetype)}
                          <div>
                            <div className="text-sm font-medium">{attachment.filename}</div>
                            <div className="text-xs text-muted-foreground">
                              {(attachment.size / 1024).toFixed(1)} KB • {attachment.uploadedBy.firstName} {attachment.uploadedBy.lastName}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Notifications */}
            {task.notifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {task.notifications.slice(0, 3).map((notification) => (
                      <div key={notification.id} className="flex items-start space-x-2 p-2 border rounded">
                        <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm">{notification.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Edit Task Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                Update task details, priority, assignment, and related project/customer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-title" className="text-right">
                  Title *
                </Label>
                <div className="col-span-3">
                  <Input
                    id="edit-title"
                    value={editTaskForm.title}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter task title..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="edit-description" className="text-right pt-2">
                  Description
                </Label>
                <div className="col-span-3">
                  <Textarea
                    id="edit-description"
                    value={editTaskForm.description}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Detailed task description..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={editTaskForm.priority} onValueChange={(value: any) => setEditTaskForm(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={editTaskForm.dueDate}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign To *</Label>
                <Select value={editTaskForm.assigneeId} onValueChange={(value) => setEditTaskForm(prev => ({ ...prev, assigneeId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(users) ? users : []).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project (Optional)</Label>
                  <Select value={editTaskForm.projectId} onValueChange={(value) => setEditTaskForm(prev => ({ ...prev, projectId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-project">No project</SelectItem>
                      {(Array.isArray(projects) ? projects : []).map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name} ({project.projectNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Customer (Optional)</Label>
                  <Select value={editTaskForm.clientId} onValueChange={(value) => setEditTaskForm(prev => ({ ...prev, clientId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-client">No customer</SelectItem>
                      {(Array.isArray(clients) ? clients : []).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTask}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
