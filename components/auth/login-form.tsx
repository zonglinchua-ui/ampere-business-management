
'use client'

import { useState, useEffect } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Icons } from "@/components/ui/icons"
import { toast } from "sonner"
import { 
  Eye, 
  EyeOff, 
  User, 
  Lock, 
  Mail,
  AlertCircle,
  CheckCircle2,
  Shield
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
})

type LoginForm = z.infer<typeof loginSchema>

interface LoginAttempt {
  timestamp: number
  failed: boolean
}

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  })

  // Check for rate limiting (max 5 attempts per 15 minutes)
  const isRateLimited = () => {
    const now = Date.now()
    const recentAttempts = loginAttempts.filter(
      attempt => now - attempt.timestamp < 15 * 60 * 1000 && attempt.failed
    )
    return recentAttempts.length >= 5
  }

  // Add login attempt to tracking
  const trackLoginAttempt = (failed: boolean) => {
    const attempt: LoginAttempt = {
      timestamp: Date.now(),
      failed,
    }
    
    const updated = [...loginAttempts, attempt].slice(-10) // Keep last 10 attempts
    setLoginAttempts(updated)
    
    // Store in localStorage for persistence across sessions
    if (typeof window !== 'undefined') {
      localStorage.setItem('loginAttempts', JSON.stringify(updated))
    }
  }

  // Load login attempts from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('loginAttempts')
      if (stored) {
        try {
          const attempts = JSON.parse(stored) as LoginAttempt[]
          setLoginAttempts(attempts)
        } catch (error) {
          console.warn('Failed to parse stored login attempts:', error)
        }
      }
    }
  }, [])

  // Clear error when user starts typing
  useEffect(() => {
    const subscription = form.watch(() => {
      if (loginError) {
        setLoginError(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [form.watch, loginError])

  const getBrowserInfo = () => {
    if (typeof window === 'undefined') return { userAgent: 'Unknown', isEdge: false, isChrome: false }
    
    const userAgent = window.navigator.userAgent
    const isEdge = userAgent.includes('Edg/')
    const isChrome = userAgent.includes('Chrome/') && !isEdge
    
    return { userAgent, isEdge, isChrome }
  }

  async function onSubmit(values: LoginForm) {
    // Check rate limiting
    if (isRateLimited()) {
      setLoginError("Too many login attempts. Please wait 15 minutes before trying again.")
      return
    }

    setIsLoading(true)
    setLoginError(null)

    try {
      const browserInfo = getBrowserInfo()
      
      // DEBUGGING: Log initial state
      console.log('🚀 LOGIN FLOW START:', {
        username: values.username,
        passwordLength: values.password?.length,
        rememberMe: values.rememberMe,
        callbackUrl,
        currentPath: window.location.pathname,
        currentUrl: window.location.href,
        browserInfo,
        cookiesEnabled: navigator.cookieEnabled,
        localStorage: typeof Storage !== 'undefined',
      })

      // Check current session before login attempt
      const preLoginSession = await getSession()
      console.log('📋 Pre-login session:', preLoginSession ? 'EXISTS' : 'NONE')

      // STEP 1: Attempt authentication
      console.log('🔐 STEP 1: Calling signIn...')
      const loginResult = await signIn("credentials", {
        email: values.username,
        password: values.password,
        redirect: true,
        callbackUrl,
      })

      console.log('📤 STEP 1 RESULT:', {
        ok: loginResult?.ok,
        error: loginResult?.error,
        status: loginResult?.status,
        url: loginResult?.url,
      })

      if (loginResult?.ok) {
        console.log('✅ STEP 2: Login API successful!')
        
        // Track successful attempt
        trackLoginAttempt(false)

        // Handle "Remember Me" functionality
        if (values.rememberMe && typeof window !== 'undefined') {
          localStorage.setItem('rememberUser', values.username)
          console.log('💾 Username saved to localStorage')
        }
        
        // Show success message
        setLoginSuccess(true)
        toast.success("Login successful! Redirecting...", {
          icon: <CheckCircle2 className="h-4 w-4" />,
        })

        // STEP 2: Wait a moment for session to be created, then redirect
        console.log('🔍 STEP 3: Waiting for session creation and redirecting...')
        
        // Give NextAuth time to set up the session
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verify session was created
        try {
          const session = await getSession()
          console.log('📋 Post-login session check:', session ? {
            user: session.user?.name,
            role: session.user?.role,
            id: session.user?.id
          } : 'NONE')
          
          if (session) {
            console.log('✅ STEP 4: Session verified, authenticated user:', {
              name: session.user?.name,
              role: session.user?.role,
              email: session.user?.email,
            })
          } else {
            console.warn('⚠️ Session not immediately available, but proceeding with redirect (NextAuth will handle it)')
          }
        } catch (sessionError) {
          console.warn('⚠️ Session check failed, but proceeding with redirect:', sessionError)
        }
        
        // Always redirect on successful login - NextAuth will handle session creation
        console.log('🎯 Redirecting to:', callbackUrl)
        
        // Check if we're already on the target page
        if (window.location.pathname === callbackUrl) {
          console.log('ℹ️ Already on target page, forcing reload')
          window.location.reload()
          return
        }
        
        try {
          // Use window.location.href for more reliable navigation after login
          console.log('🔄 Using window.location.href for post-login navigation')
          window.location.href = callbackUrl
        } catch (redirectError) {
          console.error('❌ Redirect failed:', redirectError)
          // Fallback to router
          console.log('🔄 Fallback to Next.js router')
          router.push(callbackUrl)
        }
        
        return
      }

      // STEP 5: Handle login failures
      console.log('❌ STEP 5: Login failed')
      trackLoginAttempt(true)
      
      let errorMessage = "Login failed. Please try again."
      
      if (loginResult?.error) {
        console.error('📋 Login error details:', {
          error: loginResult.error,
          status: loginResult.status,
          url: loginResult.url,
        })
        
        switch (loginResult.error) {
          case 'CredentialsSignin':
            errorMessage = "Invalid username or password. Please check your credentials and try again."
            break
          case 'AccessDenied':
            errorMessage = "Access denied. Your account may be inactive or you don't have permission."
            break
          case 'Verification':
            errorMessage = "Account verification required. Please contact your administrator."
            break
          case 'Configuration':
            errorMessage = "Authentication configuration error. Please contact support."
            break
          default:
            errorMessage = `Authentication error: ${loginResult.error}. Please try again or contact support.`
        }
      }

      setLoginError(errorMessage)
      toast.error(errorMessage, {
        icon: <AlertCircle className="h-4 w-4" />,
      })

    } catch (error) {
      console.error('💥 LOGIN FLOW EXCEPTION:', error)
      trackLoginAttempt(true)
      
      let errorMessage = "An unexpected error occurred. Please try again."
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = "Network error. Please check your internet connection and try again."
      } else if (error instanceof Error) {
        console.error('📋 Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        })
        errorMessage = `Error: ${error.message}`
      }
      
      setLoginError(errorMessage)
      toast.error(errorMessage, {
        icon: <AlertCircle className="h-4 w-4" />,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Check for existing session on component mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        console.log('🔍 Checking for existing session on mount...')
        const existingSession = await getSession()
        
        if (existingSession) {
          console.log('✅ Existing session found:', {
            user: existingSession.user?.name,
            role: existingSession.user?.role,
          })
          
          toast.success("Already logged in! Redirecting...", {
            icon: <CheckCircle2 className="h-4 w-4" />,
          })
          
          // Use router.push directly without delay to avoid conflicts
          router.push(callbackUrl)
        } else {
          console.log('ℹ️ No existing session found')
        }
      } catch (error) {
        console.warn('⚠️ Error checking existing session:', error)
      }
    }
    
    checkExistingSession()
  }, [router, callbackUrl])

  // Load remembered username on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const remembered = localStorage.getItem('rememberUser')
      if (remembered) {
        console.log('💾 Loading remembered username:', remembered)
        form.setValue('username', remembered)
        form.setValue('rememberMe', true)
      }
    }
  }, [form])

  const failedAttempts = loginAttempts.filter(
    attempt => attempt.failed && Date.now() - attempt.timestamp < 15 * 60 * 1000
  ).length

  return (
    <div className="space-y-6">
      {/* Security notice for multiple failed attempts */}
      {failedAttempts >= 3 && (
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Multiple login attempts detected. For security, you'll be temporarily locked out after 5 failed attempts.
          </AlertDescription>
        </Alert>
      )}

      {/* Login error alert */}
      {loginError && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {loginError}
          </AlertDescription>
        </Alert>
      )}

      {/* Success message */}
      {loginSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Login successful! Redirecting to your dashboard...
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Username/Email field */}
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm font-medium text-gray-700">
            Username or Email
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="username"
              type="text"
              placeholder="Enter your username or email"
              disabled={isLoading || loginSuccess}
              className={`pl-10 h-12 transition-all duration-200 ${
                form.formState.errors.username 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:border-red-500 focus:ring-red-100'
              }`}
              {...form.register("username")}
            />
          </div>
          {form.formState.errors.username && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {form.formState.errors.username.message}
            </p>
          )}
        </div>

        {/* Password field */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-gray-700">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              disabled={isLoading || loginSuccess}
              className={`pl-10 pr-12 h-12 transition-all duration-200 ${
                form.formState.errors.password
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-red-500 focus:ring-red-100'
              }`}
              {...form.register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading || loginSuccess}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </Button>
          </div>
          {form.formState.errors.password && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {/* Remember me checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="rememberMe"
            checked={form.watch("rememberMe")}
            onCheckedChange={(checked) => form.setValue("rememberMe", checked as boolean)}
            disabled={isLoading || loginSuccess}
          />
          <Label
            htmlFor="rememberMe"
            className="text-sm text-gray-600 cursor-pointer select-none"
          >
            Remember me on this device
          </Label>
        </div>

        {/* Submit button */}
        <Button 
          type="submit" 
          className={`w-full h-12 text-white font-medium transition-all duration-200 ${
            loginSuccess 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-red-600 hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={isLoading || loginSuccess || isRateLimited()}
        >
          {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
          {loginSuccess && <CheckCircle2 className="mr-2 h-4 w-4" />}
          {loginSuccess ? 'Redirecting...' : isLoading ? 'Signing In...' : 'Sign In'}
        </Button>

        {/* Rate limit warning */}
        {isRateLimited() && (
          <p className="text-sm text-center text-amber-600">
            Too many failed attempts. Please wait 15 minutes before trying again.
          </p>
        )}
      </form>

      {/* Social login placeholder for future implementation */}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">Or continue with</span>
          </div>
        </div>

        {/* Social login buttons - placeholder for future implementation */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={true}
            className="h-12 border-gray-300 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={true}
            className="h-12 border-gray-300 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.954 4.569a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.691 8.094 4.066 6.13 1.64 3.161a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.061a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.937 4.937 0 004.604 3.417 9.868 9.868 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.054 0 13.999-7.496 13.999-13.986 0-.209 0-.42-.015-.63a9.936 9.936 0 002.46-2.548l-.047-.02z"/>
            </svg>
            Microsoft
          </Button>
        </div>
        
        <p className="text-xs text-center text-gray-500">
          Social login options will be available soon
        </p>
      </div>
    </div>
  )
}
