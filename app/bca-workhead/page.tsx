
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { MainLayout } from "@/components/layout/main-layout"
import { BcaWorkheadClient } from "./bca-workhead-client"

export default async function BcaWorkheadPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login")
  }

  // Check if user has SUPERADMIN role
  if (session.user.role !== "SUPERADMIN") {
    redirect("/dashboard")
  }

  return (
    <MainLayout>
      <BcaWorkheadClient />
    </MainLayout>
  )
}
