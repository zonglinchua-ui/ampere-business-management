

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { generateAndStoreQuotationPDF } from '@/lib/quotation-pdf-utils'
import { createSuccessResponse, createErrorResponse, ensureArray } from '@/lib/api-response'
import { createAuditLog } from '@/lib/api-audit-context'

// Standard terms and conditions
function getStandardTerms(): string {
  return `TERMS & CONDITIONS:

1. Quotation is valid for 30 days from the date of issue.
2. Payment terms: 50% deposit upon order confirmation, 50% balance upon completion.
3. All prices are in Singapore Dollars (SGD) and inclusive of 9% GST unless otherwise stated.
4. Any variations to the original scope of work will be charged separately.
5. The right to withhold services until payment is received.
6. All work will be carried out in accordance with relevant codes and safety regulations.

CONFIDENTIAL DOCUMENT - This document contains proprietary information and is intended solely for the use of the addressee.

This document is computer generated. No signature is required.`
}

// Generate next quotation number with global running sequence
// Format: Q25-01-{RunningNo} where 25 is year and 01 is month
// Running number is continuous across all months (no reset)
async function generateQuotationNumber(customerId: string): Promise<string> {
  try {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2) // Last 2 digits of year (2025 -> 25)
    const month = (now.getMonth() + 1).toString().padStart(2, '0') // Month with leading zero (01-12)
    const prefix = `Q${year}-${month}-`

    // Get the highest existing quotation number globally (across all months/years)
    const lastQuotation = await prisma.quotation.findFirst({
      where: {
        quotationNumber: {
          // Match any quotation number in the Q{YY}-{MM}-{NNNN} format
          startsWith: 'Q'
        }
      },
      orderBy: {
        quotationNumber: 'desc'
      },
      select: {
        quotationNumber: true
      }
    })

    let nextNumber = 1

    if (lastQuotation?.quotationNumber) {
      // Extract the running number (Q25-01-0230 -> 0230)
      const match = lastQuotation.quotationNumber.match(/Q\d{2}-\d{2}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    // Format with leading zeros to 5 digits (00001-99999)
    return `${prefix}${nextNumber.toString().padStart(5, '0')}`
  } catch (error) {
    console.error('Error generating quotation number:', error)
    // Fallback to timestamp-based number if there's an error
    const timestamp = Date.now().toString().slice(-6)
    return `Q-ERR-${timestamp}`
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', { code: 'AUTH_REQUIRED' }),
        { status: 401 }
      )
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const isVariationOrder = searchParams.get('isVariationOrder')

    // Build where clause
    const where: any = {}
    
    if (projectId) {
      where.projectId = projectId
    }
    
    if (isVariationOrder === 'true') {
      where.isVariationOrder = true
    }

    // Fetch quotations from database
    const quotations = await prisma.quotation.findMany({
      where,
      include: {
        Customer: {
          select: {
            name: true
          }
        },
        Tender: {
          select: {
            tenderNumber: true
          }
        },
        User_Quotation_salespersonIdToUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        User_Quotation_createdByIdToUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        User_Quotation_approvedByIdToUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        User_Quotation_customerApprovedByIdToUser: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const formattedQuotations = ensureArray(quotations).map((quotation) => {
      try {
        return {
          id: quotation.id,
          quotationNumber: quotation.quotationNumber,
          version: quotation.version,
          title: quotation.title || 'Untitled Quotation',
          description: quotation.description || '',
          clientName: quotation.Customer?.name || 'Unknown',
          customerId: quotation.customerId,
          clientId: quotation.customerId, // Legacy support
          tenderNumber: quotation.Tender?.tenderNumber || null,
          subtotal: Number(quotation.subtotal) || 0,
          taxAmount: Number(quotation.taxAmount) || 0,
          totalAmount: Number(quotation.totalAmount) || 0,
          status: quotation.status || 'DRAFT',
          validUntil: quotation.validUntil?.toISOString() || new Date().toISOString(),
          salesperson: quotation.User_Quotation_salespersonIdToUser 
            ? `${quotation.User_Quotation_salespersonIdToUser.firstName || ''} ${quotation.User_Quotation_salespersonIdToUser.lastName || ''}`.trim()
            : 'Unassigned',
          requiresApproval: quotation.requiresApproval || false,
          approvalValue: Number(quotation.approvalValue) || 0,
          createdAt: quotation.createdAt?.toISOString() || new Date().toISOString(),
          approvedAt: quotation.approvedAt?.toISOString() || null,
          isSuperseded: quotation.parentQuotationId !== null,
          isVariationOrder: quotation.isVariationOrder || false,
          variationOrderType: quotation.variationOrderType || null,
          isCustomerApproved: quotation.isCustomerApproved || false,
          customerApprovedAt: quotation.customerApprovedAt?.toISOString() || null,
          User_Quotation_createdByIdToUser: quotation.User_Quotation_createdByIdToUser || null,
          User_Quotation_approvedByIdToUser: quotation.User_Quotation_approvedByIdToUser || null,
          User_Quotation_customerApprovedByIdToUser: quotation.User_Quotation_customerApprovedByIdToUser || null
        }
      } catch (error) {
        console.error(`Error formatting quotation ${quotation.id}:`, error)
        // Return minimal valid quotation object to avoid breaking the entire response
        return {
          id: quotation.id,
          quotationNumber: quotation.quotationNumber || 'ERROR',
          version: quotation.version || 1,
          title: 'Error Loading Quotation',
          description: '',
          clientName: 'Unknown',
          customerId: quotation.customerId,
          clientId: quotation.customerId,
          tenderNumber: null,
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
          status: 'DRAFT',
          validUntil: new Date().toISOString(),
          salesperson: 'Unassigned',
          requiresApproval: false,
          approvalValue: 0,
          createdAt: new Date().toISOString(),
          approvedAt: null,
          isSuperseded: false,
          isVariationOrder: false,
          variationOrderType: null,
          isCustomerApproved: false,
          customerApprovedAt: null,
          User_Quotation_createdByIdToUser: null,
          User_Quotation_approvedByIdToUser: null,
          User_Quotation_customerApprovedByIdToUser: null
        }
      }
    })

    return NextResponse.json(
      createSuccessResponse(formattedQuotations, {
        message: `${formattedQuotations.length} quotation(s) retrieved`,
        meta: { totalCount: formattedQuotations.length }
      })
    )

  } catch (error) {
    console.error('Error fetching quotations:', error)
    if (error instanceof Error) {
      console.error('Error details:', { message: error.message, stack: error.stack })
    }
    return NextResponse.json(
      createErrorResponse('Failed to fetch quotations', {
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }),
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    // Allow all authenticated users to create quotations since we have approval workflows
    const canCreateQuotation = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canCreateQuotation) {
      return NextResponse.json({ error: 'Insufficient permissions to create quotations' }, { status: 403 })
    }

    const data = await request.json()
    console.log('Received quotation data:', JSON.stringify(data, null, 2))
    
    // Remove fields that don't exist in the schema (used for frontend calculations only)
    const { discountPercentage, taxPercentage, ...quotationData } = data

    // Enhanced validation with better error messages
    if (!quotationData.customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }
    
    if (!quotationData.title || quotationData.title.trim() === '') {
      return NextResponse.json({ error: 'Quotation title is required' }, { status: 400 })
    }

    // Verify client exists
    const clientExists = await prisma.customer.findUnique({
      where: { id: quotationData.customerId },
      select: { id: true }
    })

    if (!clientExists) {
      return NextResponse.json({ error: 'Selected client not found' }, { status: 400 })
    }

    // Generate the next quotation number
    const quotationNumber = await generateQuotationNumber(quotationData.customerId)

    // Ensure line items are properly formatted
    const lineItems = Array.isArray(quotationData.lineItems) ? quotationData.lineItems : []
    
    // Create quotation with line items in a transaction
    const quotation = await prisma.$transaction(async (tx: any) => {
      // Create the quotation first with safer defaults
      const newQuotation = await tx.quotation.create({
        data: {
          id: uuidv4(),
          quotationNumber,
          version: 1,
          title: quotationData.title.trim(),
          description: quotationData.description || '',
          clientReference: quotationData.clientReference || '',
          customerId: quotationData.customerId,
          projectId: quotationData.projectId || null,
          tenderId: quotationData.tenderId && quotationData.tenderId !== "no-tender" ? quotationData.tenderId : null,
          salespersonId: quotationData.salespersonId || session.user?.id || '',
          subtotal: Number(quotationData.subtotal) || 0,
          taxAmount: Number(quotationData.taxAmount) || 0,
          discountAmount: Number(quotationData.discountAmount) || 0,
          totalAmount: Number(quotationData.totalAmount) || 0,
          currency: quotationData.currency || 'SGD',
          status: quotationData.status || 'DRAFT',
          validUntil: quotationData.validUntil ? new Date(quotationData.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          validityDays: quotationData.validityDays || 30,
          paymentTerms: quotationData.paymentTerms || null,
          additionalTerms: quotationData.additionalTerms || '',
          terms: quotationData.terms || getStandardTerms(),
          notes: quotationData.notes || '',
          templateType: quotationData.templateType || 'standard',
          requiresApproval: Number(quotationData.totalAmount) > 100, // $100 threshold for approval
          approvalValue: Number(quotationData.totalAmount) || 0,
          isVariationOrder: quotationData.isVariationOrder || false,
          variationOrderType: quotationData.variationOrderType || null,
          createdById: session.user?.id || '',
          updatedAt: new Date()
        }
      })

      // Create line items if provided
      if (lineItems.length > 0) {
        const itemPromises = lineItems.map((item: any, index: number) => {
          // Ensure all required fields have safe defaults
          return tx.quotationItem.create({
            data: {
              id: uuidv4(),
              quotationId: newQuotation.id,
              description: item.description || '',
              category: item.type === 'subtitle' ? 'SUBTITLE' : (item.category || 'MATERIALS'),
              quantity: item.type === 'subtitle' ? 0 : (parseFloat(String(item.quantity)) || 1),
              unitPrice: item.type === 'subtitle' ? 0 : (parseFloat(String(item.unitPrice)) || 0),
              discount: null, // No longer used at item level
              taxRate: null, // No longer used at item level
              subtotal: parseFloat(String(item.subtotal)) || 0,
              discountAmount: null, // No longer used at item level
              taxAmount: null, // No longer used at item level
              totalPrice: parseFloat(String(item.totalPrice)) || 0,
              unit: item.type === 'subtitle' ? '' : (item.unit || 'pcs'),
              notes: item.notes || '',
              order: index + 1
            }
          })
        })
        
        await Promise.all(itemPromises)
        
        // Store items in library for future use with proper average price calculation
        await Promise.all(
          lineItems
            .filter((item: any) => item.type !== 'subtitle' && item.description && item.unitPrice > 0)
            .map(async (item: any) => {
              try {
                // Find existing item
                const existing = await tx.quotationItemLibrary.findFirst({
                  where: {
                    description: item.description,
                    category: item.category || 'MATERIALS',
                    unit: item.unit || 'pcs'
                  }
                })

                if (existing) {
                  // Calculate new running average
                  const newUsageCount = existing.usageCount + 1
                  const newAveragePrice = (
                    (Number(existing.averageUnitPrice) * existing.usageCount + Number(item.unitPrice)) / 
                    newUsageCount
                  )

                  await tx.quotationItemLibrary.update({
                    where: { id: existing.id },
                    data: {
                      lastUnitPrice: Number(item.unitPrice),
                      averageUnitPrice: newAveragePrice,
                      usageCount: newUsageCount,
                      lastUsedAt: new Date(),
                      updatedAt: new Date()
                    }
                  })
                } else {
                  // Create new item
                  await tx.quotationItemLibrary.create({
                    data: {
                      id: uuidv4(),
                      description: item.description,
                      category: item.category || 'MATERIALS',
                      unit: item.unit || 'pcs',
                      averageUnitPrice: Number(item.unitPrice),
                      lastUnitPrice: Number(item.unitPrice),
                      usageCount: 1,
                      createdById: session.user?.id || '',
                      lastUsedAt: new Date(),
                      createdAt: new Date(),
                      updatedAt: new Date()
                    }
                  })
                }
              } catch (libError) {
                console.error('Error updating item library:', libError)
                // Don't fail the quotation creation if library update fails
              }
            })
        )
      }

      // Create activity log
      await tx.quotationActivity.create({
        data: {
          id: uuidv4(),
          quotationId: newQuotation.id,
          action: 'CREATED',
          description: `Quotation ${quotationNumber} created by ${session.user?.firstName} ${session.user?.lastName}`,
          oldValue: null,
          newValue: 'DRAFT',
          userId: session.user?.id || '',
          userEmail: session.user?.email || ''
        }
      })

      // Return quotation with all related data
      return await tx.quotation.findUnique({
        where: { id: newQuotation.id },
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              customerNumber: true,
              email: true,
              phone: true,
              customerType: true,
              address: true,
              city: true,
              state: true,
              postalCode: true,
              country: true
            }
          },
          Tender: {
            select: {
              id: true,
              tenderNumber: true,
              title: true
            }
          },
          User_Quotation_salespersonIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          QuotationItem: {
            orderBy: {
              order: 'asc'
            }
          },
          QuotationApproval: {
            include: {
              User: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      })
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 })
    }

    // Generate PDF asynchronously (don't block the response)
    try {
      const pdfData = {
        id: quotation.id,
        quotationNumber: quotation.quotationNumber,
        version: quotation.version,
        title: quotation.title,
        description: quotation.description,
        clientReference: quotation.clientReference,
        subtotal: Number(quotation.subtotal),
        taxAmount: quotation.taxAmount ? Number(quotation.taxAmount) : null,
        discountAmount: quotation.discountAmount ? Number(quotation.discountAmount) : null,
        totalAmount: Number(quotation.totalAmount),
        currency: quotation.currency,
        validUntil: quotation.validUntil,
        terms: quotation.terms,
        notes: quotation.notes,
        client: quotation.Customer ? {
          name: quotation.Customer.name,
          email: quotation.Customer.email,
          phone: quotation.Customer.phone,
          address: quotation.Customer.address,
          city: quotation.Customer.city,
          state: quotation.Customer.state,
          postalCode: quotation.Customer.postalCode,
          country: quotation.Customer.country
        } : undefined,
        items: quotation.QuotationItem?.map((item: any) => ({
          description: item.description,
          category: item.category,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice)
        })) || []
      }

      // Generate PDF in background (don't await to avoid blocking response)
      generateAndStoreQuotationPDF(pdfData, session.user?.id || '').catch(error => {
        console.error('Failed to generate quotation PDF:', error)
        // Log the error but don't fail the quotation creation
      })
    } catch (error) {
      console.error('Error preparing PDF data:', error)
      // Don't fail quotation creation due to PDF generation issues
    }

    // Create audit log for dashboard Recent Activities
    await createAuditLog({
      userId: session.user?.id || '',
      userEmail: session.user?.email || '',
      action: 'CREATE',
      entityType: 'QUOTATION',
      entityId: quotation.id,
      entityName: quotation.title || `${quotation.quotationNumber}`,  // Add entity name for detailed display
      newValues: {
        quotationNumber: quotation.quotationNumber,
        title: quotation.title,
        customer: quotation.Customer?.name,
        totalAmount: quotation.totalAmount
      }
    })

    return NextResponse.json(
      createSuccessResponse({
        id: quotation.id,
        quotationNumber: quotation.quotationNumber,
        version: quotation.version,
        title: quotation.title,
        clientName: quotation.Customer?.name || 'Unknown Client',
        status: quotation.status,
        totalAmount: quotation.totalAmount,
        createdAt: quotation.createdAt.toISOString()
      }, {
        message: `Quotation ${quotation.quotationNumber} created successfully`
      }),
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating quotation:', error)
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    // Return a proper JSON error response
    return NextResponse.json(
      createErrorResponse('Failed to create quotation', {
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }),
      { status: 500 }
    )
  }
}

