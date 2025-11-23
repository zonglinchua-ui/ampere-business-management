
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Metadata } from "next"
import { ArrowLeft, FileText, Users, AlertTriangle, CheckCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Terms of Service - Ampere Engineering",
  description: "Terms of service for Ampere Engineering Business Management System",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center">
              <FileText className="text-white h-8 w-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-lg text-gray-600">
            Last updated: September 2025
          </p>
        </div>

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-red-600" />
              Acceptance of Terms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              By accessing and using the Ampere Engineering Business Management System, 
              you agree to be bound by these Terms of Service and all applicable laws and regulations. 
              If you do not agree with any of these terms, you are prohibited from using this system.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Users className="h-6 w-6 text-red-600" />
              User Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-600 space-y-4">
              <p>As a user of this system, you agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the system only for legitimate business purposes</li>
                <li>Maintain the confidentiality of your login credentials</li>
                <li>Not share your account access with unauthorized persons</li>
                <li>Report any security breaches or unauthorized access immediately</li>
                <li>Use the system in compliance with all applicable laws</li>
                <li>Not attempt to circumvent security measures</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              System Availability & Limitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-600 space-y-4">
              <p>Please note that:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>System availability may be affected by maintenance, updates, or technical issues</li>
                <li>We strive for maximum uptime but cannot guarantee 100% availability</li>
                <li>Users are responsible for backing up critical business data</li>
                <li>System features and functionality may change with updates</li>
                <li>Support is provided during business hours (Mon-Fri, 9 AM - 6 PM SGT)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle>Data Ownership & Intellectual Property</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-600 space-y-3">
              <p>
                You retain ownership of all business data and content you input into the system. 
                Ampere Engineering retains ownership of the software, system architecture, and related intellectual property.
              </p>
              <p>
                The system and its original content, features, and functionality are owned by 
                Ampere Engineering and are protected by international copyright, trademark, 
                patent, trade secret, and other intellectual property laws.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="border-2 border-red-100 bg-red-50">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                Questions About Terms?
              </h3>
              <p className="text-red-700 mb-4">
                If you have questions about these terms of service, 
                please contact us at legal@ampereengineering.com
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
