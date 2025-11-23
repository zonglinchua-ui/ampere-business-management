
/**
 * Role-Based Access Control (RBAC) System
 * 
 * Role Definitions:
 * - SUPERADMIN: Full access to everything
 * - SALES: Only sales-related features and their assigned projects
 * - PROJECT_MANAGER: Access to projects, quotations, tenders, and finance related to their projects
 * - FINANCE: Full access to finance module
 */

export type UserRole = 'SUPERADMIN' | 'PROJECT_MANAGER' | 'FINANCE' | 'SALES' | 'SUPPLIER'

export interface PermissionContext {
  role: UserRole
  userId: string
  projectId?: string
  customerId?: string
  supplierId?: string
}

/**
 * Define which routes each role can access
 */
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  SUPERADMIN: [
    '/dashboard',
    '/contacts',
    '/projects',
    '/quotations',
    '/tenders',
    '/invoices',
    '/finance',
    '/suppliers',
    '/clients',
    '/tasks',
    '/reports',
    '/servicing',
    '/users',
    '/settings',
    '/bca-workhead',
    '/ai-assistant',
    '/profile',
  ],
  SALES: [
    '/dashboard',
    '/contacts',
    '/projects', // Only their projects
    '/quotations', // Only their quotations
    '/tenders', // Only their tenders
    '/clients',
    '/reports',
    '/ai-assistant',
    '/profile',
  ],
  PROJECT_MANAGER: [
    '/dashboard',
    '/contacts',
    '/projects', // Only their projects
    '/quotations', // Full access to quotations
    '/tenders', // Full access to tenders
    '/finance', // Only their project finances
    '/suppliers',
    '/tasks',
    '/reports',
    '/servicing',
    '/ai-assistant',
    '/profile',
  ],
  FINANCE: [
    '/dashboard',
    '/contacts',
    '/projects', // View only for context
    '/finance', // Full access
    '/invoices',
    '/suppliers',
    '/clients',
    '/reports',
    '/ai-assistant',
    '/profile',
  ],
  SUPPLIER: [
    '/vendor-portal',
    '/profile',
  ],
}

/**
 * Define which API endpoints each role can access
 */
export const ROLE_API_PERMISSIONS: Record<UserRole, {
  read: string[]
  write: string[]
  delete: string[]
}> = {
  SUPERADMIN: {
    read: ['*'],
    write: ['*'],
    delete: ['*'],
  },
  SALES: {
    read: [
      '/api/dashboard',
      '/api/projects', // Filtered by salesperson
      '/api/quotations', // Filtered by salesperson
      '/api/tenders', // Filtered by salesperson
      '/api/customers',
      '/api/contacts',
      '/api/reports',
    ],
    write: [
      '/api/projects', // Only their projects
      '/api/quotations',
      '/api/tenders',
      '/api/customers',
    ],
    delete: [],
  },
  PROJECT_MANAGER: {
    read: [
      '/api/dashboard',
      '/api/projects', // Filtered by manager
      '/api/quotations', // Full access to quotations
      '/api/tenders', // Full access to tenders
      '/api/finance', // Only their project finances
      '/api/invoices', // Only their project invoices
      '/api/suppliers',
      '/api/contacts',
      '/api/tasks',
      '/api/reports',
      '/api/servicing',
    ],
    write: [
      '/api/projects', // Only their projects
      '/api/quotations', // Full access to quotations
      '/api/tenders', // Full access to tenders
      '/api/finance',
      '/api/invoices',
      '/api/tasks',
      '/api/servicing',
    ],
    delete: [],
  },
  FINANCE: {
    read: [
      '/api/dashboard',
      '/api/projects', // View only
      '/api/finance',
      '/api/invoices',
      '/api/payments',
      '/api/suppliers',
      '/api/customers',
      '/api/contacts',
      '/api/reports',
    ],
    write: [
      '/api/finance',
      '/api/invoices',
      '/api/payments',
      '/api/suppliers',
    ],
    delete: [
      '/api/invoices',
      '/api/payments',
    ],
  },
  SUPPLIER: {
    read: ['/api/vendor-portal'],
    write: [],
    delete: [],
  },
}

/**
 * Check if a role has access to a specific route
 */
export function hasRouteAccess(role: UserRole, path: string): boolean {
  if (role === 'SUPERADMIN') return true
  
  const allowedRoutes = ROLE_ROUTES[role] || []
  return allowedRoutes.some(route => path.startsWith(route))
}

/**
 * Check if a role can read from an API endpoint
 */
export function canReadAPI(role: UserRole, apiPath: string): boolean {
  if (role === 'SUPERADMIN') return true
  
  const permissions = ROLE_API_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions.read.includes('*') || 
         permissions.read.some(path => apiPath.startsWith(path))
}

/**
 * Check if a role can write to an API endpoint
 */
