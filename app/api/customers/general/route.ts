
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logActivity, logError, getIpAddress } from "@/lib/logger"
import { 
  createPaginatedResponse, 
  createEmptyPaginatedResponse,
  LegacyFormats 
} from "@/lib/api-response"

export async function GET(req: NextRequest) {
  // Parse pagination outside try block for error handler access
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.max(1, Math.min(1000, parseInt(searchParams.get('pageSize') || '50')))
  const skip = (page - 1) * pageSize

  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      await logError({
        action: 'Fetch General Contacts',
        message: 'Unauthorized access attempt',
        module: 'Contacts',
        endpoint: '/api/customers/general',
        errorCode: '401',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const search = searchParams.get("search") || ""
    
    // Multi-column sorting support
    const sortParam = searchParams.get("sort")
    let orderBy: any = [{ createdAt: "desc" }] // Default as array for consistency
    
    if (sortParam) {
      try {
        const sortRules = JSON.parse(sortParam)
        if (Array.isArray(sortRules) && sortRules.length > 0) {
          // Map sortBy to valid Prisma fields
          const validSortFields: Record<string, string> = {
            name: "name",
            customerNumber: "customerNumber",
            customerNo: "customerNumber",
            contactPerson: "contactPerson",
            email: "email",
            phone: "phone",
            companyReg: "companyReg",
            createdAt: "createdAt",
            updatedAt: "updatedAt",
          }
          
          // Transform sort rules to Prisma orderBy format
          orderBy = sortRules.map((rule: any) => {
            const field = validSortFields[rule.field] || rule.field
            return { [field]: rule.direction || "asc" }
          })
        }
      } catch (e) {
        console.warn("Invalid sort parameter, using default:", e)
        orderBy = [{ createdAt: "desc" }]
      }
    }

    // Query for general contacts - contacts that are neither customers nor suppliers
    const where = {
      isActive: true,
      isDeleted: false,
      // General contacts are those that are NOT customers AND NOT suppliers
      AND: [
        {
          OR: [
            { isCustomer: false },
            { isCustomer: null }
          ]
        },
        {
          OR: [
            { isSupplier: false },
            { isSupplier: null }
          ]
        }
      ],
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { contactPerson: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { customerNumber: { contains: search, mode: "insensitive" as const } },
          { companyReg: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

    // Get total count
    const totalRecords = await prisma.customer.count({ where })
    
    // Fetch general contacts
    const contacts = await prisma.customer.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      select: {
        id: true,
        customerNumber: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        mobile: true,
        contactPerson: true,
        companyReg: true,
        address: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        mailingLine1: true,
        mailingLine2: true,
        mailingCity: true,
        mailingRegion: true,
        mailingPostalCode: true,
        mailingCountry: true,
        streetLine1: true,
        streetLine2: true,
        streetCity: true,
        streetRegion: true,
        streetPostalCode: true,
        streetCountry: true,
        website: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        xeroContactId: true,
        isCustomer: true,
        isSupplier: true,
      },
    })

    // Add isXeroSynced flag for frontend display
    const contactsWithXeroFlag = contacts.map((contact: any) => ({
      ...contact,
      isXeroSynced: !!contact.xeroContactId,
    }))

    // Create standardized paginated response
    const response = createPaginatedResponse(
      contactsWithXeroFlag,
      { page, pageSize, totalRecords }
    )
    
    // Convert to legacy format for backward compatibility
    return NextResponse.json(LegacyFormats.toDataFormat(response))
  } catch (error) {
    console.error("GET /api/customers/general error:", error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Stack trace:', error instanceof Error ? error.stack : '')
    
    await logError({
      action: 'Fetch General Contacts',
      message: error instanceof Error ? error.message : 'Unknown error',
      module: 'Contacts',
      endpoint: '/api/customers/general',
      errorCode: '500',
      ipAddress: getIpAddress(req),
      isCritical: true,
    })
    
    // Return empty paginated response to prevent .map() errors
    const emptyResponse = createEmptyPaginatedResponse(page, pageSize)
    return NextResponse.json(LegacyFormats.toDataFormat(emptyResponse))
  }
}

export const dynamic = "force-dynamic"
