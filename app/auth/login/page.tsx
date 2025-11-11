
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In - Ampere Engineering",
  description: "Sign in to your Ampere Engineering Business Management System account",
}

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding and info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 via-red-700 to-red-800 text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-red-600 text-xl font-bold">A</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Ampere Engineering</h1>
              <p className="text-red-100 text-sm">Business Management System</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-3xl font-bold leading-tight">
              Welcome back to your
              <br />
              project management hub
            </h2>
            <p className="text-red-100 text-lg leading-relaxed">
              Access your dashboard, manage projects, track invoices, and collaborate 
              with your team seamlessly.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-red-100">Secure & encrypted authentication</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-red-100">Role-based access control</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-red-100">Cross-device synchronization</span>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-gray-50">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl font-bold">A</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ampere Engineering</h1>
              <p className="text-gray-600">Business Management System</p>
            </div>
          </div>
          
          <Card className="shadow-lg border-0">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
              <CardDescription className="text-center text-gray-600">
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center space-y-4">
            <div className="text-sm text-gray-500">
              Need help accessing your account?{' '}
              <Link href="/auth/support" className="text-red-600 hover:text-red-700 font-medium">
                Contact Support
              </Link>
            </div>
            <div className="flex justify-center space-x-6 text-xs text-gray-400">
              <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
              <Link href="/security" className="hover:text-gray-600">Security</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
