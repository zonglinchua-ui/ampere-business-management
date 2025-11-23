
/**
 * Invoice Service
 * Business logic layer for customer and supplier invoices
 */
import { CustomerInvoice, SupplierInvoice } from '@prisma/client'
import { InvoiceRepository, InvoiceFilter } from '../repositories/invoice-repository'
import { PaginationParams, PaginatedResult } from '../repositories/base-repository'
import { cache } from '../cache/simple-cache'
import { v4 as uuidv4 } from 'uuid'

export class InvoiceService {
  private repository: InvoiceRepository

  constructor() {
    this.repository = new InvoiceRepository()
  }

  /**
   * Get customer invoices with caching
   */
  async getCustomerInvoices(
    filter: InvoiceFilter = {},
    pagination?: PaginationParams,
    orderBy?: any
  ): Promise<PaginatedResult<CustomerInvoice>> {
    const cacheKey = `customer-invoices:${JSON.stringify({ filter, pagination, orderBy })}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findCustomerInvoices(
          filter,
          pagination,
          {
            Customer: {
              select: {
                id: true,
                name: true,
              },
            },
            Project: {
              select: {
                id: true,
                name: true,
                projectNumber: true,
              },
            },
          },
          orderBy
        )
      },
      2 * 60 * 1000 // 2 minutes cache
    )
  }

  /**
   * Get supplier invoices with caching
   */
  async getSupplierInvoices(
    filter: InvoiceFilter = {},
    pagination?: PaginationParams,
    orderBy?: any
  ): Promise<PaginatedResult<SupplierInvoice>> {
    const cacheKey = `supplier-invoices:${JSON.stringify({ filter, pagination, orderBy })}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findSupplierInvoices(
          filter,
          pagination,
          {
            Supplier: {
              select: {
                id: true,
                name: true,
              },
            },
            Project: {
              select: {
                id: true,
                name: true,
                projectNumber: true,
              },
            },
          },
          orderBy
        )
      },
      2 * 60 * 1000 // 2 minutes cache
    )
  }

  /**
   * Get customer invoice by ID with items
   */
  async getCustomerInvoiceById(id: string): Promise<CustomerInvoice | null> {
    const cacheKey = `customer-invoice:${id}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findCustomerInvoiceWithItems(id)
      },
      5 * 60 * 1000 // 5 minutes cache
    )
  }

  /**
   * Get supplier invoice by ID with items
   */
  async getSupplierInvoiceById(id: string): Promise<SupplierInvoice | null> {
    const cacheKey = `supplier-invoice:${id}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findSupplierInvoiceWithItems(id)
      },
      5 * 60 * 1000 // 5 minutes cache
    )
  }

  /**
   * Get customer invoice by Xero ID
   */
  async getCustomerInvoiceByXeroId(xeroInvoiceId: string): Promise<CustomerInvoice | null> {
    return await this.repository.findCustomerInvoiceByXeroId(xeroInvoiceId)
  }

  /**
   * Get supplier invoice by Xero ID
   */
  async getSupplierInvoiceByXeroId(xeroInvoiceId: string): Promise<SupplierInvoice | null> {
    return await this.repository.findSupplierInvoiceByXeroId(xeroInvoiceId)
  }

  /**
   * Create customer invoice
   */
  async createCustomerInvoice(data: any, createdById: string): Promise<CustomerInvoice> {
    const invoice = await this.repository.createCustomerInvoice({
      id: uuidv4(),
      ...data,
      createdById,
      updatedAt: new Date(),
    } as any)

    // Invalidate cache
    this.invalidateCustomerInvoiceCache()
    
    return invoice
  }

  /**
   * Create supplier invoice
   */
  async createSupplierInvoice(data: any, createdById: string): Promise<SupplierInvoice> {
    const invoice = await this.repository.createSupplierInvoice({
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    // Invalidate cache
    this.invalidateSupplierInvoiceCache()
    
    return invoice
  }

  /**
   * Update customer invoice
   */
  async updateCustomerInvoice(id: string, data: any): Promise<CustomerInvoice> {
    const invoice = await this.repository.updateCustomerInvoice(id, {
      ...data,
      updatedAt: new Date(),
    })

    // Invalidate cache
    this.invalidateCustomerInvoiceCache(id)
    
    return invoice
  }

  /**
   * Update supplier invoice
   */
  async updateSupplierInvoice(id: string, data: any): Promise<SupplierInvoice> {
    const invoice = await this.repository.updateSupplierInvoice(id, {
      ...data,
      updatedAt: new Date(),
    })

    // Invalidate cache
    this.invalidateSupplierInvoiceCache(id)
    
    return invoice
  }

  /**
   * Invalidate customer invoice cache
   */
  private invalidateCustomerInvoiceCache(id?: string) {
    if (id) {
      cache.delete(`customer-invoice:${id}`)
    }
    cache.clear()
  }

  /**
   * Invalidate supplier invoice cache
   */
  private invalidateSupplierInvoiceCache(id?: string) {
    if (id) {
      cache.delete(`supplier-invoice:${id}`)
    }
    cache.clear()
  }
}
