
import { Metadata } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { CompanyProfileClient } from "./company-profile-client"

export const metadata: Metadata = {
  title: "Company Profile - Ampere Business Management",
  description: "Manage company profile and generate reference documents",
}

export default async function CompanyProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login")
  }

  return (
    <MainLayout>
      <CompanyProfileClient userId={session.user.id} />
    </MainLayout>
  )
}
