
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Save, Building2 } from "lucide-react"

export default function CompanyInfoManager() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [companyInfo, setCompanyInfo] = useState({
    companyName: "",
    registrationNumber: "",
    bcaRegistrationNumber: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    directors: "",
    technicalStaff: "",
  })

  useEffect(() => {
    fetchCompanyInfo()
  }, [])

  async function fetchCompanyInfo() {
    try {
      setLoading(true)
      const response = await fetch("/api/bca/company-info")
      if (!response.ok) throw new Error("Failed to fetch company info")
      const data = await response.json()
      if (data.companyInfo) {
        setCompanyInfo(data.companyInfo)
      }
    } catch (error) {
      console.error("Error fetching company info:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const response = await fetch("/api/bca/company-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyInfo),
      })

      if (!response.ok) throw new Error("Failed to save company info")

      toast.success("Company information saved successfully!")
    } catch (error: any) {
      console.error("Error saving company info:", error)
      toast.error(error.message || "Failed to save company information")
    } finally {
      setSaving(false)
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>
              Manage company details for BCA applications
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={companyInfo.companyName}
                onChange={(e) =>
                  setCompanyInfo({ ...companyInfo, companyName: e.target.value })
                }
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Company Registration No. *</Label>
              <Input
                id="registrationNumber"
                value={companyInfo.registrationNumber}
                onChange={(e) =>
                  setCompanyInfo({ ...companyInfo, registrationNumber: e.target.value })
                }
                placeholder="e.g., 201234567A"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bcaRegistrationNumber">BCA License No.</Label>
              <Input
                id="bcaRegistrationNumber"
                value={companyInfo.bcaRegistrationNumber}
                onChange={(e) =>
                  setCompanyInfo({
                    ...companyInfo,
                    bcaRegistrationNumber: e.target.value,
                  })
                }
                placeholder="Enter BCA license number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={companyInfo.phone}
                onChange={(e) =>
                  setCompanyInfo({ ...companyInfo, phone: e.target.value })
                }
                placeholder="+65 6XXX XXXX"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={companyInfo.email}
                onChange={(e) =>
                  setCompanyInfo({ ...companyInfo, email: e.target.value })
                }
                placeholder="company@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={companyInfo.website}
                onChange={(e) =>
                  setCompanyInfo({ ...companyInfo, website: e.target.value })
                }
                placeholder="https://www.example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Company Address *</Label>
            <Textarea
              id="address"
              value={companyInfo.address}
              onChange={(e) =>
                setCompanyInfo({ ...companyInfo, address: e.target.value })
              }
              placeholder="Enter full company address"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="directors">Directors (Comma-separated)</Label>
            <Textarea
              id="directors"
              value={companyInfo.directors}
              onChange={(e) =>
                setCompanyInfo({ ...companyInfo, directors: e.target.value })
              }
              placeholder="e.g., John Doe, Jane Smith"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="technicalStaff">Technical Staff / Key Personnel</Label>
            <Textarea
              id="technicalStaff"
              value={companyInfo.technicalStaff}
              onChange={(e) =>
                setCompanyInfo({ ...companyInfo, technicalStaff: e.target.value })
              }
              placeholder="List key technical personnel and their qualifications"
              rows={4}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
