
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, FileSpreadsheet, Users, Building, FileText, Filter } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

const WORK_TYPES = [
  { value: "REINSTATEMENT", label: "Reinstatement" },
  { value: "MEP", label: "MEP" },
  { value: "ELECTRICAL_ONLY", label: "Electrical Only" },
  { value: "ACMV_ONLY", label: "ACMV Only" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "FIRE_PROTECTION", label: "Fire Protection" },
  { value: "CIVIL_STRUCTURAL", label: "Civil & Structural" },
  { value: "INTERIOR_FITOUT", label: "Interior Fit-out" },
  { value: "EXTERNAL_WORKS", label: "External Works" },
  { value: "GENERAL_CONSTRUCTION", label: "General Construction" },
  { value: "OTHER", label: "Other" },
]

export default function ListsGenerator() {
  const [generating, setGenerating] = useState(false)
  const [listType, setListType] = useState("project-list")
  const [listData, setListData] = useState<any>(null)
  
  // Filter states
  const [yearFrom, setYearFrom] = useState<string>("")
  const [yearTo, setYearTo] = useState<string>("")
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([])

  // Generate year options (from 2015 to current year + 1)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2014 }, (_, i) => 2015 + i)

  function toggleWorkType(workType: string) {
    setSelectedWorkTypes(prev => 
      prev.includes(workType) 
        ? prev.filter(t => t !== workType)
        : [...prev, workType]
    )
  }

  async function generateList() {
    try {
      setGenerating(true)
      setListData(null)

      const filters: any = {}

      if (listType === 'project-list') {
        if (yearFrom) filters.yearFrom = parseInt(yearFrom)
        if (yearTo) filters.yearTo = parseInt(yearTo)
        if (selectedWorkTypes.length > 0) filters.workTypes = selectedWorkTypes
      }

      const response = await fetch("/api/company-profile/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: listType, filters })
      })

      if (!response.ok) throw new Error("Failed to generate list")

      const data = await response.json()
      setListData(data)
      toast.success("List generated successfully!")
    } catch (error: any) {
      console.error("Error generating list:", error)
      toast.error(error.message || "Failed to generate list")
    } finally {
      setGenerating(false)
    }
  }

  function clearFilters() {
    setYearFrom("")
    setYearTo("")
    setSelectedWorkTypes([])
    setListData(null)
  }

  function exportToExcel() {
    if (!listData) return

    let csvContent = ""
    
    if (listType === "project-list" && listData.projectList) {
      csvContent = "Project Number,Project Name,Customer,Work Type,Contract Value,Start Date,End Date,Status,Location\n"
      listData.projectList.forEach((p: any) => {
        const workType = p.workType ? p.workType.replace(/_/g, ' ') : '-'
        csvContent += `"${p.projectNumber}","${p.projectName}","${p.customer}","${workType}",${p.contractValue || 0},"${p.startDate}","${p.endDate}","${p.status}","${p.location || ""}"\n`
      })
    } else if (listType === "customer-list" && listData.customerList) {
      csvContent = "Customer Name,Contact Person,Email,Phone,Total Projects,Total Contract Value\n"
      listData.customerList.forEach((c: any) => {
        csvContent += `"${c.name}","${c.contactPerson || ""}","${c.email || ""}","${c.phone || ""}",${c.totalProjects},${c.totalContractValue}\n`
      })
    } else if (listType === "ongoing-projects" && listData.projectList) {
      csvContent = "Project Number,Project Name,Customer,Contract Value,Start Date,Expected Completion,Progress,Location\n"
      listData.projectList.forEach((p: any) => {
        csvContent += `"${p.projectNumber}","${p.projectName}","${p.customer}",${p.contractValue || 0},"${p.startDate}","${p.expectedCompletion}",${p.progress}%,"${p.location || ""}"\n`
      })
    }

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${listType}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.success("Exported to CSV successfully!")
  }

  function formatWorkType(workType: string | null | undefined) {
    if (!workType) return '-'
    return workType.replace(/_/g, ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Generate Lists
            </CardTitle>
            <CardDescription>
              Generate project references, customer lists, and ongoing projects with advanced filtering
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select List Type</Label>
            <Select value={listType} onValueChange={(value) => {
              setListType(value)
              clearFilters()
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project-list">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    All Projects Reference List
                  </div>
                </SelectItem>
                <SelectItem value="ongoing-projects">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Current Ongoing Projects
                  </div>
                </SelectItem>
                <SelectItem value="customer-list">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Previous Customer List
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {listType === 'project-list' && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <h4 className="font-semibold text-sm">Filters</h4>
                {(yearFrom || yearTo || selectedWorkTypes.length > 0) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    className="ml-auto h-7 text-xs"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Year From</Label>
                  <Select value={yearFrom || "all"} onValueChange={(value) => setYearFrom(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Year To</Label>
                  <Select value={yearTo || "all"} onValueChange={(value) => setYearTo(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">Project Work Types</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WORK_TYPES.map(workType => (
                    <div key={workType.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={workType.value}
                        checked={selectedWorkTypes.includes(workType.value)}
                        onCheckedChange={() => toggleWorkType(workType.value)}
                      />
                      <label
                        htmlFor={workType.value}
                        className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {workType.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={generateList} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate List"
              )}
            </Button>

            {listData && (
              <Button variant="outline" onClick={exportToExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export to CSV
              </Button>
            )}
          </div>
        </div>

        {listData && (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Preview</h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              {listType === "project-list" && listData.projectList && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Project</th>
                      <th className="text-left p-2">Customer</th>
                      <th className="text-left p-2">Work Type</th>
                      <th className="text-right p-2">Value</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listData.projectList.map((p: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">
                          <div className="font-medium">{p.projectNumber}</div>
                          <div className="text-muted-foreground text-xs">{p.projectName}</div>
                        </td>
                        <td className="p-2">{p.customer}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {formatWorkType(p.workType)}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          {p.contractValue ? `$${p.contractValue.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2">{p.status}</td>
                        <td className="p-2">{p.location || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {listType === "customer-list" && listData.customerList && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Customer</th>
                      <th className="text-left p-2">Contact</th>
                      <th className="text-right p-2">Projects</th>
                      <th className="text-right p-2">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listData.customerList.map((c: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-muted-foreground text-xs">{c.email}</div>
                        </td>
                        <td className="p-2">
                          <div>{c.contactPerson || "-"}</div>
                          <div className="text-xs text-muted-foreground">{c.phone || "-"}</div>
                        </td>
                        <td className="p-2 text-right">{c.totalProjects}</td>
                        <td className="p-2 text-right">${c.totalContractValue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {listType === "ongoing-projects" && listData.projectList && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Project</th>
                      <th className="text-left p-2">Customer</th>
                      <th className="text-right p-2">Value</th>
                      <th className="text-right p-2">Progress</th>
                      <th className="text-left p-2">Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listData.projectList.map((p: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">
                          <div className="font-medium">{p.projectNumber}</div>
                          <div className="text-muted-foreground text-xs">{p.projectName}</div>
                        </td>
                        <td className="p-2">{p.customer}</td>
                        <td className="p-2 text-right">
                          {p.contractValue ? `$${p.contractValue.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2 text-right">{p.progress || 0}%</td>
                        <td className="p-2">
                          {p.expectedCompletion ? new Date(p.expectedCompletion).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              Total entries: {
                listType === "customer-list"
                  ? listData.customerList?.length || 0
                  : listData.projectList?.length || 0
              }
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
