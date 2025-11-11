
/**
 * Contact Repository
 * Unified repository for both Customers and Suppliers
 * Treats them as unified "Contact" entities with role flags
 */
import { Customer, Supplier, Prisma } from '@prisma/client'
import { BaseRepository, PaginationParams, PaginatedResult } from './base-repository'
import { prisma } from '../db'

export type Contact = Customer | Supplier

export interface ContactFilter {
  search?: string
  type?: 'customer' | 'supplier' | 'both'
  isActive?: boolean
  isXeroSynced?: boolean
  includeDeleted?: boolean
}

export interface ContactWithRelations extends Customer {
  _count?: {
    projects?: number
    quotations?: number
    purchaseOrders?: number
    invoices?: number
  }
  totalProjectValue?: number
  totalPurchaseValue?: number
}

export class ContactRepository extends BaseRepository<Contact> {
  constructor() {
    super('customer') // Use customer as base model
  }

  /**
   * Find contact by ID (searches both customers and suppliers)
   */
  async findContactById(
    id: string,
    type: 'customer' | 'supplier' | 'auto' = 'auto'
  ): Promise<Contact | null> {
    if (type === 'customer' || type === 'auto') {
      const customer = await prisma.customer.findUnique({
        where: { id },
      })
      if (customer) return customer
    }

    if (type === 'supplier' || type === 'auto') {
      const supplier = await prisma.supplier.findUnique({
        where: { id },
      })
      if (supplier) return supplier
    }

    return null
  }

  /**
   * Find customers with pagination and search
   */
  async findCustomers(
    filter: ContactFilter = {},
    pagination?: PaginationParams,
    include?: any,
    orderBy?: any
  ): Promise<PaginatedResult<Customer>> {
    const where: Prisma.CustomerWhereInput = {
      isDeleted: filter.includeDeleted ? undefined : false,
      ...(filter.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter.isXeroSynced !== undefined && { isXeroSynced: filter.isXeroSynced }),
      ...(filter.search && this.buildCustomerSearchQuery(filter.search)),
    }

    const result = await this.findWithPagination(where, pagination, include, orderBy)
    return result as PaginatedResult<Customer>
  }

