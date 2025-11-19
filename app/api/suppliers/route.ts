
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { generateSupplierNumber } from '@/lib/number-generation'
import { v4 as uuidv4 } from 'uuid'
import { 
  createPaginatedResponse, 
  createEmptyPaginatedResponse,
  LegacyFormats 
} from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "50")
    const skip = (page - 1) * pageSize
    const includeInactive = searchParams.get("includeInactive") === "true"
    
    // Multi-column sorting support
    const sortParam = searchParams.get("sort")
    let orderBy: any = [{ createdAt: "desc" }] // Default as array for consistency
    let needsPurchaseValueSort = false
    let purchaseValueDirection: 'asc' | 'desc' = 'asc'
    
    if (sortParam) {
      try {
        const sortRules = JSON.parse(sortParam)
        if (Array.isArray(sortRules) && sortRules.length > 0) {
          // Map sortBy to valid Prisma fields
          const validSortFields: Record<string, string> = {
            name: "name",
            supplierNumber: "supplierNumber",
            supplierNo: "supplierNumber",
            contactPerson: "contactPerson",
            email: "email",
            phone: "phone",
            companyReg: "companyReg",
            createdAt: "createdAt",
            updatedAt: "updatedAt",
            status: "isActive",
            isActive: "isActive",
            paymentTerms: "paymentTerms",
          }
          
          // Check if we need to sort by purchase value (computed field)
          const purchaseValueRule = sortRules.find((rule: any) => 
            rule.field === 'purchase' || rule.field === 'totalPurchaseValue'
          )
          
          if (purchaseValueRule) {
            needsPurchaseValueSort = true
            purchaseValueDirection = purchaseValueRule.direction || 'asc'
          }
          
          // Transform sort rules to Prisma orderBy format, excluding computed fields
          const regularSortRules = sortRules.filter((rule: any) => 
            rule.field !== 'purchase' && rule.field !== 'totalPurchaseValue'
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
      ...(includeInactive ? {} : { isActive: true }), // Only filter by active if not including inactive
      isDeleted: false, // Always exclude soft-deleted suppliers
      // Only include contacts that are marked as suppliers (not general contacts)
      OR: [
        { isSupplier: true },
        { isSupplier: null }, // Treat null as true for backward compatibility
      ],
      ...(search && {
        AND: [
          {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { contactPerson: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { supplierNumber: { contains: search, mode: "insensitive" as const } },
              { companyReg: { contains: search, mode: "insensitive" as const } },
            ],
          }
        ]
      }),
    }

    // Get total count
    const totalRecords = await prisma.supplier.count({ where })
    
    let suppliers
    
    if (needsPurchaseValueSort) {
      // For purchase value sorting, we need to fetch all matching records with invoice data,
      // calculate totals, sort, then paginate
      const allSuppliers = await prisma.supplier.findMany({
        where,
        include: {
          User_Supplier_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          _count: {
            select: {
              SupplierInvoice: true,
            },
          },
          SupplierInvoice: {
            select: {
              totalAmount: true,
            },
          },
        },
      })
      
      // Calculate total purchase value for each supplier
      const suppliersWithTotal = allSuppliers.map(supplier => {
        const totalPurchaseValue = supplier.SupplierInvoice?.reduce((sum, invoice) => {
          return sum + (invoice.totalAmount ? Number(invoice.totalAmount) : 0)
        }, 0) || 0
        
        return {
          ...supplier,
          totalPurchaseValue,
        }
      })
      
      // Sort by total purchase value
      suppliersWithTotal.sort((a: any, b: any) => {
        const diff = a.totalPurchaseValue - b.totalPurchaseValue
        return purchaseValueDirection === 'asc' ? diff : -diff
      })
      
      // Paginate the sorted results
      suppliers = suppliersWithTotal
        .slice(skip, skip + pageSize)
        .map(({ SupplierInvoice, ...supplier }) => supplier) // Remove SupplierInvoice array but keep totalPurchaseValue
    } else {
      // Regular sorting - also need to calculate and include total purchase value
      const suppliersData = await prisma.supplier.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          User_Supplier_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          _count: {
            select: {
              SupplierInvoice: true,
            },
          },
          SupplierInvoice: {
            select: {
              totalAmount: true,
            },
          },
        },
        orderBy,
      })
      
      // Calculate and attach total purchase value for each supplier
      suppliers = suppliersData.map(supplier => {
        const totalPurchaseValue = supplier.SupplierInvoice?.reduce((sum, invoice) => {
          return sum + (invoice.totalAmount ? Number(invoice.totalAmount) : 0)
        }, 0) || 0
        
        const { SupplierInvoice, ...supplierWithoutInvoices } = supplier
        return {
          ...supplierWithoutInvoices,
          totalPurchaseValue,
        }
      })
    }

    // Create standardized paginated response
    const response = createPaginatedResponse(
      suppliers,
      { page, pageSize, totalRecords }
    )
    
    // Convert to legacy format for backward compatibility
    return NextResponse.json(LegacyFormats.toDataFormat(response))
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Stack trace:', error instanceof Error ? error.stack : '')
    
    // Return empty paginated response to prevent .map() errors
    const page = parseInt(new URL(req.url).searchParams.get("page") || "1")
    const pageSize = parseInt(new URL(req.url).searchParams.get("pageSize") || "50")
    const emptyResponse = createEmptyPaginatedResponse(page, pageSize)
    return NextResponse.json(LegacyFormats.toDataFormat(emptyResponse))
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Generate the next supplier number
    const supplierNumber = await generateSupplierNumber()

    // Create supplier with all Xero-aligned fields
    const supplier = await prisma.supplier.create({
      data: {
        id: uuidv4(),
        supplierNumber,
        // Basic Information
        name: body.name,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        contactPerson: body.contactPerson || null,
        
        // Contact Details
        emailAddress: body.emailAddress || null,
        email: body.email || null,
        phone: body.phone || null,
        mobile: body.mobile || null,
        fax: body.fax || null,
        website: body.website || null,
        skypeUserName: body.skypeUserName || null,
        
        // Legacy Address Fields
        address: body.address || null,
        city: body.city || null,
        state: body.state || null,
        country: body.country || 'Singapore',
        postalCode: body.postalCode || null,
        
        // Mailing Address
        mailingAttention: body.mailingAttention || null,
        mailingLine1: body.mailingLine1 || null,
        mailingLine2: body.mailingLine2 || null,
        mailingLine3: body.mailingLine3 || null,
        mailingLine4: body.mailingLine4 || null,
        mailingCity: body.mailingCity || null,
        mailingRegion: body.mailingRegion || null,
        mailingPostalCode: body.mailingPostalCode || null,
        mailingCountry: body.mailingCountry || null,
        
        // Street Address
        streetAttention: body.streetAttention || null,
        streetLine1: body.streetLine1 || null,
        streetLine2: body.streetLine2 || null,
        streetLine3: body.streetLine3 || null,
        streetLine4: body.streetLine4 || null,
        streetCity: body.streetCity || null,
        streetRegion: body.streetRegion || null,
        streetPostalCode: body.streetPostalCode || null,
        streetCountry: body.streetCountry || null,
        
        // Company & Financial Information
        companyReg: body.companyReg || null,
        taxNumber: body.taxNumber || null,
        accountNumber: body.accountNumber || null,
        notes: body.notes || null,
        supplierType: body.supplierType || null,
        paymentTerms: body.paymentTerms || null,
        contractDetails: body.contractDetails || null,
        
        // Bank Information
        bankName: body.bankName || null,
        bankAccountNumber: body.bankAccountNumber || null,
        bankAccountName: body.bankAccountName || null,
        bankSwiftCode: body.bankSwiftCode || null,
        bankAddress: body.bankAddress || null,
        
        // Xero-specific Fields
        defaultCurrency: body.defaultCurrency || null,
        salesDefaultAccountCode: body.salesDefaultAccountCode || null,
        purchasesDefaultAccountCode: body.purchasesDefaultAccountCode || null,
        xeroContactId: body.xeroContactId || null,
        xeroUpdatedDateUtc: body.xeroUpdatedDateUtc || null,
        isSupplier: body.isSupplier ?? true,
        isCustomer: body.isCustomer ?? false,
        
        createdById: session.user.id,
        updatedAt: new Date()
      },
      include: {
        User_Supplier_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Create audit log for dashboard Recent Activities
    const { createAuditLog } = await import('@/lib/api-audit-context')
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'CREATE',
      entityType: 'SUPPLIER',
      entityId: supplier.id,
      entityName: supplier.name,  // Add entity name for detailed display
      newValues: {
        name: supplier.name,
        supplierNumber: supplier.supplierNumber,
        supplierType: supplier.supplierType
      }
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    )
  }
}
