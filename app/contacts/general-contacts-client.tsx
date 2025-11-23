
'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Contact, 
  Search,
  Mail,
  Phone,
  MapPin
} from "lucide-react"
import { DirectoryTable, SortRule } from "@/components/contacts/directory-table"
import { useDirectoryData } from "@/hooks/use-directory-data"
import { eventBus, XERO_SYNC_COMPLETED } from "@/lib/events"

interface GeneralContact {
  id: string
  customerNumber?: string
  name: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  contactPerson?: string | null
  companyReg?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country: string
  postalCode?: string | null
  mailingLine1?: string | null
  mailingLine2?: string | null
  mailingCity?: string | null
  mailingRegion?: string | null
  mailingPostalCode?: string | null
  mailingCountry?: string | null
  streetLine1?: string | null
  streetLine2?: string | null
  streetCity?: string | null
  streetRegion?: string | null
  streetPostalCode?: string | null
  streetCountry?: string | null
  website?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  isXeroSynced?: boolean
  xeroContactId?: string | null
  isCustomer?: boolean | null
  isSupplier?: boolean | null
}

export function GeneralContactsClient() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortRules, setSortRules] = useState<SortRule[]>([
    { field: 'createdAt', direction: 'desc' }
  ])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const { data: contacts, pagination, isLoading, refetch } = useDirectoryData<GeneralContact>(
    '/api/customers/general',
    {
      page,
      pageSize,
      search: debouncedSearch,
      sortRules
    },
    'general-contacts'
  )

  // Listen for Xero sync completion
  useEffect(() => {
    const unsubscribe = eventBus.on(XERO_SYNC_COMPLETED, () => {
      console.log('Xero sync completed, refreshing general contacts...')
      refetch()
    })
    return () => unsubscribe()
  }, [refetch])

  const getAddress = (contact: GeneralContact) => {
    // Try to get the most complete address
    const parts: string[] = []
    
    // Prefer mailing address
    if (contact.mailingLine1) {
      parts.push(contact.mailingLine1)
      if (contact.mailingLine2) parts.push(contact.mailingLine2)
      if (contact.mailingCity) parts.push(contact.mailingCity)
      if (contact.mailingRegion) parts.push(contact.mailingRegion)
      if (contact.mailingPostalCode) parts.push(contact.mailingPostalCode)
      if (contact.mailingCountry) parts.push(contact.mailingCountry)
    }
    // Fallback to street address
    else if (contact.streetLine1) {
      parts.push(contact.streetLine1)
      if (contact.streetLine2) parts.push(contact.streetLine2)
      if (contact.streetCity) parts.push(contact.streetCity)
      if (contact.streetRegion) parts.push(contact.streetRegion)
      if (contact.streetPostalCode) parts.push(contact.streetPostalCode)
      if (contact.streetCountry) parts.push(contact.streetCountry)
    }
    // Fallback to legacy address fields
    else if (contact.address) {
      parts.push(contact.address)
      if (contact.city) parts.push(contact.city)
      if (contact.state) parts.push(contact.state)
      if (contact.postalCode) parts.push(contact.postalCode)
      if (contact.country && contact.country !== 'Singapore') parts.push(contact.country)
    }
    
    return parts.length > 0 ? parts.join(', ') : null
  }

  const columns = [
    {
      key: 'name',
      label: 'Contact Name',
      sortable: true,
      render: (contact: GeneralContact) => (
        <div className="flex items-center gap-1.5">
          <div>
            <div className="font-medium text-xs">{contact.name}</div>
            {contact.companyReg && (
              <div className="text-xs text-gray-500">{contact.companyReg}</div>
            )}
          </div>
          {contact.isXeroSynced && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">Xero</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'contactPerson',
      label: 'Contact Person',
      sortable: true,
      render: (contact: GeneralContact) => (
        <div className="text-xs">
          {contact.contactPerson || 
           (contact.firstName || contact.lastName ? 
            `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : 
            "-")}
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (contact: GeneralContact) => (
        <div>
          {contact.email ? (
            <div className="flex items-center text-xs text-gray-600">
              <Mail className="h-2.5 w-2.5 mr-1.5 text-gray-400" />
              <a href={`mailto:${contact.email}`} className="hover:text-blue-600 hover:underline">
                {contact.email}
              </a>
            </div>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: true,
      render: (contact: GeneralContact) => (
        <div className="space-y-0.5">
          {contact.phone && (
            <div className="flex items-center text-xs text-gray-600">
              <Phone className="h-2.5 w-2.5 mr-1.5 text-gray-400" />
              <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                {contact.phone}
              </a>
            </div>
          )}
          {contact.mobile && (
            <div className="flex items-center text-xs text-gray-600">
              <Phone className="h-2.5 w-2.5 mr-1.5 text-gray-400" />
              <a href={`tel:${contact.mobile}`} className="hover:text-blue-600">
                {contact.mobile} <span className="text-xs text-gray-400">(Mobile)</span>
              </a>
            </div>
          )}
          {!contact.phone && !contact.mobile && (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'address',
      label: 'Address',
      sortable: true,
      render: (contact: GeneralContact) => {
        const address = getAddress(contact)
        return (
          <div>
            {address ? (
              <div className="flex items-start text-xs text-gray-600 max-w-xs">
                <MapPin className="h-2.5 w-2.5 mr-1.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{address}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">-</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'createdAt',
      label: 'Added On',
      sortable: true,
      render: (contact: GeneralContact) => (
        <div className="text-xs text-gray-600">
          {new Date(contact.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Single Total Count Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <Contact className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle className="text-2xl font-bold">{pagination.totalRecords.toLocaleString()} General Contacts</CardTitle>
              <CardDescription>Contacts that are neither customers nor suppliers</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Directory Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>General Contacts Directory</CardTitle>
            <CardDescription>
              View and manage contacts synced from Xero that are not classified as customers or suppliers
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, phone, or company registration..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Directory Table */}
          <DirectoryTable
            data={contacts}
            columns={columns}
            onRowClick={(contact) => router.push(`/clients/${contact.id}`)}
            isLoading={isLoading}
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            sortRules={sortRules}
            onSortChange={setSortRules}
            emptyMessage={searchTerm ? "No contacts match your search" : "No general contacts found"}
            emptyDescription={searchTerm ? "Try adjusting your search terms" : "General contacts will appear here after syncing from Xero"}
          />
        </CardContent>
      </Card>
    </div>
  )
}
