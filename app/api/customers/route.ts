
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateCustomerNumber } from "@/lib/number-generation"
import { z } from "zod"
import { logActivity, logError, getIpAddress } from "@/lib/logger"
import { 
  createPaginatedResponse, 
  createEmptyPaginatedResponse, 
  createErrorResponse,
  parsePaginationParams,
  ensureArray,
  LegacyFormats 
} from "@/lib/api-response"

const createCustomerSchema = z.object({
  // Basic Information
  name: z.string().min(1, "Company name is required"),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  
  // Contact Details
  emailAddress: z.string().email().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  skypeUserName: z.string().optional().nullable(),
  
  // Legacy Address Fields (for backward compatibility)
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().default("Singapore"),
  postalCode: z.string().optional().nullable(),
  
  // Mailing Address (Xero)
  mailingAttention: z.string().optional().nullable(),
  mailingLine1: z.string().optional().nullable(),
  mailingLine2: z.string().optional().nullable(),
  mailingLine3: z.string().optional().nullable(),
  mailingLine4: z.string().optional().nullable(),
  mailingCity: z.string().optional().nullable(),
  mailingRegion: z.string().optional().nullable(),
  mailingPostalCode: z.string().optional().nullable(),
  mailingCountry: z.string().optional().nullable(),
  
  // Street Address (Xero)
  streetAttention: z.string().optional().nullable(),
  streetLine1: z.string().optional().nullable(),
  streetLine2: z.string().optional().nullable(),
  streetLine3: z.string().optional().nullable(),
  streetLine4: z.string().optional().nullable(),
  streetCity: z.string().optional().nullable(),
  streetRegion: z.string().optional().nullable(),
  streetPostalCode: z.string().optional().nullable(),
  streetCountry: z.string().optional().nullable(),
  
  // Company & Financial Information
  companyReg: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customerType: z.enum(["ENTERPRISE", "SME", "GOVERNMENT", "INDIVIDUAL"]).default("ENTERPRISE"),
  
  // Bank Information
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  bankSwiftCode: z.string().optional().nullable(),
  bankAddress: z.string().optional().nullable(),
  
  // Xero-specific Fields
  defaultCurrency: z.string().optional().nullable(),
  salesDefaultAccountCode: z.string().optional().nullable(),
  purchasesDefaultAccountCode: z.string().optional().nullable(),
  xeroNetworkKey: z.string().optional().nullable(),
  xeroContactId: z.string().optional().nullable(),
  xeroUpdatedDateUtc: z.string().optional().nullable(),
  isSupplier: z.boolean().optional().nullable(),
  isCustomer: z.boolean().optional().nullable(),
})

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
        action: 'Fetch Customers',
        message: 'Unauthorized access attempt',
        module: 'Customers',
        endpoint: '/api/customers',
        errorCode: '401',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const search = searchParams.get("search") || ""
    
    // Multi-column sorting support
    const sortParam = searchParams.get("sort")
    let orderBy: any = [{ createdAt: "desc" }] // Default as array for consistency
    let needsProjectValueSort = false
    let projectValueDirection: 'asc' | 'desc' = 'asc'
    
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
            status: "isActive",
            isActive: "isActive",
            type: "customerType",
            customerType: "customerType",
          }
          
          // Check if we need to sort by project value (computed field)
          const projectValueRule = sortRules.find((rule: any) => 
            rule.field === 'projects' || rule.field === 'totalProjectValue'
          )
          
          if (projectValueRule) {
            needsProjectValueSort = true
            projectValueDirection = projectValueRule.direction || 'asc'
          }
          
          // Transform sort rules to Prisma orderBy format, excluding computed fields
          const regularSortRules = sortRules.filter((rule: any) => 
            rule.field !== 'projects' && rule.field !== 'totalProjectValue'
          )
          
          if (regularSortRules.length > 0) {
            orderBy = regularSortRules.map((rule: any) => {
              const field = validSortFields[rule.field] || rule.field
              return { [field]: rule.direction || "asc" }
            })
          }
        }
      } catch (e) {
        console.warn("Invalid sort parameter, using default:", e)
        orderBy = [{ createdAt: "desc" }]
      }
    }

    const where = {
      isActive: true,
      isDeleted: false, // Exclude soft-deleted customers
      // Only include contacts that are marked as customers (not general contacts)
      OR: [
        { isCustomer: true },
        { isCustomer: null }, // Treat null as true for backward compatibility
      ],
      ...(search && {
        AND: [
          {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { contactPerson: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { customerNumber: { contains: search, mode: "insensitive" as const } },
              { companyReg: { contains: search, mode: "insensitive" as const } },
            ],
          }
        ]
      }),
    }

    // Get total count
    const totalRecords = await prisma.customer.count({ where })
    
    let customers
    
    if (needsProjectValueSort) {
      // For project value sorting, we need to fetch all matching records with project data,
      // calculate totals, sort, then paginate
      const allCustomers = await prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: {
              Project: true,
              CustomerInvoice: true,
              LegacyInvoice: true,
            },
          },
          Project: {
            select: {
              estimatedBudget: true,
            },
          },
        },
      })
      
      // Calculate total project value for each customer
      const customersWithTotal = allCustomers.map(customer => {
        const totalProjectValue = customer.Project?.reduce((sum, project) => {
          return sum + (project.estimatedBudget ? Number(project.estimatedBudget) : 0)
        }, 0) || 0
        
        return {
          ...customer,
          totalProjectValue,
        }
      })
      
      // Sort by total project value
      customersWithTotal.sort((a, b) => {
        const diff = a.totalProjectValue - b.totalProjectValue
        return projectValueDirection === 'asc' ? diff : -diff
      })
      
      // Paginate the sorted results
      customers = customersWithTotal
        .slice(skip, skip + pageSize)
        .map(({ Project, ...customer }) => customer) // Remove Project array but keep totalProjectValue
    } else {
      // Regular sorting - also need to calculate and include total project value
      const customersData = await prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              Project: true,
              CustomerInvoice: true,
              LegacyInvoice: true,
            },
          },
          Project: {
            select: {
              estimatedBudget: true,
            },
          },
        },
        orderBy,
      })
      
      // Calculate and attach total project value for each customer
      customers = customersData.map(customer => {
        const totalProjectValue = customer.Project?.reduce((sum, project) => {
          return sum + (project.estimatedBudget ? Number(project.estimatedBudget) : 0)
        }, 0) || 0
        
        const { Project, ...customerWithoutProjects } = customer
        return {
          ...customerWithoutProjects,
          totalProjectValue,
        }
      })
    }

    // Create standardized paginated response
    const response = createPaginatedResponse(
      customers,
      { page, pageSize, totalRecords }
    )
    
    // Convert to legacy format for backward compatibility
    return NextResponse.json(LegacyFormats.toDataFormat(response))
  } catch (error) {
    console.error("GET /api/customers error:", error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Stack trace:', error instanceof Error ? error.stack : '')
    
    await logError({
      action: 'Fetch Customers',
      message: error instanceof Error ? error.message : 'Unknown error',
      module: 'Customers',
      endpoint: '/api/customers',
      errorCode: '500',
      ipAddress: getIpAddress(req),
      isCritical: true,
    })
    
    // Return empty paginated response to prevent .map() errors
    const emptyResponse = createEmptyPaginatedResponse(page, pageSize)
    return NextResponse.json(LegacyFormats.toDataFormat(emptyResponse))
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      await logError({
        action: 'Create Customer',
        message: 'Unauthorized access attempt',
        module: 'Customers',
        endpoint: '/api/customers',
        errorCode: '401',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createCustomerSchema.parse(body)

    // Generate the next customer number
    const customerNumber = await generateCustomerNumber()

    const customer = await prisma.customer.create({
      data: {
        id: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...validatedData,
        customerNumber,
        createdById: session.user.id,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            Project: true,
            CustomerInvoice: true,
            LegacyInvoice: true,
          },
        },
      },
    })

    // Log successful creation
    await logActivity({
      userId: session.user.id,
      username: session.user.name || undefined,
      role: session.user.role,
      action: 'Create Customer',
      message: `Created customer: ${validatedData.name} (${customerNumber})`,
      module: 'Customers',
      endpoint: '/api/customers',
      ipAddress: getIpAddress(req),
    })

    // Create audit log for dashboard Recent Activities
    const { createAuditLog } = await import('@/lib/api-audit-context')
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'CREATE',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      entityName: validatedData.name,  // Add entity name for detailed display
      newValues: {
        name: validatedData.name,
        customerNumber: customerNumber,
        customerType: validatedData.customerType
      }
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log("Validation error:", error.issues)
      await logError({
        action: 'Create Customer',
        message: `Validation error: ${JSON.stringify(error.issues)}`,
        module: 'Customers',
        endpoint: '/api/customers',
        errorCode: '400',
        ipAddress: getIpAddress(req),
      })
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("POST /api/customers error:", error)
    console.error("Error type:", typeof error)
    console.error("Error message:", error instanceof Error ? error.message : String(error))
    
    await logError({
      action: 'Create Customer',
      message: error instanceof Error ? error.message : String(error),
      module: 'Customers',
      endpoint: '/api/customers',
      errorCode: '500',
      ipAddress: getIpAddress(req),
      isCritical: true,
    })
    
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
