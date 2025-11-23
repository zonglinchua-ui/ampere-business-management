
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Save, Building2, Upload, FileText, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function CompanyProfileForm() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [profile, setProfile] = useState({
    companyName: "",
    registrationNumber: "",
    businessType: "",
    yearEstablished: new Date().getFullYear(),
    address: "",
    city: "",
    state: "",
    country: "Singapore",
    postalCode: "",
    phone: "",
    fax: "",
    email: "",
    website: "",
    introduction: "",
    vision: "",
    mission: "",
    coreValues: "",
    logoPath: "",
    organizationChartPath: "",
    qaqcDocumentPath: "",
    certifications: "",
    accreditations: "",
    keyPersonnel: "",
    technicalCapabilities: "",
    equipment: "",
    safetyRecords: ""
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    try {
      setLoading(true)
      const response = await fetch("/api/company-profile")
      if (!response.ok) throw new Error("Failed to fetch company profile")
      const data = await response.json()
      if (data.companyProfile) {
        setProfile(data.companyProfile)
      }
    } catch (error) {
      console.error("Error fetching company profile:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const response = await fetch("/api/company-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      })

      if (!response.ok) throw new Error("Failed to save company profile")

      const data = await response.json()
      toast.success(data.message || "Company profile saved successfully!")
      if (data.companyProfile) {
        setProfile(data.companyProfile)
      }
    } catch (error: any) {
      console.error("Error saving company profile:", error)
      toast.error(error.message || "Failed to save company profile")
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(file: File, type: string) {
    try {
      setUploading(type)
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", type)

      const response = await fetch("/api/company-profile/upload", {
        method: "POST",
        body: formData
      })

      if (!response.ok) throw new Error("Failed to upload file")

      const data = await response.json()
      
      // Update profile with new file path
      setProfile(prev => ({
        ...prev,
        [`${type}Path`]: data.cloudStoragePath
      }))

      toast.success("File uploaded successfully!")
    } catch (error: any) {
      console.error("Error uploading file:", error)
      toast.error(error.message || "Failed to upload file")
    } finally {
      setUploading(null)
    }
  }

  function removeFile(field: string) {
    setProfile(prev => ({
      ...prev,
      [field]: ""
    }))
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
                <Building2 className="h-5 w-5" />
                Company Profile
              </CardTitle>
              <CardDescription>
                Manage your company information and generate professional profile documents
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
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="about">About Us</TabsTrigger>
              <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={profile.companyName}
                    onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    value={profile.registrationNumber || ""}
                    onChange={(e) => setProfile({ ...profile, registrationNumber: e.target.value })}
                    placeholder="Enter registration number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <Input
                    id="businessType"
                    value={profile.businessType || ""}
                    onChange={(e) => setProfile({ ...profile, businessType: e.target.value })}
                    placeholder="e.g., Engineering & Construction"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearEstablished">Year Established</Label>
                  <Input
                    id="yearEstablished"
                    type="number"
                    value={profile.yearEstablished || ""}
                    onChange={(e) => setProfile({ ...profile, yearEstablished: parseInt(e.target.value) })}
                    placeholder="Enter year"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profile.address || ""}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Enter street address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={profile.city || ""}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="Enter city"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={profile.postalCode || ""}
                    onChange={(e) => setProfile({ ...profile, postalCode: e.target.value })}
                    placeholder="Enter postal code"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+65 1234 5678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email || ""}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="info@company.com"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={profile.website || ""}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    placeholder="https://www.company.com"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="about" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="introduction">Company Introduction</Label>
                <Textarea
                  id="introduction"
                  rows={4}
                  value={profile.introduction || ""}
                  onChange={(e) => setProfile({ ...profile, introduction: e.target.value })}
                  placeholder="Brief introduction about your company..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vision">Vision Statement</Label>
                <Textarea
                  id="vision"
                  rows={3}
                  value={profile.vision || ""}
                  onChange={(e) => setProfile({ ...profile, vision: e.target.value })}
                  placeholder="Your company's vision..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mission">Mission Statement</Label>
                <Textarea
                  id="mission"
                  rows={3}
                  value={profile.mission || ""}
                  onChange={(e) => setProfile({ ...profile, mission: e.target.value })}
                  placeholder="Your company's mission..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coreValues">Core Values</Label>
                <Textarea
                  id="coreValues"
                  rows={4}
                  value={profile.coreValues || ""}
                  onChange={(e) => setProfile({ ...profile, coreValues: e.target.value })}
                  placeholder="Your company's core values (one per line)..."
                />
              </div>
            </TabsContent>

            <TabsContent value="capabilities" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="certifications">Certifications & Licenses</Label>
                <Textarea
                  id="certifications"
                  rows={3}
                  value={profile.certifications || ""}
                  onChange={(e) => setProfile({ ...profile, certifications: e.target.value })}
                  placeholder="List your certifications (one per line)..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accreditations">Accreditations</Label>
                <Textarea
                  id="accreditations"
                  rows={3}
                  value={profile.accreditations || ""}
                  onChange={(e) => setProfile({ ...profile, accreditations: e.target.value })}
                  placeholder="List your accreditations (one per line)..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keyPersonnel">Key Personnel</Label>
                <Textarea
                  id="keyPersonnel"
                  rows={4}
                  value={profile.keyPersonnel || ""}
                  onChange={(e) => setProfile({ ...profile, keyPersonnel: e.target.value })}
                  placeholder="List key personnel with their roles..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="technicalCapabilities">Technical Capabilities</Label>
                <Textarea
                  id="technicalCapabilities"
                  rows={4}
                  value={profile.technicalCapabilities || ""}
                  onChange={(e) => setProfile({ ...profile, technicalCapabilities: e.target.value })}
                  placeholder="Describe your technical capabilities..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipment">Equipment & Resources</Label>
                <Textarea
                  id="equipment"
                  rows={4}
                  value={profile.equipment || ""}
                  onChange={(e) => setProfile({ ...profile, equipment: e.target.value })}
                  placeholder="List major equipment and resources..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="safetyRecords">Safety Records & Achievements</Label>
                <Textarea
                  id="safetyRecords"
                  rows={3}
                  value={profile.safetyRecords || ""}
                  onChange={(e) => setProfile({ ...profile, safetyRecords: e.target.value })}
                  placeholder="Describe your safety records and achievements..."
                />
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <div className="flex items-center gap-2">
                    {profile.logoPath ? (
                      <div className="flex items-center gap-2 p-2 border rounded">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">Logo uploaded</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFile("logoPath")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(file, "logo")
                          }}
                          disabled={uploading === "logo"}
                        />
                        {uploading === "logo" && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Organization Chart</Label>
                  <div className="flex items-center gap-2">
                    {profile.organizationChartPath ? (
                      <div className="flex items-center gap-2 p-2 border rounded">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">Chart uploaded</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFile("organizationChartPath")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(file, "orgChart")
                          }}
                          disabled={uploading === "orgChart"}
                        />
                        {uploading === "orgChart" && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>QA/QC Document</Label>
                  <div className="flex items-center gap-2">
                    {profile.qaqcDocumentPath ? (
                      <div className="flex items-center gap-2 p-2 border rounded">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">Document uploaded</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFile("qaqcDocumentPath")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(file, "qaqc")
                          }}
                          disabled={uploading === "qaqc"}
                        />
                        {uploading === "qaqc" && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
