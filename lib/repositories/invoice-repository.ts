
/**
 * Invoice Repository
 * Unified repository for both Customer and Supplier invoices
 */
import { CustomerInvoice, SupplierInvoice, Prisma } from '@prisma/client'
import { BaseRepository, PaginationParams, PaginatedResult } from './base-repository'
import { prisma } from '../db'

export type Invoice = CustomerInvoice | SupplierInvoice

export interface InvoiceFilter {
  search?: string
  type?: 'customer' | 'supplier'
  status?: string[]
  customerId?: string
  supplierId?: string
  projectId?: string
  isXeroSynced?: boolean
  dateFrom?: Date
  dateTo?: Date
}

export class InvoiceRepository extends BaseRepository<Invoice> {
  constructor() {
    super('customerInvoice')
  }

  /**
   * Find customer invoices with pagination and filters
   */
  async findCustomerInvoices(
    filter: InvoiceFilter = {},
    pagination?: PaginationParams,
    include?: any,
    orderBy?: any
  ): Promise<PaginatedResult<CustomerInvoice>> {
    const where: Prisma.CustomerInvoiceWhereInput = {
      ...(filter.status && { status: { in: filter.status as any } }),
      ...(filter.customerId && { customerId: filter.customerId }),
      ...(filter.projectId && { projectId: filter.projectId }),
      ...(filter.isXeroSynced !== undefined && { isXeroSynced: filter.isXeroSynced }),
      ...(filter.dateFrom && { issueDate: { gte: filter.dateFrom } }),
      ...(filter.dateTo && { issueDate: { lte: filter.dateTo } }),
      ...(filter.search && this.buildCustomerInvoiceSearchQuery(filter.search)),
    }

    const result = await this.findWithPagination(where, pagination, include, orderBy)
    return result as PaginatedResult<CustomerInvoice>
  }

  /**
   * Find supplier invoices with pagination and filters
   */
  async findSupplierInvoices(
    filter: InvoiceFilter = {},
    pagination?: PaginationParams,
    include?: any,
    orderBy?: any
  ): Promise<PaginatedResult<SupplierInvoice>> {
    const supplierInvoiceModel = (this.prisma as any).supplierInvoice
    const page = pagination?.page || 1
    const pageSize = pagination?.pageSize || 50
    const skip = (page - 1) * pageSize

    const where: Prisma.SupplierInvoiceWhereInput = {
      ...(filter.status && { status: { in: filter.status as any } }),
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.projectId && { projectId: filter.projectId }),
      ...(filter.isXeroSynced !== undefined && { isXeroSynced: filter.isXeroSynced }),
      ...(filter.dateFrom && { invoiceDate: { gte: filter.dateFrom } }),
      ...(filter.dateTo && { invoiceDate: { lte: filter.dateTo } }),
      ...(filter.search && this.buildSupplierInvoiceSearchQuery(filter.search)),
    }

    const [data, total] = await Promise.all([
      supplierInvoiceModel.findMany({
        where,
        include,
        orderBy,
        skip,
        take: pageSize,
      }),
      supplierInvoiceModel.count({ where }),
    ])

    return {
      data: data as SupplierInvoice[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * Find customer invoice by ID with items
   */
  async findCustomerInvoiceWithItems(id: string): Promise<CustomerInvoice | null> {
    return await prisma.customerInvoice.findUnique({
      where: { id },
      include: {
        CustomerInvoiceItem: {
          orderBy: { order: 'asc' },
        },
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
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
    })
  }

  /**
   * Find supplier invoice by ID with items
   */
  async findSupplierInvoiceWithItems(id: string): Promise<SupplierInvoice | null> {
    return await prisma.supplierInvoice.findUnique({
      where: { id },
      include: {
        SupplierInvoiceItem: {
          orderBy: { order: 'asc' },
        },
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
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
    })
  }

  /**
   * Find customer invoice by Xero ID
   */
  async findCustomerInvoiceByXeroId(xeroInvoiceId: string): Promise<CustomerInvoice | null> {
    return await prisma.customerInvoice.findUnique({
      where: { xeroInvoiceId },
    })
  }

  /**
   * Find supplier invoice by Xero ID
   */
  async findSupplierInvoiceByXeroId(xeroInvoiceId: string): Promise<SupplierInvoice | null> {
    return await prisma.supplierInvoice.findUnique({
      where: { xeroInvoiceId },
    })
  }

  /**
   * Create customer invoice
   */
  async createCustomerInvoice(
    data: Prisma.CustomerInvoiceCreateInput
  ): Promise<CustomerInvoice> {
    return await prisma.customerInvoice.create({ data })
  }

  /**
   * Create supplier invoice
   */
  async createSupplierInvoice(
    data: Prisma.SupplierInvoiceCreateInput
  ): Promise<SupplierInvoice> {
    return await prisma.supplierInvoice.create({ data })
  }

  /**
   * Update customer invoice
   */
  async updateCustomerInvoice(
    id: string,
    data: Prisma.CustomerInvoiceUpdateInput
  ): Promise<CustomerInvoice> {
    return await prisma.customerInvoice.update({
      where: { id },
      data,
    })
  }

  /**
   * Update supplier invoice
   */
  async updateSupplierInvoice(
    id: string,
    data: Prisma.SupplierInvoiceUpdateInput
  ): Promise<SupplierInvoice> {
    return await prisma.supplierInvoice.update({
      where: { id },
      data,
    })
  }

  /**
   * Build search query for customer invoices
   */
  private buildCustomerInvoiceSearchQuery(search: string): Prisma.CustomerInvoiceWhereInput {
    return {
      OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { Customer: { name: { contains: search, mode: 'insensitive' } } },
        { Project: { name: { contains: search, mode: 'insensitive' } } },
      ],
    }
  }

  /**
   * Build search query for supplier invoices
   */
  private buildSupplierInvoiceSearchQuery(search: string): Prisma.SupplierInvoiceWhereInput {
    return {
      OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { supplierInvoiceRef: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { Supplier: { name: { contains: search, mode: 'insensitive' } } },
        { Project: { name: { contains: search, mode: 'insensitive' } } },
      ],
    }
  }
}
