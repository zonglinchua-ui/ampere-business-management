'use client'

import { useSession } from 'next-auth/react'
import { UserRole, hasRouteAccess, canAccessFinance, canAccessUserManagement, canAccessSettings } from '@/lib/permissions'

export function usePermissions() {
  const { data: session } = useSession()
  
  const role = (session?.user as any)?.role as UserRole || 'SUPPLIER'
  const userId = (session?.user as any)?.id as string
  
  return {
    role,
    userId,
    isSuperAdmin: role === 'SUPERADMIN',
    isSales: role === 'SALES',
    isProjectManager: role === 'PROJECT_MANAGER',
    isFinance: role === 'FINANCE',
    isSupplier: role === 'SUPPLIER',
    
    // Route access
    hasRouteAccess: (path: string) => hasRouteAccess(role, path),
    
    // Module access
    canAccessFinance: () => canAccessFinance(role),
    canAccessUserManagement: () => canAccessUserManagement(role),
    canAccessSettings: () => canAccessSettings(role),
    
    // Check if user can manage projects
    canManageProjects: role === 'SUPERADMIN' || role === 'PROJECT_MANAGER',
    
    // Check if user can manage quotations/tenders
    canManageQuotations: role === 'SUPERADMIN' || role === 'SALES',
    canManageTenders: role === 'SUPERADMIN' || role === 'SALES',
    
    // Check if user has full finance access
    hasFullFinanceAccess: role === 'SUPERADMIN' || role === 'FINANCE',
    
    // Check if user can view all projects
    canViewAllProjects: role === 'SUPERADMIN' || role === 'FINANCE',
  }
}
