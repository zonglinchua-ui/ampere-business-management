
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Upload, 
  FileText, 
  FolderOpen, 
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Building2
} from "lucide-react"

interface VendorProject {
  id: string
  name: string
  status: string
  progress: number
  startDate: string
  endDate?: string
  role: string
  contractValue: number
}

interface VendorInvoice {
  id: string
  invoiceNumber: string
  title: string
  amount: number
  status: string
  issueDate: string
  dueDate: string
  projectName: string
}

interface VendorDocument {
  id: string
  filename: string
  category: string
  uploadDate: string
  status: string
  projectName?: string
}

export default function VendorPortalPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<VendorProject[]>([])
  const [invoices, setInvoices] = useState<VendorInvoice[]>([])
  const [documents, setDocuments] = useState<VendorDocument[]>([])

  useEffect(() => {
    // Mock data for vendor portal - replace with actual API calls
    const mockProjects: VendorProject[] = [
      {
        id: "1",
        name: "Smart Building IoT Implementation",
        status: "IN_PROGRESS",
        progress: 75,
        startDate: "2024-01-15",
        endDate: "2024-06-30",
        role: "Hardware Supplier",
        contractValue: 85000
      },
      {
        id: "2",
        name: "Factory Automation Upgrade",
        status: "COMPLETED", 
        progress: 100,
        startDate: "2023-09-01",
        endDate: "2024-02-29",
        role: "Main Contractor",
        contractValue: 150000
      }
    ]

    const mockInvoices: VendorInvoice[] = [
      {
        id: "1",
        invoiceNumber: "VINV-2024-001",
        title: "IoT Hardware Supply - Phase 2",
        amount: 42500,
        status: "PAID",
        issueDate: "2024-02-15",
        dueDate: "2024-03-15",
        projectName: "Smart Building IoT Implementation"
      },
      {
        id: "2",
        invoiceNumber: "VINV-2024-002", 
        title: "Installation Services",
        amount: 28000,
        status: "SENT",
        issueDate: "2024-03-10",
        dueDate: "2024-04-10",
        projectName: "Smart Building IoT Implementation"
      },
      {
        id: "3",
        invoiceNumber: "VINV-2024-003",
        title: "Final Payment - Automation Project",
        amount: 65000,
        status: "OVERDUE",
        issueDate: "2024-01-20",
        dueDate: "2024-02-20",
        projectName: "Factory Automation Upgrade"
      }
    ]

    const mockDocuments: VendorDocument[] = [
      {
        id: "1",
        filename: "Safety_Certificate_2024.pdf",
        category: "CERTIFICATE",
        uploadDate: "2024-03-01",
        status: "APPROVED",
        projectName: "Smart Building IoT Implementation"
      },
      {
        id: "2",
        filename: "Installation_Manual_v2.pdf",
        category: "SPECIFICATION",
        uploadDate: "2024-02-28",
        status: "PENDING",
        projectName: "Smart Building IoT Implementation"
      },
      {
        id: "3",
        filename: "Progress_Report_March.pdf",
        category: "REPORT",
        uploadDate: "2024-03-15",
        status: "APPROVED"
      }
    ]

    setTimeout(() => {
      setProjects(mockProjects)
      setInvoices(mockInvoices)
      setDocuments(mockDocuments)
      setLoading(false)
    }, 1000)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
      case "APPROVED":
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "SENT":
      case "IN_PROGRESS":
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "OVERDUE":
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PAID":
      case "APPROVED":
      case "COMPLETED":
        return CheckCircle
      case "SENT":
      case "IN_PROGRESS":
      case "PENDING":
        return Clock
      case "OVERDUE":
      case "REJECTED":
        return AlertCircle
      default:
        return Clock
    }
  }

  const totalContractValue = projects.reduce((sum, project) => sum + project.contractValue, 0)
  const paidAmount = invoices.filter(inv => inv.status === "PAID").reduce((sum, inv) => sum + inv.amount, 0)
  const pendingAmount = invoices.filter(inv => inv.status !== "PAID" && inv.status !== "CANCELLED").reduce((sum, inv) => sum + inv.amount, 0)

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vendor Portal</h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Welcome back, {session?.user?.name} • {session?.user?.companyName}
              </p>
            </div>
            <Button className="bg-red-600 hover:bg-red-700">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalContractValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Amount Received</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${paidAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Paid invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">${pendingAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.filter(p => p.status === "IN_PROGRESS").length}</div>
              <p className="text-xs text-muted-foreground">Currently working on</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* My Projects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FolderOpen className="mr-2 h-5 w-5" />
                My Projects
              </CardTitle>
              <CardDescription>Projects you're currently involved in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projects.map((project) => {
                  const StatusIcon = getStatusIcon(project.status)
                  return (
                    <div key={project.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{project.name}</h4>
                        <Badge variant="outline" className={getStatusColor(project.status)}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span className="font-medium">Role:</span> {project.role}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <span className="font-medium">Contract Value:</span> ${project.contractValue.toLocaleString()}
                      </div>
                      {project.status === "IN_PROGRESS" && (
                        <div className="mb-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{project.progress}%</span>
                          </div>
                          <Progress value={project.progress} className="h-2" />
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        <Calendar className="inline w-3 h-3 mr-1" />
                        {new Date(project.startDate).toLocaleDateString()} - {project.endDate ? new Date(project.endDate).toLocaleDateString() : "Ongoing"}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Recent Invoices
              </CardTitle>
              <CardDescription>Your submitted invoices and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices.slice(0, 3).map((invoice) => {
                  const StatusIcon = getStatusIcon(invoice.status)
                  return (
                    <div key={invoice.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{invoice.invoiceNumber}</h4>
                        <Badge variant="outline" className={getStatusColor(invoice.status)}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {invoice.title}
                      </div>
                      <div className="text-sm font-medium mb-1">
                        ${invoice.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="mr-2 h-5 w-5" />
              Recent Documents
            </CardTitle>
            <CardDescription>Documents you've uploaded and their approval status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {documents.map((doc) => {
                const StatusIcon = getStatusIcon(doc.status)
                return (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-gray-400" />
                      <div>
                        <h4 className="font-medium">{doc.filename}</h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {doc.category} • Uploaded: {new Date(doc.uploadDate).toLocaleDateString()}
                          {doc.projectName && <span> • Project: {doc.projectName}</span>}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(doc.status)}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {doc.status}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