  /**
   * Find suppliers with pagination and search
   */
  async findSuppliers(
    filter: ContactFilter = {},
    pagination?: PaginationParams,
    include?: any,
    orderBy?: any
  ): Promise<PaginatedResult<Supplier>> {
    const supplierModel = (this.prisma as any).supplier
    const page = pagination?.page || 1
    const pageSize = pagination?.pageSize || 50
    const skip = (page - 1) * pageSize

    const where: Prisma.SupplierWhereInput = {
      isDeleted: filter.includeDeleted ? undefined : false,
      ...(filter.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter.isXeroSynced !== undefined && { isXeroSynced: filter.isXeroSynced }),
      OR: [
        { isSupplier: true },
        { isSupplier: null }, // Treat null as true for backward compatibility
      ],
      ...(filter.search && this.buildSupplierSearchQuery(filter.search)),
    }

    const [data, total] = await Promise.all([
      supplierModel.findMany({
        where,
        include,
        orderBy,
        skip,
        take: pageSize,
      }),
      supplierModel.count({ where }),
    ])

    return {
      data: data as Supplier[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * Find customers with aggregated data (project values, etc.)
   */
  async findCustomersWithAggregates(
    filter: ContactFilter = {},
    pagination?: PaginationParams,
    orderBy?: any
  ): Promise<PaginatedResult<ContactWithRelations>> {
    const result = await this.findCustomers(
      filter,
      pagination,
      {
        _count: {
          select: {
            Project: true,
            Quotation: true,
            CustomerInvoice: true,
          },
        },
      },
      orderBy
    )

    // Calculate aggregate values
    const dataWithAggregates = await Promise.all(
      result.data.map(async (customer) => {
        const totalProjectValue = await this.calculateCustomerProjectValue(customer.id)
        return {
          ...customer,
          totalProjectValue,
        }
      })
    )

    return {
      ...result,
      data: dataWithAggregates,
    }
  }

  /**
   * Find suppliers with aggregated data (purchase values, etc.)
   */
  async findSuppliersWithAggregates(
    filter: ContactFilter = {},
    pagination?: PaginationParams,
    orderBy?: any
  ): Promise<PaginatedResult<any>> {
    const result = await this.findSuppliers(
      filter,
      pagination,
      {
        _count: {
          select: {
            PurchaseOrder: true,
            SupplierInvoice: true,
          },
        },
      },
      orderBy
    )

    // Calculate aggregate values
    const dataWithAggregates = await Promise.all(
      result.data.map(async (supplier) => {
        const totalPurchaseValue = await this.calculateSupplierPurchaseValue(supplier.id)
        return {
          ...supplier,
          totalPurchaseValue,
        }
      })
    )

    return {
      ...result,
      data: dataWithAggregates,
    }
  }

  /**
   * Create customer
   */
  async createCustomer(data: Prisma.CustomerCreateInput): Promise<Customer> {
    return await prisma.customer.create({ data })
  }

  /**
   * Create supplier
   */
  async createSupplier(data: Prisma.SupplierCreateInput): Promise<Supplier> {
    return await prisma.supplier.create({ data })
  }

  /**
   * Update customer
   */
  async updateCustomer(id: string, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    return await prisma.customer.update({
      where: { id },
      data,
    })
  }

  /**
   * Update supplier
   */
  async updateSupplier(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return await prisma.supplier.update({
      where: { id },
      data,
    })
  }

  /**
   * Soft delete customer
   */
  async deleteCustomer(id: string, deletedBy: string): Promise<Customer> {
    return await prisma.customer.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy,
      },
    })
  }

  /**
   * Soft delete supplier
   */
  async deleteSupplier(id: string, deletedBy: string): Promise<Supplier> {
    return await prisma.supplier.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy,
      },
    })
  }

  /**
   * Find customer by Xero Contact ID
   */
  async findCustomerByXeroId(xeroContactId: string): Promise<Customer | null> {
    return await prisma.customer.findUnique({
      where: { xeroContactId },
    })
  }

  /**
   * Find supplier by Xero Contact ID
   */
  async findSupplierByXeroId(xeroContactId: string): Promise<Supplier | null> {
    return await prisma.supplier.findUnique({
      where: { xeroContactId },
    })
  }

  /**
   * Calculate total project value for a customer
   */
  private async calculateCustomerProjectValue(customerId: string): Promise<number> {
    const result = await prisma.project.aggregate({
      where: {
        customerId,
        isActive: true,
      },
      _sum: {
        contractValue: true,
      },
    })

    return Number(result._sum.contractValue || 0)
  }

  /**
   * Calculate total purchase value for a supplier
   */
  private async calculateSupplierPurchaseValue(supplierId: string): Promise<number> {
    const result = await prisma.purchaseOrder.aggregate({
      where: {
        supplierId,
        status: 'APPROVED', // Only count approved POs
      },
      _sum: {
        totalAmount: true,
      },
    })

    return Number(result._sum?.totalAmount || 0)
  }

  /**
   * Build search query for customers
   */
  private buildCustomerSearchQuery(search: string): Prisma.CustomerWhereInput {
    return {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { customerNumber: { contains: search, mode: 'insensitive' } },
        { companyReg: { contains: search, mode: 'insensitive' } },
      ],
    }
  }

  /**
   * Build search query for suppliers
   */
  private buildSupplierSearchQuery(search: string): Prisma.SupplierWhereInput {
    return {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { supplierNumber: { contains: search, mode: 'insensitive' } },
        { companyReg: { contains: search, mode: 'insensitive' } },
      ],
    }
  }
}
