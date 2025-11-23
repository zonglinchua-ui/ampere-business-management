'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { IntegrationsDashboard } from '@/components/health/integrations-dashboard'
import { useHealthIntegrations } from '@/hooks/use-health-integrations'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function HealthPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { snapshot, isLoading, error, refresh, retrySync, resolveConflict } = useHealthIntegrations()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    )
  }

  const role = (session?.user as any)?.role
  const hasAccess = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER', 'ADMIN'].includes(role)

  if (!hasAccess) {
    return (
      <MainLayout>
        <div className="container mx-auto max-w-3xl p-6">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              You do not have permission to view integration health.
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto max-w-6xl p-6">
        <IntegrationsDashboard
          snapshot={snapshot}
          loading={isLoading}
          error={error as Error | null}
          onRefresh={refresh}
          onRetry={retrySync}
          onResolveConflict={resolveConflict}
        />
      </div>
    </MainLayout>
  )
}
