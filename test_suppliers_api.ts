
import { prisma } from './lib/db'

async function testSuppliersQuery() {
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
    
    if (suppliers.length > 0) {
      const firstSupplier = suppliers[0]
      console.log("\nFirst supplier:")
      console.log("  ID:", firstSupplier.id)
      console.log("  Name:", firstSupplier.name)
      console.log("  Supplier Number:", firstSupplier.supplierNumber)
      console.log("  Invoice Count:", firstSupplier._count?.SupplierInvoice)
      console.log("  Invoices data length:", firstSupplier.SupplierInvoice?.length)
    }
    
    console.log("\n✅ Test passed!")
  } catch (error) {
    console.error("❌ Test failed with error:")
    console.error(error)
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testSuppliersQuery()
