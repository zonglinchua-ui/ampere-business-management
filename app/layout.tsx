import type { Metadata, Viewport } from "next";
import './globals.css'
import './css-fixes.css'
import { Providers } from '@/components/providers'
import { ErrorBoundary } from '@/components/error-boundary'
import { ApiClientProvider } from '@/components/api-client-provider'
import { Toaster } from 'sonner'
import { XeroTokenHeartbeat } from '@/components/xero/xero-token-heartbeat'
import CommandPaletteProvider from '@/components/CommandPalette'

export const metadata: Metadata = {
  title: "Ampere Engineering - Business Management System",
  description: "Professional business management solution for engineering projects",
  keywords: ["business management", "project management", "engineering", "invoicing"],
  robots: {
    index: true,
    follow: true,
  },
  authors: [{ name: "Ampere Engineering" }],
  generator: "Next.js",
  applicationName: "Ampere Business Management System",
  referrer: "origin-when-cross-origin",
  creator: "Ampere Engineering",
  publisher: "Ampere Engineering",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="next-size-adjust" content="true" />
      </head>
      <body className="font-sans">
        <ErrorBoundary>
          <ApiClientProvider>
            <Providers>
              {children}
              <Toaster
                position="top-right"
                richColors
                closeButton
                duration={4000}
                toastOptions={{
                  style: {
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  },
                  className: 'toast-custom',
                }}
              />
              <CommandPaletteProvider />
              {/* Automatic Xero token refresh - keeps tokens fresh without re-authentication */}
              <XeroTokenHeartbeat interval={10 * 60 * 1000} />
            </Providers>
          </ApiClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}