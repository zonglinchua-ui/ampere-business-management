
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Metadata } from "next"
import { ArrowLeft, Shield, Lock, Key, Eye, AlertTriangle, CheckCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Security - Ampere Engineering",
  description: "Security information for Ampere Engineering Business Management System",
}

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center">
              <Shield className="text-white h-8 w-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Security Information</h1>
          <p className="text-lg text-gray-600">
            Learn about how we protect your business data and ensure system security
          </p>
        </div>

        {/* Security Measures */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Lock className="h-6 w-6 text-red-600" />
                Data Encryption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-gray-600">
                <p>All data is protected using industry-standard encryption:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>TLS 1.3 for data in transit</li>
                  <li>AES-256 for data at rest</li>
                  <li>Encrypted database storage</li>
                  <li>Secure API communications</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Key className="h-6 w-6 text-red-600" />
                Access Control
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-gray-600">
                <p>Multi-layered access protection:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Role-based permissions</li>
                  <li>Strong password requirements</li>
                  <li>Session timeout protection</li>
                  <li>Account lockout after failed attempts</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Eye className="h-6 w-6 text-red-600" />
                Monitoring & Auditing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-gray-600">
                <p>Continuous security monitoring:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Real-time threat detection</li>
                  <li>Comprehensive audit logs</li>
                  <li>User activity tracking</li>
                  <li>Automated security alerts</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-red-600" />
                Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-gray-600">
                <p>Security standards compliance:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>ISO 27001 practices</li>
                  <li>SOC 2 Type II controls</li>
                  <li>GDPR compliance measures</li>
                  <li>Regular security assessments</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Best Practices */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-red-600" />
              User Security Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-600 space-y-4">
              <p>Help keep your account secure by following these guidelines:</p>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Password Security</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Use strong, unique passwords</li>
                    <li>Never share your login credentials</li>
                    <li>Change passwords regularly</li>
                    <li>Don't use personal information</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Safe Usage</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Always log out when finished</li>
                    <li>Don't use public computers for sensitive data</li>
                    <li>Keep your browser updated</li>
                    <li>Report suspicious activity immediately</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Incident Reporting */}
        <Card className="border-2 border-red-100 bg-red-50 mb-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-8 w-8 text-red-600 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">
                  Report Security Issues
                </h3>
                <p className="text-red-700 mb-4">
                  If you discover a security vulnerability or suspect unauthorized access to your account, 
                  please contact us immediately:
                </p>
                <div className="space-y-2">
                  <p className="text-red-800 font-semibold">
                    🚨 Security Hotline: +65 XXXX-XXXX (24/7)
                  </p>
                  <p className="text-red-800 font-semibold">
                    📧 Email: security@ampereengineering.com
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back Navigation */}
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
