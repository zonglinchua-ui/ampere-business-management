
"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  FileCheck,
  AlertCircle,
  Download,
  Loader2,
} from "lucide-react"

interface ComplianceResult {
  checkType: string
  checkDescription: string
  status: "PASS" | "FAIL" | "WARNING"
  errorMessage?: string
  warningMessage?: string
}

interface ComplianceSummary {
  total: number
  passed: number
  failed: number
  warnings: number
}

interface ComplianceData {
  results: ComplianceResult[]
  complianceScore: number
  isReady: boolean
  summary: ComplianceSummary
}

interface ComplianceDashboardProps {
  applicationId?: string
}

const statusConfig = {
  PASS: {
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    badge: "bg-green-100 text-green-800",
  },
  FAIL: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    badge: "bg-red-100 text-red-800",
  },
  WARNING: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800",
  },
}

export function ComplianceDashboard({ applicationId }: ComplianceDashboardProps) {
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    if (applicationId) {
      fetchComplianceData()
    }
  }, [applicationId])

  const fetchComplianceData = async () => {
    if (!applicationId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/bca/applications/${applicationId}/compliance`)
      if (!response.ok) {
        throw new Error("Failed to fetch compliance data")
      }

      const result = await response.json()
      setData(result)
      setLastChecked(new Date())
      
      if (result.isReady) {
        toast.success("Application meets all compliance requirements!")
      } else if (result.summary.failed > 0) {
        toast.error(`${result.summary.failed} compliance check(s) failed`)
      } else if (result.summary.warnings > 0) {
        toast.warning(`${result.summary.warnings} warning(s) found`)
      }
    } catch (error) {
      console.error("Error fetching compliance data:", error)
      toast.error("Failed to load compliance data")
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return "from-green-50 to-green-100"
    if (score >= 70) return "from-yellow-50 to-yellow-100"
    return "from-red-50 to-red-100"
  }

  const handleExportReport = () => {
    if (!data) return
    
    // Create a simple text report
    const report = `
BCA COMPLIANCE REPORT
Generated: ${new Date().toLocaleString()}

OVERALL SCORE: ${data.complianceScore}%
Status: ${data.isReady ? "READY FOR SUBMISSION" : "NOT READY"}

SUMMARY:
- Total Checks: ${data.summary.total}
- Passed: ${data.summary.passed}
- Failed: ${data.summary.failed}
- Warnings: ${data.summary.warnings}

DETAILED RESULTS:
${data.results.map((r, i) => `
${i + 1}. ${r.checkDescription}
   Status: ${r.status}
   ${r.errorMessage ? `Error: ${r.errorMessage}` : ""}
   ${r.warningMessage ? `Warning: ${r.warningMessage}` : ""}
`).join("\n")}
    `.trim()

    const blob = new Blob([report], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `compliance-report-${applicationId}-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success("Report exported successfully")
  }

  if (!applicationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Dashboard</CardTitle>
          <CardDescription>
            View automated compliance checks and validation results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please select an application to view compliance checks.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Dashboard</CardTitle>
          <CardDescription>
            Loading compliance data...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Compliance Dashboard</h2>
          <p className="text-sm text-gray-500">
            Automated validation against BCA workhead requirements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            disabled={!data}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchComplianceData}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Run Checks
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* Overall Status Card */}
          <Card className={`bg-gradient-to-br ${getScoreBgColor(data.complianceScore)}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={`text-5xl font-bold ${getScoreColor(data.complianceScore)}`}>
                      {data.complianceScore}%
                    </div>
                    {data.isReady ? (
                      <Badge className="bg-green-600 text-white">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Ready for Submission
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Action Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Overall Compliance Score
                  </p>
                  {lastChecked && (
                    <p className="text-xs text-gray-500">
                      Last checked: {lastChecked.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-bold text-green-600">
                      {data.summary.passed}
                    </div>
                    <div className="text-xs text-gray-600 uppercase">Passed</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-600">
                      {data.summary.failed}
                    </div>
                    <div className="text-xs text-gray-600 uppercase">Failed</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-yellow-600">
                      {data.summary.warnings}
                    </div>
                    <div className="text-xs text-gray-600 uppercase">Warnings</div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Progress value={data.complianceScore} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <FileCheck className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{data.summary.total}</div>
                    <p className="text-sm text-gray-500">Total Checks</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {Math.round((data.summary.passed / data.summary.total) * 100)}%
                    </div>
                    <p className="text-sm text-gray-500">Success Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${data.isReady ? 'bg-green-50' : 'bg-red-50'}`}>
                    {data.isReady ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <div className="text-lg font-bold">
                      {data.isReady ? "Ready" : "Not Ready"}
                    </div>
                    <p className="text-sm text-gray-500">Submission Status</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Items */}
          {!data.isReady && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription>
                Please address the following issues before submitting:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {data.results
                    .filter((r) => r.status === "FAIL")
                    .map((r, i) => (
                      <li key={i}>{r.errorMessage || r.checkDescription}</li>
                    ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Detailed Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Compliance Checks</CardTitle>
              <CardDescription>
                Individual validation results for each requirement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Check Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.results.map((result, index) => {
                    const config = statusConfig[result.status]
                    const StatusIcon = config.icon
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <StatusIcon className={`h-5 w-5 ${config.color}`} />
                        </TableCell>
                        <TableCell>
                          <Badge className={config.badge}>
                            {result.checkType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {result.checkDescription}
                        </TableCell>
                        <TableCell>
                          {result.status === "PASS" ? (
                            <span className="text-sm text-green-600">
                              ✓ Requirement met
                            </span>
                          ) : result.errorMessage ? (
                            <span className="text-sm text-red-600">
                              {result.errorMessage}
                            </span>
                          ) : result.warningMessage ? (
                            <span className="text-sm text-yellow-600">
                              {result.warningMessage}
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
