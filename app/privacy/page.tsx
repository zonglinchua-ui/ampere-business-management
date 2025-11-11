
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Metadata } from "next"
import { ArrowLeft, Shield, Eye, Database, Lock } from "lucide-react"

export const metadata: Metadata = {
  title: "Privacy Policy - Ampere Engineering",
  description: "Privacy policy for Ampere Engineering Business Management System",
}

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-lg text-gray-600">
            Last updated: September 2025
          </p>
        </div>

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Eye className="h-6 w-6 text-red-600" />
              Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-4">
              The Ampere Engineering Business Management System collects information necessary 
              to provide business management services to our clients.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Account information (name, email, role, company details)</li>
              <li>Project and business data entered into the system</li>
              <li>Usage logs and system access records</li>
              <li>Technical information for system optimization</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Database className="h-6 w-6 text-red-600" />
              How We Use Your Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-600 space-y-3">
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and maintain the business management system</li>
                <li>Process and manage your business data</li>
                <li>Ensure system security and prevent unauthorized access</li>
                <li>Provide customer support and technical assistance</li>
                <li>Improve system functionality and user experience</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-red-600" />
              Data Protection & Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-600 space-y-3">
              <p>We implement industry-standard security measures including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encrypted data transmission and storage</li>
                <li>Role-based access controls</li>
                <li>Regular security audits and updates</li>
                <li>Secure authentication mechanisms</li>
                <li>Data backup and recovery procedures</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="border-2 border-red-100 bg-red-50">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                Questions About Privacy?
              </h3>
              <p className="text-red-700 mb-4">
                If you have questions about this privacy policy or how we handle your data, 
                please contact us at privacy@ampereengineering.com
              </p>
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
