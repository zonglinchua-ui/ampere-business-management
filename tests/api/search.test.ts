import { NextRequest } from 'next/server'
import { createSearchHandler } from '@/app/api/search/route'
import { GlobalSearchResult } from '@/lib/search'
import { assert, test } from '../utils'

const prismaMock = {
  customer: {
    findMany: async () => []
  },
  supplier: {
    findMany: async () => [
      {
        id: 'sup-1',
        name: 'Supplier One',
        supplierNumber: 'SUP-001',
        email: 'sup@example.com',
        phone: '123',
        contactPerson: 'Alex',
        isApproved: true,
        updatedAt: new Date()
      }
    ]
  },
  project: {
    findMany: async () => [
      {
        id: 'proj-1',
        name: 'Project One',
        projectNumber: 'PRJ-001',
        description: 'Bridge',
        status: 'ACTIVE',
        contractValue: 500000,
        Customer: { name: 'Acme Corp' },
        updatedAt: new Date()
      }
    ]
  },
  customerInvoice: {
    findMany: async () => [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        status: 'PAID',
        totalAmount: 25000,
        amountDue: 0,
        currency: 'SGD',
        description: 'Milestone',
        issueDate: new Date(),
        Customer: { name: 'Acme Corp' },
        Project: { name: 'Project One', projectNumber: 'PRJ-001' },
        createdAt: new Date()
      }
    ]
  },
  user: {
    findMany: async () => []
  }
}

test('aggregates supplier, project, and invoice results', async () => {
  const handler = createSearchHandler({
    prismaClient: prismaMock as any,
    getSession: async () => ({ user: { id: 'user-1' } })
  })

  const request = new NextRequest(
    'http://localhost/api/search?query=project&entities=supplier,project,invoice&limit=5'
  )

  const response = await handler(request)
  const data = await response.json()

  assert.strictEqual(data.count, 3)

  const supplier = data.results.find((item: GlobalSearchResult) => item.type === 'supplier')
  assert.ok(supplier)
  assert.strictEqual(supplier.href, '/suppliers/sup-1')

  const project = data.results.find((item: GlobalSearchResult) => item.type === 'project')
  assert.ok(project)
  assert.strictEqual(project.status, 'ACTIVE')

  const invoice = data.results.find((item: GlobalSearchResult) => item.type === 'invoice')
  assert.ok(invoice)
  assert.strictEqual(invoice.href, '/finance/customer-invoices/inv-1')
})

test('returns unauthorized when no session is present', async () => {
  const handler = createSearchHandler({
    prismaClient: prismaMock as any,
    getSession: async () => null
  })

  const request = new NextRequest('http://localhost/api/search?query=test')
  const response = await handler(request)

  assert.strictEqual(response.status, 401)
})

test('returns 429 when rate limit is exceeded', async () => {
  const handler = createSearchHandler({
    prismaClient: prismaMock as any,
    getSession: async () => ({ user: { id: 'user-2' } }),
    rateLimit: () => ({ success: false, remaining: 0, resetAt: Date.now() + 1000 })
  })

  const request = new NextRequest('http://localhost/api/search?query=test')
  const response = await handler(request)

  assert.strictEqual(response.status, 429)
})
