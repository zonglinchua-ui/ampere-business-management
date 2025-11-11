import { prisma } from '@/lib/db'

const SYSTEM_CATEGORIES = [
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

let categoriesInitialized = false

export async function ensureSystemBudgetCategories() {
  // Skip if already initialized in this process
  if (categoriesInitialized) {
    return
  }

  try {
    // Get a super admin user to assign as creator
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' }
    })

    if (!superAdmin) {
      console.warn('No SUPERADMIN user found - skipping system budget categories creation')
      return
    }

    let created = 0
    let existing = 0

    for (const category of SYSTEM_CATEGORIES) {
      const result = await prisma.budgetCategory.upsert({
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
      
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++
      } else {
        existing++
      }
    }

    if (created > 0) {
      console.log(`✓ Created ${created} system budget categories`)
    }
    if (existing > 0) {
      console.log(`✓ Found ${existing} existing system budget categories`)
    }

    categoriesInitialized = true
  } catch (error) {
    console.error('Error ensuring system budget categories:', error)
    // Don't throw - allow app to continue even if this fails
  }
}

// Export the system categories for use in the frontend
export { SYSTEM_CATEGORIES }
