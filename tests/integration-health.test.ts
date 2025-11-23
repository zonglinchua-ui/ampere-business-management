import assert from 'node:assert'
import test from 'node:test'
import { getIntegrationHealthSnapshot, type IntegrationHealthSnapshot } from '@/lib/health/integrations'

const fakePrisma = {
  $queryRaw: async () => 1,
  customerInvoice: {
    count: async (args?: any) => (args?.where ? 5 : 10)
  },
  customer: {
    count: async (args?: any) => (args?.where ? 7 : 14)
  },
  xeroIntegration: {
    findFirst: async () => ({
      isActive: true,
      tenantName: 'Demo Tenant',
      tenantId: 'tenant-1'
    })
  },
  xero_logs: {
    findFirst: async () => ({ timestamp: new Date('2024-01-02T00:00:00Z'), status: 'SUCCESS' }),
    count: async (args?: any) => (args?.where?.status === 'ERROR' ? 2 : 0),
    findMany: async () => [
      {
        id: 'log-1',
        entity: 'invoice',
        status: 'ERROR',
        message: 'Failed to sync invoice 123',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        recordsFailed: 1
      }
    ]
  },
  xero_sync_conflicts: {
    count: async (args?: any) => (args?.where?.status === 'PENDING' ? 1 : 0),
    findMany: async () => [
      {
        id: 'conflict-1',
        entity: 'invoice',
        entityName: 'Invoice 123',
        conflictType: 'DUPLICATE',
        status: 'PENDING',
        createdAt: new Date('2024-01-03T00:00:00Z')
      }
    ]
  }
}

const fakeXeroHealth = async () => ({
  isConnected: true,
  tokenExpiresIn: 45,
  tenantId: 'tenant-1',
  tenantName: 'Demo Tenant',
  needsRefresh: false,
  needsReconnect: false
})

test('builds an aggregated integration snapshot', async () => {
  const snapshot = await getIntegrationHealthSnapshot(fakePrisma as any, fakeXeroHealth)

  assert.equal(snapshot.overallStatus, 'warning') // one pending conflict triggers warning
  assert.equal(snapshot.checks.database.status, 'healthy')
  assert.equal(snapshot.checks.syncActivity.pendingConflicts, 1)
  assert.equal(snapshot.recentFailures.length, 1)
  assert.equal(snapshot.pendingConflicts[0].entityName, 'Invoice 123')
  assert.ok((snapshot as IntegrationHealthSnapshot).generatedAt)
})
