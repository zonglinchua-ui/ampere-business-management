
import { prisma } from './lib/db'

async function testCustomersAndSuppliersAPI() {
  console.log("\n=== Testing Customers & Suppliers API Queries ===\n")
  
  try {
    // Test 1: Count Customers
    console.log("1️⃣ Testing Customer Count...")
    const customerWhere = {
      isActive: true,
      isDeleted: false,
    }
    const customerCount = await prisma.customer.count({ where: customerWhere })
    console.log(`   ✅ Total active customers: ${customerCount}`)
    
    // Test 2: Fetch Customers with relations
    console.log("\n2️⃣ Testing Customer Query with Relations...")
    const customers = await prisma.customer.findMany({
      where: customerWhere,
      take: 3,
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
      orderBy: [{ createdAt: "desc" }]
    })
    console.log(`   ✅ Fetched ${customers.length} customers`)
    
    if (customers.length > 0) {
      const firstCustomer = customers[0]
      const totalProjectValue = firstCustomer.Project?.reduce((sum, project) => {
        return sum + (project.estimatedBudget ? Number(project.estimatedBudget) : 0)
      }, 0) || 0
      
      console.log(`\n   First customer details:`)
      console.log(`   - Name: ${firstCustomer.name}`)
      console.log(`   - Number: ${firstCustomer.customerNumber}`)
      console.log(`   - Projects Count: ${firstCustomer._count?.Project || 0}`)
      console.log(`   - Invoices Count: ${firstCustomer._count?.CustomerInvoice || 0}`)
      console.log(`   - Total Project Value: $${totalProjectValue.toFixed(2)}`)
    }
    
    // Test 3: Count Suppliers
    console.log("\n3️⃣ Testing Supplier Count...")
    const supplierWhere = {
      isActive: true,
      isDeleted: false,
    }
    const supplierCount = await prisma.supplier.count({ where: supplierWhere })
    console.log(`   ✅ Total active suppliers: ${supplierCount}`)
    
    // Test 4: Fetch Suppliers with relations
    console.log("\n4️⃣ Testing Supplier Query with Relations...")
    const suppliers = await prisma.supplier.findMany({
      where: supplierWhere,
      take: 3,
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
      orderBy: [{ createdAt: "desc" }]
    })
    console.log(`   ✅ Fetched ${suppliers.length} suppliers`)
    
    if (suppliers.length > 0) {
      const firstSupplier = suppliers[0]
      const totalPurchaseValue = firstSupplier.SupplierInvoice?.reduce((sum, invoice) => {
        return sum + (invoice.totalAmount ? Number(invoice.totalAmount) : 0)
      }, 0) || 0
      
      console.log(`\n   First supplier details:`)
      console.log(`   - Name: ${firstSupplier.name}`)
      console.log(`   - Number: ${firstSupplier.supplierNumber}`)
      console.log(`   - Invoices Count: ${firstSupplier._count?.SupplierInvoice || 0}`)
      console.log(`   - Total Purchase Value: $${totalPurchaseValue.toFixed(2)}`)
    }
    
    // Test 5: Test sorting with array format
    console.log("\n5️⃣ Testing Array-based OrderBy...")
    const sortedCustomers = await prisma.customer.findMany({
      where: customerWhere,
      take: 2,
      orderBy: [{ name: "asc" }]
    })
    console.log(`   ✅ Sorted customers fetched: ${sortedCustomers.length}`)
    if (sortedCustomers.length > 0) {
      console.log(`   - First: ${sortedCustomers[0].name}`)
    }
    
    console.log("\n✅ All tests passed successfully!\n")
    console.log("📊 Summary:")
    console.log(`   - Active Customers: ${customerCount}`)
    console.log(`   - Active Suppliers: ${supplierCount}`)
    console.log(`   - Total Contacts: ${customerCount + supplierCount}`)
    
  } catch (error) {
    console.error("\n❌ Test failed with error:")
    console.error(error)
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testCustomersAndSuppliersAPI()
