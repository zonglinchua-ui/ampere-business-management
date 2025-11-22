
import { prisma } from './lib/db'

async function testSuppliersQuery() {
  let exitCode = 0
  try {
    console.log("Testing suppliers query...")
    
    const where = {
      isActive: true,
      isDeleted: false,
    }
    
    // Test basic count
    const count = await prisma.supplier.count({ where })
    console.log(`Total active, non-deleted suppliers: ${count}`)
    
    // Test with includes (like the API does)
    const suppliers = await prisma.supplier.findMany({
      where,
      take: 5,
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
      orderBy: { createdAt: "desc" }
    })
    
    console.log(`Fetched ${suppliers.length} suppliers`)
    
    if (count <= 0) {
      throw new Error("Expected at least one active, non-deleted supplier but found none.")
    }

    if (suppliers.length === 0) {
      throw new Error("Expected supplier query to return results but it returned none.")
    }

    const firstSupplier = suppliers[0]
    console.log("\nFirst supplier:")
    console.log("  ID:", firstSupplier.id)
    console.log("  Name:", firstSupplier.name)
    console.log("  Supplier Number:", firstSupplier.supplierNumber)
    console.log("  Invoice Count:", firstSupplier._count?.SupplierInvoice)
    console.log("  Invoices data length:", firstSupplier.SupplierInvoice?.length)

    suppliers.forEach((supplier, index) => {
      const invoiceCount = supplier._count?.SupplierInvoice ?? 0
      const invoicesLength = supplier.SupplierInvoice?.length ?? 0

      if (invoiceCount !== invoicesLength) {
        throw new Error(
          `Supplier at index ${index} has mismatched invoice counts: _count=${invoiceCount}, SupplierInvoice length=${invoicesLength}`
        )
      }
    })

    console.log("\n✅ Test passed!")
  } catch (error) {
    console.error("❌ Test failed with error:")
    console.error(error)
    exitCode = 1
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
  } finally {
    await prisma.$disconnect()
    if (exitCode !== 0) {
      process.exit(exitCode)
    }
  }
}

testSuppliersQuery()
