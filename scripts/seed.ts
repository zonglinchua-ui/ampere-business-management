
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'


async function main() {
  console.log('🌱 Starting database seeding...')

  // Clean existing data in development
  await prisma.auditLog.deleteMany()
  // Financial data cleanup (order is important due to foreign key constraints)
  await prisma.xero_logs.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.supplierInvoiceActivity.deleteMany()
  await prisma.supplierInvoiceItem.deleteMany()
  await prisma.supplierInvoice.deleteMany()
  await prisma.customerInvoiceItem.deleteMany()
  await prisma.customerInvoice.deleteMany()
  await prisma.purchaseOrderActivity.deleteMany()
  await prisma.purchaseOrderItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.legacyInvoice.deleteMany()
  // Business data cleanup
  await prisma.quotationActivity.deleteMany()
  await prisma.quotationApproval.deleteMany()
  await prisma.quotationTemplate.deleteMany()
  await prisma.quotationItem.deleteMany()
  await prisma.quotation.deleteMany()
  await prisma.costMapping.deleteMany()
  await prisma.measurement.deleteMany()
  await prisma.detectedElement.deleteMany()
  await prisma.planSheet.deleteMany()
  await prisma.tenderTakeoffPackage.deleteMany()
  await prisma.costAssembly.deleteMany()
  await prisma.costCode.deleteMany()
  await prisma.tenderActivity.deleteMany()
  await prisma.tender.deleteMany()
  await prisma.supplierContract.deleteMany()
  await prisma.projectSupplier.deleteMany()
  // Delete dependent records first to avoid foreign key constraint violations
  await prisma.quotationItemLibrary.deleteMany()
  await prisma.document.deleteMany()
  await prisma.project.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.budgetCategory.deleteMany()
  // Authentication data cleanup
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  console.log('🧹 Cleaned existing data')

  // Create Super Admin accounts
  const zackPassword = await bcrypt.hash('Czl914816', 12)
  const endyPassword = await bcrypt.hash('Endy548930', 12)
  const defaultPassword = await bcrypt.hash('password123', 12)

  // SuperAdmin User - Zack
  const superAdmin = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'zack',
      password: zackPassword,
      firstName: 'Zack',
      lastName: 'Admin',
      name: 'Zack',
      role: 'SUPERADMIN',
      companyName: 'Ampere Engineering Pte Ltd',
      isActive: true,
      updatedAt: new Date()
    },
  })

  // SuperAdmin User - Endy
  const superAdmin2 = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'endy',
      password: endyPassword,
      firstName: 'Endy',
      lastName: 'Admin',
      name: 'Endy',
      role: 'SUPERADMIN',
      companyName: 'Ampere Engineering Pte Ltd',
      isActive: true,
      updatedAt: new Date()
    },
  })

  // Project Manager User  
  const projectManager = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'pm',
      password: defaultPassword,
      firstName: 'Project',
      lastName: 'Manager',
      name: 'Project Manager',
      role: 'PROJECT_MANAGER',
      companyName: 'Ampere Engineering Pte Ltd',
      isActive: true,
      updatedAt: new Date()
    },
  })

  // Finance User
  const financeUser = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'finance',
      password: defaultPassword,
      firstName: 'Finance',
      lastName: 'Team',
      name: 'Finance Team',
      role: 'FINANCE',
      companyName: 'Ampere Engineering Pte Ltd',
      isActive: true,
      updatedAt: new Date()
    },
  })

  console.log('👥 Created test users')

  // Create system budget categories
  const systemCategories = [
    { code: 'GENERAL', name: 'General', color: '#6B7280', icon: '📋' },
    { code: 'MATERIALS', name: 'Materials', color: '#10B981', icon: '🧱' },
    { code: 'LABOR', name: 'Labor', color: '#3B82F6', icon: '👷' },
    { code: 'EQUIPMENT', name: 'Equipment', color: '#F59E0B', icon: '🏗️' },
    { code: 'SUBCONTRACTOR', name: 'Subcontractor', color: '#8B5CF6', icon: '🤝' },
    { code: 'PERMITS', name: 'Permits', color: '#EF4444', icon: '📜' },
    { code: 'TRANSPORTATION', name: 'Transportation', color: '#14B8A6', icon: '🚚' },
    { code: 'OVERHEAD', name: 'Overhead', color: '#F97316', icon: '💼' },
    { code: 'CONTINGENCY', name: 'Contingency', color: '#EC4899', icon: '💰' },
    { code: 'OTHER', name: 'Other', color: '#64748B', icon: '📌' },
  ]

  for (const category of systemCategories) {
    await prisma.budgetCategory.upsert({
      where: { code: category.code },
      update: {},
      create: {
        id: category.code, // Use the code as the ID for system categories
        code: category.code,
        name: category.name,
        color: category.color,
        icon: category.icon,
        description: `System category: ${category.name}`,
        isActive: true,
        isDefault: true,
        createdById: superAdmin.id
      }
    })
  }

  console.log('📊 Created system budget categories')

  const costCodes = [
    { code: 'CC-100', name: 'Site Preparation', description: 'Excavation, temporary facilities, and mobilization.', category: 'General Conditions' },
    { code: 'CC-200', name: 'Concrete Works', description: 'Formwork, reinforcement, and concrete placement.', category: 'Structural' },
    { code: 'CC-300', name: 'Electrical Rough-In', description: 'Conduit, cable trays, and panel setup.', category: 'MEP' }
  ]

  for (const costCode of costCodes) {
    await prisma.costCode.upsert({
      where: { code: costCode.code },
      update: {
        name: costCode.name,
        description: costCode.description,
        category: costCode.category,
        updatedAt: new Date()
      },
      create: {
        code: costCode.code,
        name: costCode.name,
        description: costCode.description,
        category: costCode.category
      }
    })
  }

  const costAssemblies = [
    {
      code: 'ASM-100',
      name: 'Concrete Footing Assembly',
      description: 'Includes excavation, rebar placement, and concrete pour.',
      costCodeCode: 'CC-200',
      unit: 'SQUARE_METER',
      rate: '120.00'
    },
    {
      code: 'ASM-200',
      name: 'Electrical Riser Installation',
      description: 'Risers, conduits, and panel connections.',
      costCodeCode: 'CC-300',
      unit: 'METER',
      rate: '85.00'
    },
    {
      code: 'ASM-300',
      name: 'Site Hoarding Setup',
      description: 'Temporary hoarding and safety signage.',
      costCodeCode: 'CC-100',
      unit: 'ITEM',
      rate: '1500.00'
    }
  ]

  for (const assembly of costAssemblies) {
    const costCode = await prisma.costCode.findUnique({ where: { code: assembly.costCodeCode } })

    await prisma.costAssembly.upsert({
      where: { code: assembly.code },
      update: {
        name: assembly.name,
        description: assembly.description,
        costCodeId: costCode?.id,
        unit: assembly.unit as Prisma.MeasurementUnit,
        rate: new Prisma.Decimal(assembly.rate),
        updatedAt: new Date()
      },
      create: {
        code: assembly.code,
        name: assembly.name,
        description: assembly.description,
        costCodeId: costCode?.id,
        unit: assembly.unit as Prisma.MeasurementUnit,
        rate: new Prisma.Decimal(assembly.rate)
      }
    })
  }

  console.log('🧾 Seeded cost codes and assemblies')

  console.log('🎉 Database seeding completed successfully!')
  console.log('\n📋 Test Accounts Created:')
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│                    TEST ACCOUNTS                        │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log('│ SuperAdmin:     zack                                    │')
  console.log('│ Password:       Czl914816                               │')
  console.log('│ SuperAdmin:     endy                                    │')
  console.log('│ Password:       Endy548930                              │')
  console.log('│ Project Manager: pm                                     │')
  console.log('│ Finance:        finance                                 │')
  console.log('│ Password (PM/Finance): password123                      │')
  console.log('└─────────────────────────────────────────────────────────┘')
  console.log('\n🧹 All mock/sample data removed - database is clean!')
  console.log('📋 Ready for your real business data!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:')
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
