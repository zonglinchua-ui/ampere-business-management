
'use client'

import { useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Building2, Contact } from "lucide-react"
import { CustomersClient } from "./customers-client"
import { SuppliersClient } from "./suppliers-client"
import { GeneralContactsClient } from "./general-contacts-client"

export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState("customers")

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contacts</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage your customers, suppliers, and general contacts
            </p>
          </div>
        </div>

        {/* Tabs for Customers, Suppliers, and General Contacts */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Suppliers
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Contact className="h-4 w-4" />
              General
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="mt-6">
            <CustomersClient />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-6">
            <SuppliersClient />
          </TabsContent>

          <TabsContent value="general" className="mt-6">
            <GeneralContactsClient />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
