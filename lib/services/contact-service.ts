
/**
 * Contact Service
 * Business logic layer for customers and suppliers
 * Uses ContactRepository for data access
 */
import { Customer, Supplier } from '@prisma/client'
import { ContactRepository, ContactFilter, ContactWithRelations } from '../repositories/contact-repository'
import { PaginationParams, PaginatedResult } from '../repositories/base-repository'
import { cache } from '../cache/simple-cache'
import { generateCustomerNumber, generateSupplierNumber } from '../number-generation'
import { v4 as uuidv4 } from 'uuid'

export class ContactService {
  private repository: ContactRepository

  constructor() {
    this.repository = new ContactRepository()
  }

  /**
   * Get customers with caching
   */
  async getCustomers(
    filter: ContactFilter = {},
    pagination?: PaginationParams,
    orderBy?: any
  ): Promise<PaginatedResult<ContactWithRelations>> {
    const cacheKey = `customers:${JSON.stringify({ filter, pagination, orderBy })}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findCustomersWithAggregates(filter, pagination, orderBy)
      },
      2 * 60 * 1000 // 2 minutes cache
    )
  }

  /**
   * Get suppliers with caching
   */
  async getSuppliers(
    filter: ContactFilter = {},
    pagination?: PaginationParams,
    orderBy?: any
  ): Promise<PaginatedResult<any>> {
    const cacheKey = `suppliers:${JSON.stringify({ filter, pagination, orderBy })}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findSuppliersWithAggregates(filter, pagination, orderBy)
      },
      2 * 60 * 1000 // 2 minutes cache
    )
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(id: string): Promise<any> {
    const cacheKey = `customer:${id}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findById(id)
      },
      5 * 60 * 1000 // 5 minutes cache
    )
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(id: string): Promise<any> {
    const cacheKey = `supplier:${id}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findContactById(id, 'supplier')
      },
      5 * 60 * 1000 // 5 minutes cache
    )
  }

  /**
   * Create customer
   */
  async createCustomer(data: any, createdById: string): Promise<Customer> {
    const customerNumber = await generateCustomerNumber()
    
    const customer = await this.repository.createCustomer({
      id: uuidv4(),
      ...data,
      customerNumber,
      createdById,
      updatedAt: new Date(),
    })

    // Invalidate cache
    this.invalidateCustomerCache()
    
    return customer
  }

  /**
   * Create supplier
   */
  async createSupplier(data: any, createdById: string): Promise<Supplier> {
    const supplierNumber = await generateSupplierNumber()
    
    const supplier = await this.repository.createSupplier({
      id: uuidv4(),
      ...data,
      supplierNumber,
      createdById,
      updatedAt: new Date(),
    })

    // Invalidate cache
    this.invalidateSupplierCache()
    
    return supplier
  }

  /**
   * Update customer
   */
  async updateCustomer(id: string, data: any): Promise<Customer> {
    const customer = await this.repository.updateCustomer(id, {
      ...data,
      updatedAt: new Date(),
    })

    // Invalidate cache
    this.invalidateCustomerCache(id)
    
    return customer
  }

  /**
   * Update supplier
   */
  async updateSupplier(id: string, data: any): Promise<Supplier> {
    const supplier = await this.repository.updateSupplier(id, {
      ...data,
      updatedAt: new Date(),
    })

    // Invalidate cache
    this.invalidateSupplierCache(id)
    
    return supplier
  }

  /**
   * Delete customer (soft delete)
   */
  async deleteCustomer(id: string, deletedBy: string): Promise<Customer> {
    const customer = await this.repository.deleteCustomer(id, deletedBy)
    
    // Invalidate cache
    this.invalidateCustomerCache(id)
    
    return customer
  }

  /**
   * Delete supplier (soft delete)
   */
  async deleteSupplier(id: string, deletedBy: string): Promise<Supplier> {
    const supplier = await this.repository.deleteSupplier(id, deletedBy)
    
    // Invalidate cache
    this.invalidateSupplierCache(id)
    
    return supplier
  }

  /**
   * Get customer by Xero Contact ID
   */
  async getCustomerByXeroId(xeroContactId: string): Promise<Customer | null> {
    return await this.repository.findCustomerByXeroId(xeroContactId)
  }

  /**
   * Get supplier by Xero Contact ID
   */
  async getSupplierByXeroId(xeroContactId: string): Promise<Supplier | null> {
    return await this.repository.findSupplierByXeroId(xeroContactId)
  }

  /**
   * Invalidate customer cache
   */
  private invalidateCustomerCache(id?: string) {
    if (id) {
      cache.delete(`customer:${id}`)
    }
    // Clear all customer list caches
    // In production, use pattern matching with Redis
    cache.clear()
  }

  /**
   * Invalidate supplier cache
   */
  private invalidateSupplierCache(id?: string) {
    if (id) {
      cache.delete(`supplier:${id}`)
    }
    // Clear all supplier list caches
    cache.clear()
  }
}
