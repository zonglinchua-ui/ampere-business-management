
/**
 * BCA Company Info API
 * Manages company workhead information
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logBcaAction } from "@/lib/bca-services/audit-logger"

// GET - Get company info
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Default company UEN for Ampere Engineering
    const companyUen = "201021612W"

    const companyInfo = await prisma.bcaCompanyInfo.findUnique({
      where: { companyUen },
    })

    return NextResponse.json({ companyInfo }, { status: 200 })
  } catch (error) {
    console.error("[BCA Company Info GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch company info" },
      { status: 500 }
    )
  }
}

// POST - Update company info
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    
    // Default company UEN for Ampere Engineering
    const companyUen = "201021612W"

    // Upsert company info with form data
    const companyInfo = await prisma.bcaCompanyInfo.upsert({
      where: { companyUen },
      update: {
        companyName: body.companyName || "",
        registeredAddress: body.address || "",
        contactPerson: body.directors || "",
        contactEmail: body.email || "",
        contactPhone: body.phone || "",
        currentWorkheads: {
          registrationNumber: body.registrationNumber || "",
          bcaRegistrationNumber: body.bcaRegistrationNumber || "",
          website: body.website || "",
          technicalStaff: body.technicalStaff || "",
        },
        lastFetchDate: new Date(),
      },
      create: {
        companyUen,
        companyName: body.companyName || "",
        registeredAddress: body.address || "",
        contactPerson: body.directors || "",
        contactEmail: body.email || "",
        contactPhone: body.phone || "",
        currentWorkheads: {
          registrationNumber: body.registrationNumber || "",
          bcaRegistrationNumber: body.bcaRegistrationNumber || "",
          website: body.website || "",
          technicalStaff: body.technicalStaff || "",
        },
        expiryDates: {},
        sourceUrl: "",
        lastFetchDate: new Date(),
      },
    })

    // Log the action
    await logBcaAction({
      action: "UPDATE_COMPANY_INFO",
      entityType: "BcaCompanyInfo",
      entityId: companyInfo.id,
      newValues: companyInfo,
      userId: session.user.id,
      userEmail: session.user.email || "",
    })

    return NextResponse.json({ companyInfo }, { status: 200 })
  } catch (error) {
    console.error("[BCA Company Info POST]", error)
    return NextResponse.json(
      { error: "Failed to update company info" },
      { status: 500 }
    )
  }
}
