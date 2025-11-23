
"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, FileText, CheckCircle, Building2, Database, Bell } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ApplicationsDashboard from "@/components/bca/applications-dashboard"
import CreateApplication from "@/components/bca/create-application"
import { ProjectFormsManager } from "@/components/bca/project-forms-manager"
import { ComplianceDashboard } from "@/components/bca/compliance-dashboard"
import CompanyInfoManager from "@/components/bca/company-info-manager"
import WorkheadDataManager from "@/components/bca/workhead-data-manager"
import NotificationsView from "@/components/bca/notifications-view"

export function BcaWorkheadClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("")

  useEffect(() => {
    if (status === "loading") return
    
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      toast.error("Access denied. SUPERADMIN role required.")
      router.push("/dashboard")
    }
  }, [session, status, router])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return null
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">BCA Workhead Application & Renewal</h1>
        <p className="text-muted-foreground mt-1">
          Manage workhead applications, renewals, and compliance documentation
        </p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          This module is accessible only to SUPERADMIN users. All actions are logged for audit purposes.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">New Application</span>
          </TabsTrigger>
          <TabsTrigger value="forms" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Project Forms</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Company Info</span>
          </TabsTrigger>
          <TabsTrigger value="workhead" className="gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Workhead Data</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <ApplicationsDashboard 
            onSelectApplication={(appId) => {
              setSelectedApplicationId(appId)
              setActiveTab("compliance")
            }}
          />
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <CreateApplication onSuccess={() => setActiveTab("dashboard")} />
        </TabsContent>

        <TabsContent value="forms" className="space-y-4">
          <ProjectFormsManager />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <ComplianceDashboard applicationId={selectedApplicationId} />
        </TabsContent>

        <TabsContent value="company" className="space-y-4">
          <CompanyInfoManager />
        </TabsContent>

        <TabsContent value="workhead" className="space-y-4">
          <WorkheadDataManager />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
