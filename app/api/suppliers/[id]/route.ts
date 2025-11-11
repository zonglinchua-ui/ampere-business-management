
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
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

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Return 410 Gone if supplier is soft-deleted
    if (supplier.isDeleted) {
      return NextResponse.json({ 
        error: 'Supplier has been deleted',
        deletedAt: supplier.deletedAt,
        deletedBy: supplier.deletedBy
      }, { status: 410 })
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check if supplier exists and is not deleted
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: params.id }
    })

    if (!existingSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    if (existingSupplier.isDeleted) {
      return NextResponse.json({ 
        error: 'Supplier has been deleted and cannot be updated',
        deletedAt: existingSupplier.deletedAt,
        deletedBy: existingSupplier.deletedBy
      }, { status: 410 })
    }

    // Build update data object with all Xero-aligned fields
    const updateData: any = {
      updatedAt: new Date()
    }

    // Only update fields that are present in the request
    if (body.name !== undefined) updateData.name = body.name
    if (body.firstName !== undefined) updateData.firstName = body.firstName
    if (body.lastName !== undefined) updateData.lastName = body.lastName
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson
    
    // Contact Details
    if (body.emailAddress !== undefined) updateData.emailAddress = body.emailAddress
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.mobile !== undefined) updateData.mobile = body.mobile
    if (body.fax !== undefined) updateData.fax = body.fax
    if (body.website !== undefined) updateData.website = body.website
    if (body.skypeUserName !== undefined) updateData.skypeUserName = body.skypeUserName
    
    // Legacy Address Fields
    if (body.address !== undefined) updateData.address = body.address
    if (body.city !== undefined) updateData.city = body.city
    if (body.state !== undefined) updateData.state = body.state
    if (body.country !== undefined) updateData.country = body.country
    if (body.postalCode !== undefined) updateData.postalCode = body.postalCode
    
    // Mailing Address
    if (body.mailingAttention !== undefined) updateData.mailingAttention = body.mailingAttention
    if (body.mailingLine1 !== undefined) updateData.mailingLine1 = body.mailingLine1
    if (body.mailingLine2 !== undefined) updateData.mailingLine2 = body.mailingLine2
    if (body.mailingLine3 !== undefined) updateData.mailingLine3 = body.mailingLine3
    if (body.mailingLine4 !== undefined) updateData.mailingLine4 = body.mailingLine4
    if (body.mailingCity !== undefined) updateData.mailingCity = body.mailingCity
    if (body.mailingRegion !== undefined) updateData.mailingRegion = body.mailingRegion
    if (body.mailingPostalCode !== undefined) updateData.mailingPostalCode = body.mailingPostalCode
    if (body.mailingCountry !== undefined) updateData.mailingCountry = body.mailingCountry
    
    // Street Address
    if (body.streetAttention !== undefined) updateData.streetAttention = body.streetAttention
    if (body.streetLine1 !== undefined) updateData.streetLine1 = body.streetLine1
    if (body.streetLine2 !== undefined) updateData.streetLine2 = body.streetLine2
    if (body.streetLine3 !== undefined) updateData.streetLine3 = body.streetLine3
    if (body.streetLine4 !== undefined) updateData.streetLine4 = body.streetLine4
    if (body.streetCity !== undefined) updateData.streetCity = body.streetCity
    if (body.streetRegion !== undefined) updateData.streetRegion = body.streetRegion
    if (body.streetPostalCode !== undefined) updateData.streetPostalCode = body.streetPostalCode
    if (body.streetCountry !== undefined) updateData.streetCountry = body.streetCountry
    
    // Company & Financial Information
    if (body.companyReg !== undefined) updateData.companyReg = body.companyReg
    if (body.taxNumber !== undefined) updateData.taxNumber = body.taxNumber
    if (body.accountNumber !== undefined) updateData.accountNumber = body.accountNumber
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.supplierType !== undefined) updateData.supplierType = body.supplierType
    if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms
    if (body.contractDetails !== undefined) updateData.contractDetails = body.contractDetails
    
    // Bank Information
    if (body.bankName !== undefined) updateData.bankName = body.bankName
    if (body.bankAccountNumber !== undefined) updateData.bankAccountNumber = body.bankAccountNumber
    if (body.bankAccountName !== undefined) updateData.bankAccountName = body.bankAccountName
    if (body.bankSwiftCode !== undefined) updateData.bankSwiftCode = body.bankSwiftCode
    if (body.bankAddress !== undefined) updateData.bankAddress = body.bankAddress
    
    // Xero-specific Fields
    if (body.defaultCurrency !== undefined) updateData.defaultCurrency = body.defaultCurrency
    if (body.salesDefaultAccountCode !== undefined) updateData.salesDefaultAccountCode = body.salesDefaultAccountCode
    if (body.purchasesDefaultAccountCode !== undefined) updateData.purchasesDefaultAccountCode = body.purchasesDefaultAccountCode
    if (body.xeroContactId !== undefined) updateData.xeroContactId = body.xeroContactId
    if (body.xeroUpdatedDateUtc !== undefined) updateData.xeroUpdatedDateUtc = body.xeroUpdatedDateUtc
    if (body.isSupplier !== undefined) updateData.isSupplier = body.isSupplier
    if (body.isCustomer !== undefined) updateData.isCustomer = body.isCustomer

    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json(supplier)
  } catch (error: any) {
    console.error('Error updating supplier:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Require authentication
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Require SUPERADMIN role
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admins can delete contacts' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { hard = false, reason = '' } = body as { hard?: boolean; reason?: string }

    // Find existing supplier (including soft-deleted)
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: params.id },
    })

    if (!existingSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Check if already deleted
    if (existingSupplier.isDeleted) {
      return NextResponse.json({ 
        error: 'Supplier is already deleted',
        deletedAt: existingSupplier.deletedAt,
        deletedBy: existingSupplier.deletedBy
      }, { status: 410 })
    }

    // Soft delete (default behavior)
    if (!hard) {
      await prisma.supplier.update({
        where: { id: params.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: session.user.id,
          isActive: false, // Also set isActive to false for backward compatibility
        },
      })

      console.log(`[Supplier Delete] Soft deleted supplier: ${existingSupplier.name} by ${session.user.email}. Reason: ${reason || 'No reason provided'}`)

      return NextResponse.json({ 
        status: 'soft-deleted',
        message: 'Supplier soft-deleted successfully. This does not affect Xero.'
      })
    }

    // Hard delete path - check for dependencies first
    const [
      documentCount,
      projectSupplierCount,
      transactionCount,
      purchaseOrderCount,
      contractCount,
      invoiceCount,
      reportCount,
      serviceJobCount,
      serviceContractSupplierCount
    ] = await Promise.all([
      prisma.document.count({ where: { supplierId: params.id } }),
      prisma.projectSupplier.count({ where: { supplierId: params.id } }),
      prisma.projectTransaction.count({ where: { supplierId: params.id } }),
      prisma.purchaseOrder.count({ where: { supplierId: params.id } }),
      prisma.supplierContract.count({ where: { supplierId: params.id } }),
      prisma.supplierInvoice.count({ where: { supplierId: params.id } }),
      prisma.supplierReport.count({ where: { supplierId: params.id } }),
      prisma.serviceJob.count({ where: { assignedToId: params.id, assignedToType: 'Supplier' } }),
      prisma.serviceContractSupplier.count({ where: { supplierId: params.id } }),
    ])

    const totalRefs = documentCount + projectSupplierCount + transactionCount + 
                      purchaseOrderCount + contractCount + invoiceCount + 
                      reportCount + serviceJobCount + serviceContractSupplierCount

    if (totalRefs > 0) {
      const refs = {
        documents: documentCount,
        projectSuppliers: projectSupplierCount,
        transactions: transactionCount,
        purchaseOrders: purchaseOrderCount,
        contracts: contractCount,
        invoices: invoiceCount,
        reports: reportCount,
        serviceJobs: serviceJobCount,
        serviceContractSuppliers: serviceContractSupplierCount,
        total: totalRefs
      }

      console.error(`[Supplier Delete] Hard delete blocked for supplier: ${existingSupplier.name}. Has ${totalRefs} linked records.`)

      return NextResponse.json({
        error: 'Supplier has linked records and cannot be hard deleted',
        details: refs,
        suggestion: 'Use soft delete instead, or remove all linked records first.'
      }, { status: 409 })
    }

    // No dependencies - proceed with hard delete
    await prisma.supplier.delete({
      where: { id: params.id },
    })

    console.log(`[Supplier Delete] Hard deleted supplier: ${existingSupplier.name} by ${session.user.email}. Reason: ${reason || 'No reason provided'}`)

    return NextResponse.json({ 
      status: 'hard-deleted',
      message: 'Supplier permanently deleted'
    })

  } catch (error: any) {
    console.error('Error deleting supplier:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    )
  }
}
