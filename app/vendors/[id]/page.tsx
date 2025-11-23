
'use client'

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  FolderOpen,
  DollarSign,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  CreditCard,
  Package
} from "lucide-react"
import { useRouter } from "next/navigation"

interface Vendor {
  id: string
  vendorNumber?: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country: string
  postalCode?: string | null
  contactPerson?: string | null
  companyReg?: string | null
  website?: string | null
  notes?: string | null
  supplierType: string
  paymentTerms: string
  contractDetails?: string | null
  isActive: boolean
  isApproved: boolean
  createdAt: string
  // Bank Information
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  bankSwiftCode?: string | null
  bankAddress?: string | null
}

export default function VendorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchVendor(params.id as string)
    }
  }, [params.id])

  const fetchVendor = async (id: string) => {
    try {
      const response = await fetch(`/api/vendors/${id}`)
      if (response.ok) {
        const vendorData = await response.json()
        setVendor(vendorData)
      } else {
        console.error("Failed to fetch vendor")
      }
    } catch (error) {
      console.error("Error fetching vendor:", error)
    } finally {
      setLoading(false)
    }
  }

  const getVendorTypeColor = (type: string) => {
    switch (type) {
      case 'SUPPLIER':
        return 'bg-blue-100 text-blue-800'
      case 'CONTRACTOR':
        return 'bg-green-100 text-green-800'
      case 'CONSULTANT':
        return 'bg-purple-100 text-purple-800'
      case 'DISTRIBUTOR':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentTermsColor = (terms: string) => {
    switch (terms) {
      case 'NET_30':
        return 'bg-green-100 text-green-800'
      case 'NET_60':
        return 'bg-yellow-100 text-yellow-800'
      case 'NET_90':
        return 'bg-orange-100 text-orange-800'
      case 'IMMEDIATE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentTermsDisplay = (terms: string) => {
    const termMap: { [key: string]: string } = {
      'NET_30': 'Net 30 Days',
      'NET_60': 'Net 60 Days',
      'NET_90': 'Net 90 Days',
      'IMMEDIATE': 'Immediate',
      'COD': 'Cash on Delivery',
      'PREPAID': 'Prepaid'
    }
    return termMap[terms] || terms
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!vendor) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Vendor Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              The vendor you're looking for doesn't exist or has been deleted.
            </p>
            <Button 
              onClick={() => router.push('/vendors')} 
              className="mt-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Vendors
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/vendors')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Vendors
            </Button>
            <div>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {vendor.name}
                  </h1>
                  <div className="flex items-center space-x-2">
                    {vendor.vendorNumber && (
                      <Badge variant="outline" className="font-mono text-green-600">
                        {vendor.vendorNumber}
                      </Badge>
                    )}
                    <Badge className={getVendorTypeColor(vendor.supplierType)}>
                      {vendor.supplierType}
                    </Badge>
                    {vendor.isApproved ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending Approval
                      </Badge>
                    )}
                    <Badge className={vendor.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {vendor.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit Vendor
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Vendor Information */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building2 className="mr-2 h-5 w-5" />
                      Vendor Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Company Name</label>
                        <p className="font-medium">{vendor.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Vendor Number</label>
                        <p className="font-mono font-medium text-green-600">
                          {vendor.vendorNumber || 'Not assigned'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Vendor Type</label>
                        <Badge className={getVendorTypeColor(vendor.supplierType)}>
                          {vendor.supplierType}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Payment Terms</label>
                        <Badge className={getPaymentTermsColor(vendor.paymentTerms)}>
                          {getPaymentTermsDisplay(vendor.paymentTerms)}
                        </Badge>
                      </div>
                      {vendor.companyReg && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Company Registration</label>
                          <p className="font-medium">{vendor.companyReg}</p>
                        </div>
                      )}
                      {vendor.contactPerson && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Contact Person</label>
                          <p className="font-medium">{vendor.contactPerson}</p>
                        </div>
                      )}
                    </div>

                    {vendor.notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Notes</label>
                        <p className="text-gray-700 dark:text-gray-300">{vendor.notes}</p>
                      </div>
                    )}

                    {vendor.contractDetails && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Contract Details</label>
                        <p className="text-gray-700 dark:text-gray-300">{vendor.contractDetails}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats & Contact Info */}
              <div className="space-y-6">
                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Projects</span>
                      <span className="font-semibold">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Contracts</span>
                      <span className="font-semibold">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Invoices</span>
                      <span className="font-semibold">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Outstanding Amount</span>
                      <span className="font-semibold">$0</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Phone className="mr-2 h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {vendor.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <a 
                          href={`mailto:${vendor.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {vendor.email}
                        </a>
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a 
                          href={`tel:${vendor.phone}`}
                          className="text-blue-600 hover:underline"
                        >
                          {vendor.phone}
                        </a>
                      </div>
                    )}
                    {vendor.website && (
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a 
                          href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {vendor.website}
                        </a>
                      </div>
                    )}
                    {(vendor.address || vendor.city || vendor.state || vendor.country) && (
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div className="text-sm">
                          {vendor.address && <div>{vendor.address}</div>}
                          <div>
                            {[vendor.city, vendor.state, vendor.postalCode]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                          {vendor.country && <div>{vendor.country}</div>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bank Information */}
                {(vendor.bankName || vendor.bankAccountNumber) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <CreditCard className="mr-2 h-5 w-5" />
                        Bank Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {vendor.bankName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Bank Name</label>
                          <p className="font-medium">{vendor.bankName}</p>
                        </div>
                      )}
                      {vendor.bankAccountNumber && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Account Number</label>
                          <p className="font-mono">{vendor.bankAccountNumber}</p>
                        </div>
                      )}
                      {vendor.bankAccountName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Account Name</label>
                          <p className="font-medium">{vendor.bankAccountName}</p>
                        </div>
                      )}
                      {vendor.bankSwiftCode && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">SWIFT Code</label>
                          <p className="font-mono">{vendor.bankSwiftCode}</p>
                        </div>
                      )}
                      {vendor.bankAddress && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Bank Address</label>
                          <p className="text-sm text-gray-700">{vendor.bankAddress}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FolderOpen className="mr-2 h-5 w-5" />
                  Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No projects found for this vendor</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No invoices found for this vendor</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Contracts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No contracts found for this vendor</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
