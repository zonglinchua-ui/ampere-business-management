
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./db"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          console.log('ðŸ” Authorization attempt for:', credentials?.email)
          // Force production URL if preview URL is detected
          const correctNextAuthUrl = process.env.NEXTAUTH_URL?.includes('preview.abacusai.app') 
            ? 'https://ampere.abacusai.app' 
            : process.env.NEXTAUTH_URL || 'https://ampere.abacusai.app'
          
          console.log('ðŸ” Environment check:', {
            nodeEnv: process.env.NODE_ENV,
            nextauthUrl: correctNextAuthUrl,
            originalNextAuthUrl: process.env.NEXTAUTH_URL !== correctNextAuthUrl ? process.env.NEXTAUTH_URL : 'same',
            nextauthSecret: process.env.NEXTAUTH_SECRET ? '***configured***' : 'missing',
            databaseUrl: process.env.DATABASE_URL ? '***configured***' : 'missing',
          })
          
          if (!credentials?.email || !credentials?.password) {
            console.log('âŒ Missing credentials:', { 
              email: !!credentials?.email, 
              password: !!credentials?.password 
            })
            return null
          }

          console.log('ðŸ”Ž Searching for user by username:', credentials.email)
          // Try to find user by username (name field) first with case-insensitive search
          let user = await prisma.user.findFirst({
            where: {
              name: {
                equals: credentials.email,
                mode: 'insensitive'
              }
            }
          })
          // If not found by userId, try by email
          if (!user) {
            console.log('ðŸ”Ž User not found by userId, trying email...')
            user = await prisma.user.findFirst({
              where: {
                email: {
                  equals: credentials.email,
                  mode: 'insensitive'
                }
              }
            })
          }

          if (!user) {
            console.log('âŒ User not found in database')
            return null
          }

          console.log('ðŸ‘¤ Found user:', {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            hasPassword: !!user.password
          })

          if (!user.password) {
            console.log('âŒ User has no password set')
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            console.log('âŒ Invalid password')
            return null
          }

          if (!user.isActive) {
            console.log('âŒ User account is inactive')
            return null
          }

          // Update last login
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() }
            })
            console.log('âœ… Updated last login timestamp')
          } catch (updateError) {
            console.warn('âš ï¸ Failed to update last login:', updateError)
            // Don't fail authentication if we can't update last login
          }

          const userResponse = {
            id: user.id,
            email: user.email || '',
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
            role: user.role,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            companyName: user.companyName || '',
          }

          console.log('âœ… Authentication successful for user:', {
            id: userResponse.id,
            name: userResponse.name,
            role: userResponse.role,
            email: userResponse.email
          })
          
          return userResponse
        } catch (error) {
          console.error('ðŸ’¥ Authorization error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours (1 working day) for internal testing
    updateAge: 60 * 60, // Update session every hour
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      console.log('ðŸ”„ NextAuth Redirect callback - URL:', url, 'Base URL:', baseUrl)
      
      // If the URL is relative to our site, allow it
      if (url.startsWith("/")) {
        const redirectUrl = `${baseUrl}${url}`
        console.log('âž¡ï¸ Redirecting to relative URL:', redirectUrl)
        return redirectUrl
      }
      
      // If the URL is on the same origin, allow it
      if (url.startsWith(baseUrl)) {
        console.log('âž¡ï¸ Redirecting to same origin:', url)
        return url
      }
      
      // Default to dashboard for safety
      const dashboardUrl = `${baseUrl}/dashboard`
      console.log('âž¡ï¸ Defaulting to dashboard:', dashboardUrl)
      return dashboardUrl
    },
    async jwt({ token, user, trigger, session }) {
      console.log('ðŸŽ« JWT Callback triggered:', { 
        trigger, 
        hasUser: !!user, 
        hasToken: !!token,
        tokenSub: token?.sub,
        userRole: user?.role 
      })
      
      // Always ensure token has required properties
      if (!token) {
        console.error('âŒ Token is null/undefined in JWT callback')
        return {}
      }
      
      if (user) {
        console.log('ðŸ‘¤ Adding user data to JWT token:', {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email
        })
        
        // Ensure all user data is properly copied to token
        token.id = user.id
        token.role = user.role || 'USER'
        token.firstName = user.firstName || ''
        token.lastName = user.lastName || ''
        token.companyName = user.companyName || ''
        token.name = user.name || token.name
        token.email = user.email || token.email
      }
      
      console.log('âœ… JWT token prepared:', {
        sub: token.sub,
        role: token.role,
        name: token.name,
        email: token.email
      })
      
      return token
    },
    async session({ session, token }) {
      console.log('ðŸ“‹ Session Callback:', { 
        hasSession: !!session, 
        hasToken: !!token, 
        tokenSub: token?.sub,
        tokenRole: token?.role 
      })
      
      // Ensure session and user object exist
      if (!session) {
        console.error('âŒ Session is null/undefined in session callback')
        return session
      }
      
      if (!session.user) {
        console.error('âŒ Session.user is null/undefined')
        session.user = {} as any
      }
      
      if (token && token.sub) {
        // Populate session with token data
        session.user.id = token.sub
        session.user.role = (token.role as string) || 'USER'
        session.user.firstName = (token.firstName as string) || ''
        session.user.lastName = (token.lastName as string) || ''
        session.user.companyName = (token.companyName as string) || ''
        
        // Ensure name and email are preserved
        if (token.name) session.user.name = token.name as string
        if (token.email) session.user.email = token.email as string
        
        console.log('âœ… Session user populated:', {
          id: session.user.id,
          name: session.user.name,
          role: session.user.role,
          email: session.user.email,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          companyName: session.user.companyName
        })
      } else {
        console.warn('âš ï¸ Token is missing or invalid in session callback')
      }
      
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  debug: true, // Enable debug for better logging
  logger: {
    error(code, metadata) {
      console.error('ðŸš¨ NextAuth Error:', { code, metadata })
    },
    warn(code) {
      console.warn('âš ï¸ NextAuth Warning:', code)
    },
    debug(code, metadata) {
      console.log('ðŸ› NextAuth Debug:', { code, metadata })
    },
  },
  // Add events for better debugging
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('ðŸŽ‰ NextAuth signIn event:', {
        user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
        account: account ? { provider: account.provider, type: account.type } : null,
        isNewUser
      })
    },
    async signOut({ session, token }) {
      console.log('ðŸ‘‹ NextAuth signOut event:', {
        session: session ? { user: session.user?.name } : null,
        token: token ? { sub: token.sub } : null
      })
    },
    async createUser({ user }) {
      console.log('ðŸ‘¤ NextAuth createUser event:', {
        user: user ? { id: user.id, name: user.name, email: user.email } : null
      })
    },
    async session({ session, token }) {
      console.log('ðŸ“‹ NextAuth session event:', {
        session: session ? { user: session.user?.name, role: session.user?.role } : null,
        token: token ? { sub: token.sub, role: token.role } : null
      })
    }
  },
}

// Export handlers for Next.js 14 App Router
import NextAuth from "next-auth"
export const handlers = NextAuth(authOptions)
export const { auth, signIn, signOut } = handlers