export function canWriteAPI(role: UserRole, apiPath: string): boolean {
  if (role === 'SUPERADMIN') return true
  
  const permissions = ROLE_API_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions.write.includes('*') || 
         permissions.write.some(path => apiPath.startsWith(path))
}

/**
 * Check if a role can delete from an API endpoint
 */
export function canDeleteAPI(role: UserRole, apiPath: string): boolean {
  if (role === 'SUPERADMIN') return true
  
  const permissions = ROLE_API_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions.delete.includes('*') || 
         permissions.delete.some(path => apiPath.startsWith(path))
}

/**
 * Check if user owns or manages a project
 */
export async function canAccessProject(
  userId: string,
  role: UserRole,
  projectId: string
): Promise<boolean> {
  if (role === 'SUPERADMIN') return true
  if (role === 'FINANCE') return true // Finance can view all projects
  
  // For SALES and PROJECT_MANAGER, check if they're assigned to the project
  const { prisma } = await import('./db')
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      managerId: true,
      salespersonId: true,
    },
  })
  
  if (!project) return false
  
  if (role === 'SALES') {
    return project.salespersonId === userId
  }
  
  if (role === 'PROJECT_MANAGER') {
    return project.managerId === userId
  }
  
  return false
}

/**
 * Check if user can access a quotation
 */
export async function canAccessQuotation(
  userId: string,
  role: UserRole,
  quotationId: string
): Promise<boolean> {
  if (role === 'SUPERADMIN') return true
  
  const { prisma } = await import('./db')
  
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: {
      salespersonId: true,
      projectId: true,
      Project: {
        select: {
          managerId: true,
        }
      }
    },
  })
  
  if (!quotation) return false
  
  // SALES can access their own quotations
  if (role === 'SALES') {
    return quotation.salespersonId === userId
  }
  
  // PROJECT_MANAGER can access quotations for their projects
  if (role === 'PROJECT_MANAGER') {
    return quotation.Project?.managerId === userId
  }
  
  return false
}

/**
 * Check if user can access finance data
 */
export function canAccessFinance(role: UserRole): boolean {
  return role === 'SUPERADMIN' || role === 'FINANCE' || role === 'PROJECT_MANAGER'
}

/**
 * Check if user can access user management
 */
export function canAccessUserManagement(role: UserRole): boolean {
  return role === 'SUPERADMIN'
}

/**
 * Check if user can access system settings
 */
export function canAccessSettings(role: UserRole): boolean {
  return role === 'SUPERADMIN'
}

/**
 * Check if user is a SUPERADMIN
 */
export function isSuperAdmin(role: UserRole): boolean {
  return role === 'SUPERADMIN'
}

/**
 * Check if user can edit/delete progress claims regardless of status
 */
export function canEditAnyProgressClaim(role: UserRole): boolean {
  return role === 'SUPERADMIN'
}

/**
 * Check if user can edit/delete invoices regardless of status
 */
export function canEditAnyInvoice(role: UserRole): boolean {
  return role === 'SUPERADMIN'
}

/**
 * Get filter for projects based on user role
 */
export function getProjectFilter(userId: string, role: UserRole) {
  if (role === 'SUPERADMIN' || role === 'FINANCE') {
    return {} // No filter, can see all
  }
  
  if (role === 'SALES') {
    return { salespersonId: userId }
  }
  
  if (role === 'PROJECT_MANAGER') {
    return { managerId: userId }
  }
  
  return { id: 'impossible' } // No access
}

/**
 * Get filter for quotations based on user role
 */
export function getQuotationFilter(userId: string, role: UserRole) {
  if (role === 'SUPERADMIN') {
    return {} // No filter, can see all
  }
  
  if (role === 'SALES') {
    return { salespersonId: userId }
  }
  
  if (role === 'PROJECT_MANAGER') {
    return {
      project: {
        managerId: userId
      }
    }
  }
  
  return { id: 'impossible' } // No access for other roles
}

/**
 * Get filter for tenders based on user role
 */
export function getTenderFilter(userId: string, role: UserRole) {
  if (role === 'SUPERADMIN') {
    return {} // No filter, can see all
  }
  
  if (role === 'SALES') {
    return { salespersonId: userId }
  }
  
  if (role === 'PROJECT_MANAGER') {
    return {
      project: {
        managerId: userId
      }
    }
  }
  
  return { id: 'impossible' } // No access for other roles
}

/**
 * Get filter for finance data based on user role
 */
export function getFinanceFilter(userId: string, role: UserRole) {
  if (role === 'SUPERADMIN' || role === 'FINANCE') {
    return {} // No filter, can see all
  }
  
  if (role === 'PROJECT_MANAGER') {
    // Can only see finance for their projects
    return {
      project: {
        managerId: userId
      }
    }
  }
  
  return { id: 'impossible' } // No access
}
