
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { hasRouteAccess, UserRole } from "./lib/permissions"

const isDevelopment = process.env.NODE_ENV === 'development'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Only log in development
    if (isDevelopment) {
      console.log('🔒 Middleware - Path:', pathname, 'Token:', !!token, 'Role:', token?.role)
    }

    // Create response with security headers
    const response = NextResponse.next()
    
    // Add Content Security Policy headers for Tailscale Funnel, Xero OAuth and Google Maps
    const cspHeader = [
      "default-src 'self' https://czl-pc.tail2217a9.ts.net https://ampere.abacusai.app https://*.xero.com https://*.googleapis.com https://*.gstatic.com",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com https://maps.googleapis.com https://*.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https: http: https://*.googleapis.com https://*.gstatic.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://czl-pc.tail2217a9.ts.net https://ampere.abacusai.app https://login.xero.com https://identity.xero.com https://api.xero.com https://authorize.xero.com https://*.xero.com https://cloudflareinsights.com https://maps.googleapis.com https://*.googleapis.com https://abacus.ai",
      "frame-src 'self' https://login.xero.com https://authorize.xero.com https://*.xero.com",
      "form-action 'self' https://login.xero.com https://*.xero.com",
      "worker-src 'self' blob:"
    ].join('; ')
    
    response.headers.set('Content-Security-Policy', cspHeader)
    
    // Additional security headers
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    
    // HTTPS forwarding for Tailscale Funnel
    response.headers.set('X-Forwarded-Proto', 'https')

    // Check if user has access to this route based on their role
    const userRole = (token?.role as UserRole) || 'SUPPLIER'
    const hasAccess = hasRouteAccess(userRole, pathname)

    // Protected routes that require authentication and authorization
    const protectedRoutes = [
      "/dashboard", "/contacts", "/clients", "/suppliers", "/projects", 
      "/invoices", "/finance", "/tenders", "/quotations", "/tasks", 
      "/reports", "/servicing", "/users", "/settings", "/bca-workhead",
      "/ai-assistant", "/vendor-portal", "/company-profile"
    ]
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

    if (isProtectedRoute && !hasAccess) {
      if (isDevelopment) {
        console.log('❌ Access denied for role:', userRole, 'to path:', pathname)
      }
      const baseUrl = process.env.TAILSCALE_FUNNEL_URL || process.env.NEXTAUTH_URL || 'https://ampere.abacusai.app'
      return NextResponse.redirect(new URL("/auth/login?error=unauthorized", baseUrl))
    }

    if (isDevelopment) {
      console.log('✅ Access granted for role:', userRole)
    }
    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        if (isDevelopment) {
          console.log('🔐 Authorized callback - Path:', pathname, 'Token exists:', !!token, 'Token role:', token?.role)
        }

        // Allow access to auth pages and static files
        if (pathname.startsWith("/auth") || 
            pathname.startsWith("/_next") || 
            pathname.startsWith("/favicon") ||
            pathname === "/") {
          return true
        }

        // Allow access to API routes (they handle their own auth)
        if (pathname.startsWith("/api")) {
          return true
        }

        // For protected routes, require token
        const protectedRoutes = [
          "/dashboard", "/clients", "/contacts", "/suppliers", "/projects", 
          "/invoices", "/vendors", "/tenders", "/quotations", "/finance", 
          "/vendor-portal", "/users", "/settings", "/reports", "/servicing",
          "/bca-workhead", "/ai-assistant", "/company-profile", "/tasks"
        ]
        
        if (protectedRoutes.some(route => pathname.startsWith(route))) {
          const hasToken = !!token
          if (isDevelopment) {
            console.log(`🛡️ Protected route ${pathname} - Token exists: ${hasToken}`)
          }
          return hasToken
        }

        return true
      },
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/projects/:path*",
    "/invoices/:path*",
    "/vendors/:path*",
    "/tenders/:path*",
    "/quotations/:path*",
    "/finance/:path*",
    "/vendor-portal/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/reports/:path*",
  ],
}
