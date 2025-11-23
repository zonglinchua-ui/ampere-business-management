
/**
 * Base Repository Pattern
 * Provides common CRUD operations for all entities
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../db'

export interface PaginationParams {
  page: number
  pageSize: number
  skip?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SearchFilter {
  search?: string
  fields?: string[]
}

export interface SortRule {
  field: string
  direction: 'asc' | 'desc'
}

export abstract class BaseRepository<T> {
  protected prisma: PrismaClient
  protected modelName: string

  constructor(modelName: string) {
    this.prisma = prisma
    this.modelName = modelName
  }

  /**
   * Find entity by ID
   */
  async findById(id: string, include?: any): Promise<T | null> {
    const model = (this.prisma as any)[this.modelName]
    return await model.findUnique({
      where: { id },
      ...(include && { include }),
    })
  }

  /**
   * Find all entities with optional filters
   */
  async findAll(where?: any, include?: any, orderBy?: any): Promise<T[]> {
    const model = (this.prisma as any)[this.modelName]
    return await model.findMany({
      where,
      include,
      orderBy,
    })
  }

  /**
   * Find with pagination
   */
  async findWithPagination(
    where?: any,
    pagination?: PaginationParams,
    include?: any,
    orderBy?: any
  ): Promise<PaginatedResult<T>> {
    const model = (this.prisma as any)[this.modelName]
    const page = pagination?.page || 1
    const pageSize = pagination?.pageSize || 50
    const skip = (page - 1) * pageSize

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        include,
        orderBy,
        skip,
        take: pageSize,
      }),
      model.count({ where }),
    ])

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * Create entity
   */
  async create(data: any): Promise<T> {
    const model = (this.prisma as any)[this.modelName]
    return await model.create({ data })
  }

  /**
   * Update entity
   */
  async update(id: string, data: any): Promise<T> {
    const model = (this.prisma as any)[this.modelName]
    return await model.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete entity (soft delete if supported)
   */
  async delete(id: string, softDelete: boolean = true): Promise<T> {
    const model = (this.prisma as any)[this.modelName]
    
    if (softDelete) {
      // Check if model supports soft delete
      try {
        return await model.update({
          where: { id },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        })
      } catch (error) {
        // Fallback to hard delete if soft delete not supported
        return await model.delete({ where: { id } })
      }
    } else {
      return await model.delete({ where: { id } })
    }
  }

  /**
   * Count entities
   */
  async count(where?: any): Promise<number> {
    const model = (this.prisma as any)[this.modelName]
    return await model.count({ where })
  }

  /**
   * Check if entity exists
   */
  async exists(where: any): Promise<boolean> {
    const count = await this.count(where)
    return count > 0
  }

  /**
   * Build search query for multiple fields
   */
  protected buildSearchQuery(searchTerm: string, fields: string[]): any {
    if (!searchTerm || fields.length === 0) return undefined

    return {
      OR: fields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' as const },
      })),
    }
  }

  /**
   * Build sort query from sort rules
   */
  protected buildSortQuery(sortRules?: SortRule[]): any {
    if (!sortRules || sortRules.length === 0) {
      return [{ createdAt: 'desc' }]
    }

    return sortRules.map(rule => ({
      [rule.field]: rule.direction,
    }))
  }
}
