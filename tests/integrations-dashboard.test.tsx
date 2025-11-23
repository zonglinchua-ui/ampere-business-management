import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { IntegrationsDashboard } from '@/components/health/integrations-dashboard'
import type { IntegrationHealthSnapshot } from '@/lib/health/integrations'

const sampleSnapshot: IntegrationHealthSnapshot = {
  overallStatus: 'healthy',
  generatedAt: new Date('2024-01-04T00:00:00Z').toISOString(),
  checks: {
    database: {
      status: 'healthy',
      lastChecked: new Date().toISOString(),
      details: 'Database connection and sync markers are healthy',
      metrics: {
        invoiceCount: 10,
        xeroSyncedInvoices: 8,
        customerCount: 5,
        xeroSyncedCustomers: 4
      }
    },
    xeroConnection: {
      status: 'healthy',
      lastChecked: new Date().toISOString(),
      details: 'Xero connection is active',
      expiresInMinutes: 60,
      tenantName: 'Demo Tenant'
    },
    syncActivity: {
      status: 'healthy',
      lastChecked: new Date().toISOString(),
      details: 'Sync pipeline is healthy',
      lastSync: new Date('2024-01-03T00:00:00Z').toISOString(),
      pendingConflicts: 0,
      failedSyncs: 0
    }
  },
  recentFailures: [
    {
      id: 'failure-1',
      entity: 'invoice',
      status: 'ERROR',
      message: 'Invoice 234 failed to sync',
      timestamp: new Date('2024-01-02T00:00:00Z').toISOString(),
      recordsFailed: 1
    }
  ],
  pendingConflicts: []
}

test('renders health dashboard with snapshot data', () => {
  const html = ReactDOMServer.renderToString(
    <IntegrationsDashboard snapshot={sampleSnapshot} loading={false} error={null} />
  )

  assert.ok(html.includes('All systems nominal'))
  assert.ok(html.includes('Database'))
  assert.ok(html.includes('Xero Connection'))
  assert.ok(html.includes('Recent Failures'))
  assert.ok(html.includes('Invoice 234 failed to sync'))
})
