'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import CompanyProfileForm from "@/components/company-profile/company-profile-form"
import { CompanyReferencesManager } from "@/components/company-profile/company-references-manager"
import ListsGenerator from "@/components/company-profile/lists-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

interface CompanyProfileClientProps {
  userId: string
}

interface CompanyProfile {
  id: string
  companyName: string
  isActive: boolean
}

export function CompanyProfileClient({ userId }: CompanyProfileClientProps) {
  const router = useRouter()
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrCreateProfile()
  }, [])

  const fetchOrCreateProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/company-profile')
      
      if (response.ok) {
        const data = await response.json()
        setCompanyProfile(data)
      } else if (response.status === 404) {
        // Create a default company profile
        const createResponse = await fetch('/api/company-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName: 'Company Name',
            isActive: true,
          }),
        })

        if (createResponse.ok) {
          const newProfile = await createResponse.json()
          setCompanyProfile(newProfile)
          toast.success('Company profile created')
        } else {
          throw new Error('Failed to create company profile')
        }
      } else {
        throw new Error('Failed to fetch company profile')
      }
    } catch (error) {
      console.error('Error with company profile:', error)
      toast.error('Failed to load company profile')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading company profile...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!companyProfile) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive font-medium">Failed to load company profile</p>
            <button
              onClick={fetchOrCreateProfile}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Company Profile</h1>
        <p className="text-muted-foreground">
          Manage your company information, project references, and generate professional profile documents
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Company Info</TabsTrigger>
          <TabsTrigger value="references">Project References</TabsTrigger>
          <TabsTrigger value="lists">Generate Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <CompanyProfileForm />
        </TabsContent>

        <TabsContent value="references" className="space-y-4">
          <CompanyReferencesManager companyProfileId={companyProfile.id} />
        </TabsContent>

        <TabsContent value="lists" className="space-y-4">
          <ListsGenerator />
        </TabsContent>
      </Tabs>
    </div>
  )
}
