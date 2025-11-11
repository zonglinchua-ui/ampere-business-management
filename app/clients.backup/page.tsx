
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { MainLayout } from "@/components/layout/main-layout"
import { ClientsClient } from "./clients-client"

export default async function ClientsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login")
  }

  return (
    <MainLayout>
      <ClientsClient />
    </MainLayout>
  )
}
