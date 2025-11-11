
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Metadata } from "next"
import { 
  Mail, 
  Phone, 
  Clock, 
  Shield, 
  HelpCircle,
  ArrowLeft,
  MessageCircle,
  Book
} from "lucide-react"

export const metadata: Metadata = {
  title: "Support - Ampere Engineering",
  description: "Get help with your Ampere Engineering Business Management System account",
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-3xl font-bold">A</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Support Center
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Need help accessing your account or using the Ampere Engineering Business Management System? 
            We're here to assist you.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Account Access Issues */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-red-600" />
                Account Access Issues
              </CardTitle>
              <CardDescription>
                Forgotten password, locked account, or login problems
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <HelpCircle className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Forgotten Password?</p>
                    <p className="text-sm text-gray-600">Contact your system administrator to reset your password</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <HelpCircle className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Account Locked?</p>
                    <p className="text-sm text-gray-600">Multiple failed login attempts lock accounts for 15 minutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <HelpCircle className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Browser Issues?</p>
                    <p className="text-sm text-gray-600">Clear cookies and cache, or try incognito mode</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <MessageCircle className="h-6 w-6 text-red-600" />
                Get in Touch
              </CardTitle>
              <CardDescription>
                Contact our support team for immediate assistance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium text-sm">Email Support</p>
                    <p className="text-sm text-gray-600">support@ampereengineering.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium text-sm">Phone Support</p>
                    <p className="text-sm text-gray-600">+65 XXXX-XXXX (Business Hours)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium text-sm">Support Hours</p>
                    <p className="text-sm text-gray-600">Mon-Fri: 9:00 AM - 6:00 PM SGT</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Common Issues */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Book className="h-6 w-6 text-red-600" />
              Common Issues & Solutions
            </CardTitle>
            <CardDescription>
              Quick fixes for the most common login and access problems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="font-semibold text-sm mb-2">Login not working on mobile?</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Mobile browsers sometimes have cookie restrictions.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Try using Chrome or Safari</li>
                    <li>• Enable cookies in browser settings</li>
                    <li>• Disable any ad blockers</li>
                  </ul>
                </div>
                
                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="font-semibold text-sm mb-2">Can't access from office network?</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Corporate firewalls may block certain connections.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Contact your IT department</li>
                    <li>• Try using mobile data</li>
                    <li>• Check if HTTPS is allowed</li>
                  </ul>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="font-semibold text-sm mb-2">Session keeps expiring?</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Your session may timeout due to inactivity.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Check "Remember me" when logging in</li>
                    <li>• Avoid closing the browser tab</li>
                    <li>• Save work frequently</li>
                  </ul>
                </div>
                
                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="font-semibold text-sm mb-2">Getting permission errors?</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Your user role may not have access to certain features.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Contact your system administrator</li>
                    <li>• Verify your user role permissions</li>
                    <li>• Request additional access if needed</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="border-2 border-red-100 bg-red-50">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                🚨 Emergency System Access
              </h3>
              <p className="text-red-700 mb-4">
                If you have urgent business-critical issues that require immediate system access, 
                please contact our emergency support line.
              </p>
              <div className="flex justify-center items-center gap-2 text-red-800 font-semibold">
                <Phone className="h-5 w-5" />
                Emergency: +65 XXXX-XXXX (24/7)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Login */}
        <div className="text-center mt-8">
          <Link href="/auth/login">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
