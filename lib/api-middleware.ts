import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { UserRole, canReadAPI, canWriteAPI, canDeleteAPI, getProjectFilter, getQuotationFilter, getTenderFilter, getFinanceFilter } from './permissions'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    role: UserRole
    email: string
    name?: string
  }
}

/**
 * Middleware to authenticate API requests
 */
export async function withAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }
    
    const authenticatedReq = req as AuthenticatedRequest
    authenticatedReq.user = {
      id: (session.user as any).id,
      role: (session.user as any).role,
      email: session.user.email || '',
      name: session.user.name || undefined,
    }
    
    return handler(authenticatedReq)
  }
}

/**
 * Middleware to check API read permissions
 */
export async function withReadPermission(
  apiPath: string,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async (req: AuthenticatedRequest) => {
    const userRole = req.user!.role
    
    if (!canReadAPI(userRole, apiPath)) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to read this resource' },
        { status: 403 }
      )
    }
    
    return handler(req)
  })
}

/**
 * Middleware to check API write permissions
 */
export async function withWritePermission(
  apiPath: string,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async (req: AuthenticatedRequest) => {
    const userRole = req.user!.role
    
    if (!canWriteAPI(userRole, apiPath)) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to write to this resource' },
        { status: 403 }
      )
    }
    
    return handler(req)
  })
}

/**
 * Middleware to check API delete permissions
 */
export async function withDeletePermission(
  apiPath: string,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async (req: AuthenticatedRequest) => {
    const userRole = req.user!.role
    
    if (!canDeleteAPI(userRole, apiPath)) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to delete this resource' },
        { status: 403 }
      )
    }
    
    return handler(req)
  })
}

/**
 * Get project filter for the current user
 */
export function getProjectFilterForUser(req: AuthenticatedRequest) {
  if (!req.user) return { id: 'impossible' }
  return getProjectFilter(req.user.id, req.user.role)
}

/**
 * Get quotation filter for the current user
 */
export function getQuotationFilterForUser(req: AuthenticatedRequest) {
  if (!req.user) return { id: 'impossible' }
  return getQuotationFilter(req.user.id, req.user.role)
}

/**
 * Get tender filter for the current user
 */
export function getTenderFilterForUser(req: AuthenticatedRequest) {
  if (!req.user) return { id: 'impossible' }
  return getTenderFilter(req.user.id, req.user.role)
}

/**
 * Get finance filter for the current user
 */
export function getFinanceFilterForUser(req: AuthenticatedRequest) {
  if (!req.user) return { id: 'impossible' }
  return getFinanceFilter(req.user.id, req.user.role)
}

/**
 * Check if user is SuperAdmin
 */
export function isSuperAdmin(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'SUPERADMIN'
}

/**
 * Check if user is Finance
 */
export function isFinance(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'FINANCE' || req.user?.role === 'SUPERADMIN'
}

/**
 * Check if user is Sales
 */
export function isSales(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'SALES' || req.user?.role === 'SUPERADMIN'
}

/**
 * Check if user is Project Manager
 */
export function isProjectManager(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'PROJECT_MANAGER' || req.user?.role === 'SUPERADMIN'
}
